// auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { UserModule } from '../user/user.module'; // Import your UserModule
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    PassportModule,
    UserModule, // Import UserModule to use User service
  ],

  exports: [PassportModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
