import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { SignUpDto } from 'src/user/dto/signUp.dto';
import { AuthService } from './auth.service';
import { LoginDto } from 'src/user/dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signupApi(@Body() body: SignUpDto) {
    try {
      await this.authService.signupUser(body);
      return {
        message: 'User created successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('signin')
  async signinApi(@Body() body: LoginDto) {
    try {
      const response = await this.authService.signin(body);
      return {
        accessToken: response,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
