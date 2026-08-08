import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UserRegistrationSchema } from './registration/client-reg.model';
import { ConfigModule } from '@nestjs/config';


@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: 'Registration', schema: UserRegistrationSchema },
    ]),
  ],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule { }
