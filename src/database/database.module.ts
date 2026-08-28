import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        retryAttempts: 5,
        retryDelay: 1000,
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
