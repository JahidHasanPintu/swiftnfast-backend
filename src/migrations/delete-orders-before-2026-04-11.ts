import mongoose from 'mongoose';
import 'dotenv/config';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

/**
 * Orders created before 11 April 2026. `orderDate` is the business date shown
 * in the admin panel; older rows may not have it, so fall back to createdAt.
 */
const CUTOFF = new Date('2026-04-11T00:00:00+06:00');

const OrderSchema = new mongoose.Schema(
  {
    orderId: String,
    orderNumber: String,
    orderDate: Date,
  },
  { collection: 'orders', timestamps: true },
);

async function run() {
  await mongoose.connect(uri as string);
  console.log('Connected to MongoDB');

  const OrderModel = mongoose.model('Orders', OrderSchema);

  const filter = {
    $or: [
      { orderDate: { $lt: CUTOFF } },
      {
        $and: [
          {
            $or: [
              { orderDate: { $exists: false } },
              { orderDate: null },
            ],
          },
          { createdAt: { $lt: CUTOFF } },
        ],
      },
    ],
  };

  const count = await OrderModel.countDocuments(filter);
  console.log(`Orders before ${CUTOFF.toISOString()}: ${count}`);

  if (count > 0) {
    const result = await OrderModel.deleteMany(filter);
    console.log(`Deleted orders: ${result.deletedCount}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
