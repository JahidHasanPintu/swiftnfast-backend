import mongoose from 'mongoose';
import 'dotenv/config';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

const CartSchema = new mongoose.Schema(
  {
    isRequested: Boolean,
    requestedAt: Date,
    createdAt: Date,
  },
  { collection: 'carts', timestamps: true },
);

async function run() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const CartModel = mongoose.model('Cart', CartSchema);

  const carts = await CartModel.find({
    isRequested: true,
    requestedAt: { $exists: false },
  });

  let updated = 0;
  for (const c of carts) {
    const fallback = c.createdAt || c._id.getTimestamp();
    await CartModel.updateOne(
      { _id: c._id },
      { $set: { requestedAt: fallback } },
    );
    updated++;
  }
  console.log(`Requested carts backfilled: ${updated}`);

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});