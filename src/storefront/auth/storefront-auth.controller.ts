import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontAuthService } from './storefront-auth.service';

@Public()
@Controller('api/v1/auth')
export class StorefrontAuthController {
  constructor(private readonly authService: StorefrontAuthService) {}

  @Post('request-otp')
  @HttpCode(201)
  async requestOtp(@Body() body: { identifier: string }) {
    await this.authService.requestOtp(body);
    return {
      success: true,
      message: 'OTP sent successfully to your email',
      data: null,
    };
  }

  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() body: { identifier: string; otp: string }) {
    const data = await this.authService.verifyOtp(body);
    return { success: true, message: 'OTP verified successfully', data };
  }

  @Post('register')
  @HttpCode(201)
  async register(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      phone?: string;
    },
  ) {
    await this.authService.register(body);
    return {
      success: true,
      message:
        'Registration successful. Please check your email to verify your account.',
      data: null,
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }) {
    const data = await this.authService.login(body);
    return { success: true, message: 'Login successful', data };
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body() body: { token: string; newPassword: string },
  ) {
    return this.authService.resetPassword(body);
  }
}
