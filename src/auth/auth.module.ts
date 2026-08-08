// auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { UserModule } from '../user/user.module'; // Import your UserModule
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    PassportModule,
    UserModule, // Import UserModule to use User service
  ],

  exports: [PassportModule, JwtAuthGuard, JwtStrategy],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
})
export class AuthModule {}
