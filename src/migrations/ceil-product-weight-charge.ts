import mongoose from 'mongoose';
import 'dotenv/config';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

const PurchaseSchema = new mongoose.Schema(
  {
    orderId: String,
    orderItemIndex: Number,
    productWeightCharge: Number,
    weightChargePerKg: Number,
    productWeight: Number,
  },
  { collection: 'purchases' },
);

const DropShipSchema = new mongoose.Schema(
  {
    productWeightCharge: Number,
  },
  { collection: 'dropships' },
);

async function run() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const PurchaseModel = mongoose.model('Purchase', PurchaseSchema);
  const DropShipModel = mongoose.model('DropShip', DropShipSchema);

  const purchases = await PurchaseModel.find({
    productWeightCharge: { $type: 'double', $ne: null },
  });
  let purchaseUpdated = 0;
  for (const p of purchases) {
    const charge = Number(p.productWeightCharge);
    if (Number.isFinite(charge) && !Number.isInteger(charge)) {
      await PurchaseModel.updateOne(
        { _id: p._id },
        { $set: { productWeightCharge: Math.ceil(charge) } },
      );
      purchaseUpdated++;
    }
  }
  console.log(`Purchases updated: ${purchaseUpdated}`);

  const dropships = await DropShipModel.find({
    productWeightCharge: { $type: 'double', $ne: null },
  });
  let dropShipUpdated = 0;
  for (const d of dropships) {
    const charge = Number(d.productWeightCharge);
    if (Number.isFinite(charge) && !Number.isInteger(charge)) {
      await DropShipModel.updateOne(
        { _id: d._id },
        { $set: { productWeightCharge: Math.ceil(charge) } },
      );
      dropShipUpdated++;
    }
  }
  console.log(`Dropships updated: ${dropShipUpdated}`);

  await mongoose.disconnect();
  console.log(`Done. Purchases: ${purchaseUpdated}, Dropships: ${dropShipUpdated}`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});