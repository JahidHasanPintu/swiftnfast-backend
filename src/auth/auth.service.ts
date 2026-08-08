import { ForbiddenException, Injectable, Post } from '@nestjs/common';
import { SignUpDto } from 'src/user/dto/signUp.dto';
import { UserService } from 'src/user/user.service';
import { hashSync, compare } from 'bcrypt';
import { LoginDto } from 'src/user/dto/login.dto';
import { sign } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  signupUser(payload: SignUpDto) {
    return this.userService.create({
      ...payload,
      password: hashSync(payload.password, 8),
    });
  }

  async signin(body: LoginDto) {
    const user = await this.userService.findOneByUsername(body.username);

    if (!user) {
      throw new ForbiddenException('Invalid username or password');
    }

    if (!compare(body.password, user.password.toString())) {
      throw new ForbiddenException('Invalid username or password');
    }

    // generate a token
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }
    const token = sign({ _id: user._id, username: user.username }, jwtSecret, {
      expiresIn: '30d',
    });
    return token;
  }
}
