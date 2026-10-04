import mongoose from 'mongoose';
import 'dotenv/config';

/**
 * One-off migration for the cart/quote split.
 *
 * Before this, a customer had a single cart document whose items could mix
 * ready-stock products and outside_order items. Now `kind` ('cart' | 'quote')
 * makes them two separate documents. This script:
 *
 *   1. drops the old single-field unique index on guestToken, which would
 *      otherwise reject a second basket for the same guest,
 *   2. stamps `kind` on every existing basket,
 *   3. splits any legacy MIXED basket into a cart document and a quote
 *      document so no outside_order item is left behind in a cart,
 *   4. creates the new {guestToken, kind} unique index.
 */

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

const CartSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    guestToken: String,
    kind: { type: String, enum: ['cart', 'quote'], default: 'cart' },
    isRequested: Boolean,
    isRead: Boolean,
    requestedAt: Date,
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    itemPrice: Number,
    tax: Number,
    shippingBdt: Number,
    pfu2Charge: Number,
    discount: Number,
    totalPrice: Number,
  },
  { collection: 'carts', timestamps: true },
);

function parseItems(raw: any): any[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isOutside(item: any): boolean {
  return (item?.type || 'product') === 'outside_order';
}

async function dropIndexIfPresent(collection: mongoose.Collection, name: string) {
  const exists = await collection.indexExists(name);
  if (!exists) {
    console.log(`index ${name}: not present, skipping`);
    return;
  }
  await collection.dropIndex(name);
  console.log(`index ${name}: dropped`);
}

async function run() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const CartModel = mongoose.model('Cart', CartSchema);
  const collection = CartModel.collection;

  // 1. The old index is single-field unique, so one guest token could never
  //    own both a cart and a quote. It has to go before the new one lands.
  await dropIndexIfPresent(collection, 'guestToken_1');
  await dropIndexIfPresent(collection, 'userId_1');
  await dropIndexIfPresent(collection, 'isRequested_1');

  const carts = await CartModel.find({});

  let stamped = 0;
  let split = 0;

  for (const c of carts) {
    const items = parseItems(c.items);
    const outside = items.filter(isOutside);
    const products = items.filter((i: any) => !isOutside(i));

    if (outside.length === 0) {
      if (c.kind !== 'cart') {
        await CartModel.updateOne({ _id: c._id }, { $set: { kind: 'cart' } });
        stamped++;
      }
      continue;
    }

    if (products.length === 0) {
      // Pure outside-order basket: it is a quote.
      if (c.kind !== 'quote') {
        await CartModel.updateOne({ _id: c._id }, { $set: { kind: 'quote' } });
        stamped++;
      }
      continue;
    }

    // Mixed legacy basket. Keep the document as the quote (it already carries
    // the price-request state the admin queue reads) and spin the ready-stock
    // lines out into their own cart document.
    const identity = c.userId
      ? { userId: c.userId }
      : { guestToken: c.guestToken };

    const existingCart = await CartModel.findOne({
      ...identity,
      kind: 'cart',
    });

    if (existingCart) {
      const merged = [...parseItems(existingCart.items), ...products];
      await CartModel.updateOne(
        { _id: existingCart._id },
        { $set: { items: merged } },
      );
    } else {
      const totals = (list: any[]) => {
        let itemPrice = 0;
        let shipping = 0;
        for (const it of list) {
          itemPrice += Number(it?.priceBdt || 0) * (Number(it?.quantity) || 0);
          shipping += Number(it?.shippingBdt || 0);
        }
        return { itemPrice, shipping };
      };
      const t = totals(products);
      await CartModel.create({
        ...identity,
        kind: 'cart',
        items: products,
        itemPrice: t.itemPrice,
        tax: 0,
        shippingBdt: t.shipping,
        pfu2Charge: 0,
        discount: 0,
        totalPrice: t.itemPrice + t.shipping,
      });
    }

    const quoteTotals = (() => {
      let itemPrice = 0;
      let shipping = 0;
      for (const it of outside) {
        itemPrice += Number(it?.priceBdt || 0) * (Number(it?.quantity) || 0);
        shipping += Number(it?.shippingBdt || 0);
      }
      return { itemPrice, shipping };
    })();

    await CartModel.updateOne(
      { _id: c._id },
      {
        $set: {
          kind: 'quote',
          items: outside,
          itemPrice: quoteTotals.itemPrice,
          shippingBdt: quoteTotals.shipping,
          totalPrice: quoteTotals.itemPrice + quoteTotals.shipping,
        },
      },
    );
    split++;
  }

  console.log(`Baskets stamped with kind: ${stamped}`);
  console.log(`Mixed baskets split into cart + quote: ${split}`);

  // 4. New indexes. Dropped first in case a partial run left them behind.
  await dropIndexIfPresent(collection, 'guestToken_1_kind_1');
  await dropIndexIfPresent(collection, 'userId_1_kind_1');
  await dropIndexIfPresent(collection, 'kind_1_isRequested_1');

  await collection.createIndex(
    { guestToken: 1, kind: 1 },
    { unique: true, sparse: true, name: 'guestToken_1_kind_1' },
  );
  await collection.createIndex({ userId: 1, kind: 1 }, { name: 'userId_1_kind_1' });
  await collection.createIndex(
    { kind: 1, isRequested: 1 },
    { name: 'kind_1_isRequested_1' },
  );
  console.log('Indexes recreated for the cart/quote split.');

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});