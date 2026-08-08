import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({

    imports: [
        MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb+srv://mdmazharulhoque1993:inalyze@cluster0.woumqym.mongodb.net/pfu2-officials?retryWrites=true&w=majority', {
            // MongooseModule.forRoot('mongodb+srv://mdmazharulhoque1993:YHSGBKsuU0cPZCGB@cluster0.woumqym.mongodb.net/pfu2', {
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
            


            serverSelectionTimeoutMS: 30000, // 30 seconds
            socketTimeoutMS: 45000,          // 45 seconds
            retryAttempts: 5,
            retryDelay: 1000
        })

        // MongooseModule.forRoot('mongodb://localhost:27017/pfu2', {
        //     // useNewUrlParser: true,
        //     // useUnifiedTopology: true,
        //     retryAttempts: 5,
        //     retryDelay: 1000
        // })

    ],
    exports: [MongooseModule]
})
export class DatabaseModule { }
