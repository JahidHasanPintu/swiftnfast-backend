import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      retryAttempts: 5,
      retryDelay: 1000,
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
