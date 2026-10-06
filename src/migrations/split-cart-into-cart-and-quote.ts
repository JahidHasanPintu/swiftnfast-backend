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
 *   1b. removes stored `guestToken: null` / '' leftovers from guest-to-user
 *      merges, which would otherwise collide with each other,
 *   2. stamps `kind` on every existing basket,
 *   3. splits any legacy MIXED basket into a cart document and a quote
 *      document so no outside_order item is left behind in a cart,
 *   4. creates the new {guestToken, kind} unique index (partial, so only real
 *      tokens are uniqueness-constrained).
 *
 * Usage:
 *   npm run migrate:split-cart-into-cart-and-quote            # applies
 *   npm run migrate:split-cart-into-cart-and-quote -- --dry-run  # read only
 *
 * ALWAYS dry-run first. The target database comes from MONGODB_URI, which in
 * this repo points at the live Atlas cluster.
 */

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

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
    couponCode: String,
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

async function dropIndexIfPresent(
  collection: mongoose.Collection,
  name: string,
) {
  const exists = await collection.indexExists(name);
  if (!exists) {
    console.log(`index ${name}: not present, skipping`);
    return;
  }
  if (DRY_RUN) {
    console.log(`index ${name}: would drop`);
    return;
  }
  await collection.dropIndex(name);
  console.log(`index ${name}: dropped`);
}

/** Money for a set of lines, used to price the documents this script creates. */
function totalsFor(list: any[]): { itemPrice: number; shipping: number } {
  let itemPrice = 0;
  let shipping = 0;
  for (const it of list) {
    itemPrice += Number(it?.priceBdt || 0) * (Number(it?.quantity) || 0);
    shipping += Number(it?.shippingBdt || 0);
  }
  return { itemPrice, shipping };
}

/** Identity of a single basket line, used to avoid merging it in twice. */
function lineKey(it: any): string {
  return [
    it?.type || 'product',
    it?.productId || '',
    it?.quantity || '',
    it?.color || '',
    it?.size || '',
    it?.priceBdt || '',
  ].join('|');
}

/**
 * Collapse baskets that share an owner and a kind into one.
 *
 * Before the split the cart service regularly left two baskets for the same
 * customer, because an emptied basket was not always removed. The new
 * {owner, kind} index is unique, so these must be merged or the index cannot be
 * created at all.
 *
 * Lines are folded into the most recently touched basket, exact duplicate
 * lines are dropped, price-request state is carried across so the admin queue
 * loses nothing, and any coupon is cleared because it was priced against the
 * smaller item set. The customer simply re-applies it at checkout.
 */
async function mergeDuplicateBaskets(
  CartModel: any,
  collection: mongoose.Collection,
) {
  const groups = await collection
    .aggregate([
      {
        $group: {
          _id: {
            owner: { $ifNull: ['$userId', '$guestToken'] },
            kind: '$kind',
          },
          ids: { $push: '$_id' },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  let mergedGroups = 0;
  let removedDocs = 0;

  for (const g of groups) {
    const docs = await CartModel.find({ _id: { $in: g.ids } })
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .exec();
    if (docs.length < 2) continue;

    const [primary, ...redundant] = docs;

    const seen = new Set<string>();
    const items: any[] = [];
    for (const d of [...redundant, primary]) {
      for (const it of parseItems(d.items)) {
        const key = lineKey(it);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(it);
      }
    }

    const t = totalsFor(items);
    const anyRequested = docs.some((d: any) => d.isRequested === true);
    const requestedAt = docs
      .map((d: any) => d.requestedAt)
      .filter(Boolean)
      .sort((a: any, b: any) => +new Date(b) - +new Date(a))[0];
    const anyUnread = docs.some((d: any) => d.isRead === false);

    console.log(
      `  merge ${g._id.owner}/${g._id.kind}: ${docs.length} baskets -> 1 ` +
        `(${items.length} lines${anyRequested ? ', price-request kept' : ''})`,
    );

    if (!DRY_RUN) {
      await CartModel.updateOne(
        { _id: primary._id },
        {
          $set: {
            items,
            itemPrice: Number(t.itemPrice.toFixed(2)),
            shippingBdt: Number(t.shipping.toFixed(2)),
            tax: 0,
            pfu2Charge: 0,
            totalPrice: Number((t.itemPrice + t.shipping).toFixed(2)),
            isRequested: anyRequested,
            isRead: anyUnread ? false : primary.isRead,
            requestedAt: anyRequested
              ? requestedAt ?? primary.requestedAt
              : undefined,
            // Priced against the old, smaller item set.
            discount: 0,
            couponCode: null,
          },
        },
      );
      await CartModel.deleteMany({
        _id: { $in: redundant.map((d: any) => d._id) },
      });
    }

    mergedGroups++;
    removedDocs += redundant.length;
  }

  console.log(
    `Duplicate basket groups merged: ${mergedGroups} (${removedDocs} redundant baskets removed)`,
  );
  return mergedGroups;
}

async function run() {
  await mongoose.connect(uri);
  console.log(
    `Connected to MongoDB (${DRY_RUN ? 'DRY RUN, no writes' : 'APPLYING'})`,
  );

  const CartModel = mongoose.model('Cart', CartSchema);
  const collection = CartModel.collection;

  // 1. The old index is single-field unique, so one guest token could never
  //    own both a cart and a quote. It has to go before the new one lands.
  await dropIndexIfPresent(collection, 'guestToken_1');
  await dropIndexIfPresent(collection, 'userId_1');
  await dropIndexIfPresent(collection, 'isRequested_1');

  // 1b. Guest baskets folded into an account used to be saved with
  //     `guestToken: undefined`, which the driver stores as null. A stored
  //     null is still an indexed value, so every such basket collided with the
  //     next one on { guestToken: null, kind }. Remove the field entirely:
  //     `$ifNull` grouping below then keys these baskets on userId (or on no
  //     owner at all if userId is missing too). An empty string is treated the
  //     same way - it is a real (and shared) indexed value otherwise.
  const noToken = {
    $or: [{ guestToken: { $type: 'null' } }, { guestToken: '' }],
  };
  const nullTokens = await collection.countDocuments(noToken);
  if (nullTokens > 0) {
    if (DRY_RUN) {
      console.log(`empty guestToken: would unset on ${nullTokens} basket(s)`);
    } else {
      const res = await collection.updateMany(noToken, {
        $unset: { guestToken: '' },
      });
      console.log(`empty guestToken unset on ${res.modifiedCount} basket(s)`);
    }
  } else {
    console.log('empty guestToken: none found');
  }

  // Read raw documents. `.lean()` is essential: the schema declares
  // `default: 'cart'`, so a hydrated doc would report kind 'cart' even when the
  // stored document has no `kind` field at all, and those baskets would never
  // be stamped. Every query in the app filters on `kind`, so a basket without
  // it is invisible.
  const carts = await CartModel.find({}).lean().exec();

  let stamped = 0;
  let split = 0;

  for (const c of carts) {
    const items = parseItems(c.items);
    const outside = items.filter(isOutside);
    const products = items.filter((i: any) => !isOutside(i));

    if (outside.length === 0) {
      // Only ready-stock lines. A legacy document has no `kind` stored at all,
      // so this is normally a real write.
      if (c.kind !== 'cart') {
        if (!DRY_RUN) {
          await CartModel.updateOne({ _id: c._id }, { $set: { kind: 'cart' } });
        }
        stamped++;
      }
      continue;
    }

    if (products.length === 0) {
      // Pure outside-order basket: it is a quote.
      if (c.kind !== 'quote') {
        if (!DRY_RUN) {
          await CartModel.updateOne(
            { _id: c._id },
            { $set: { kind: 'quote' } },
          );
        }
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
      if (!DRY_RUN) {
        await CartModel.updateOne(
          { _id: existingCart._id },
          { $set: { items: merged } },
        );
      }
    } else {
      const t = totalsFor(products);
      if (!DRY_RUN) {
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
    }

    const quoteTotals = totalsFor(outside);
    if (!DRY_RUN) {
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
    }
    split++;
  }

  console.log(`Baskets stamped with kind: ${stamped}`);
  console.log(`Mixed baskets split into cart + quote: ${split}`);

  // 2. The new {owner, kind} index is UNIQUE. The database already holds some
  //    owners with more than one basket, which would make createIndex throw and
  //    leave the collection with no unique index at all. Merge them first.
  await mergeDuplicateBaskets(CartModel, collection);

  // 3. Re-check. A clash here means the merge could not resolve it, and it is
  //    still safer to stop than to leave the collection unprotected.
  const dupes = await collection
    .aggregate([
      {
        $group: {
          _id: {
            owner: { $ifNull: ['$userId', '$guestToken'] },
            kind: '$kind',
          },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
      { $count: 'groups' },
    ])
    .toArray();

  const dupeCount = dupes[0]?.groups || 0;
  if (dupeCount > 0 && DRY_RUN) {
    // Expected: the merge above deliberately wrote nothing, so the pre-existing
    // clash is still there to be read back.
    console.log(
      `${dupeCount} owner/kind group(s) still clash because this was a dry run; ` +
        'the merge above would clear them.',
    );
  } else if (dupeCount > 0) {
    console.error(
      `\nABORTED: ${dupeCount} owner/kind group(s) still hold more than one basket.`,
    );
    console.error(
      'The unique index cannot be created until those are merged by hand.',
    );
    await mongoose.disconnect();
    process.exit(1);
  } else {
    console.log(
      'Every owner has at most one basket per kind: unique index is safe.',
    );
  }

  // 3b. The unique index keys on guestToken specifically, so also check that no
  //     real token owns two baskets of the same kind - a basket carrying BOTH a
  //     userId and a guestToken is grouped by userId above and would slip past
  //     the check in step 3.
  const tokenDupes = await collection
    .aggregate([
      { $match: { guestToken: { $type: 'string' } } },
      { $group: { _id: { t: '$guestToken', k: '$kind' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: 'groups' },
    ])
    .toArray();
  const tokenDupeCount = tokenDupes[0]?.groups || 0;
  if (tokenDupeCount > 0 && !DRY_RUN) {
    console.error(
      `\nABORTED: ${tokenDupeCount} guestToken/kind group(s) hold more than one basket.`,
    );
    console.error(
      'The unique index cannot be created until those are merged by hand.',
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  if (tokenDupeCount > 0) {
    console.log(
      `${tokenDupeCount} guestToken/kind group(s) still clash because this was a dry run.`,
    );
  }

  // 4. New indexes. Dropped first in case a partial run left them behind.
  await dropIndexIfPresent(collection, 'guestToken_1_kind_1');
  await dropIndexIfPresent(collection, 'userId_1_kind_1');
  await dropIndexIfPresent(collection, 'kind_1_isRequested_1');

  if (DRY_RUN) {
    console.log(
      'index guestToken_1_kind_1: would create (unique, partial on string guestToken)',
    );
    console.log('index userId_1_kind_1: would create');
    console.log('index kind_1_isRequested_1: would create');
  } else {
    await collection.createIndex(
      { guestToken: 1, kind: 1 },
      {
        unique: true,
        partialFilterExpression: { guestToken: { $type: 'string' } },
        name: 'guestToken_1_kind_1',
      },
    );
    await collection.createIndex(
      { userId: 1, kind: 1 },
      { name: 'userId_1_kind_1' },
    );
    await collection.createIndex(
      { kind: 1, isRequested: 1 },
      { name: 'kind_1_isRequested_1' },
    );
    console.log('Indexes recreated for the cart/quote split.');
  }

  await mongoose.disconnect();
  console.log(DRY_RUN ? 'Dry run complete. Nothing was written.' : 'Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
