import { ForbiddenException, Injectable, Post } from '@nestjs/common';
import { SignUpDto } from 'src/user/dto/signUp.dto';
import { UserService } from 'src/user/user.service';
import { hashSync, compare } from 'bcrypt'
import { LoginDto } from 'src/user/dto/login.dto';
import { sign } from 'jsonwebtoken'

@Injectable()
export class AuthService {


    constructor(private readonly userService: UserService) { }

    signupUser(payload: SignUpDto) {
        return this.userService.create({
            ...payload,
            password: hashSync(payload.password, 8)
        })
    }


    async signin(body: LoginDto) {
        const user = await this.userService.findOneByUsername(body.username);

        if (!user) {
            throw new ForbiddenException("Invalid username or password")
        }

        if (!compare(body.password, user.password.toString())) {
            throw new ForbiddenException("Invalid username or password")
        }

        // generate a token
        const token = sign({ _id: user._id, username: user.username }, 'secret', { expiresIn: '30d' })
        return token
    }
}
