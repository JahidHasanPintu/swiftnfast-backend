import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/login.schemas';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(@InjectModel('Login') private readonly userModel: Model<User>) {}

  async create(userDto: LoginDto): Promise<User> {
    const { username, password, roles } = userDto;

    // Hash and salt the password exactly once (bcrypt, rounds 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user object with hashed password
    const newUser = new this.userModel({
      username,
      password: hashedPassword,
      roles,
    });

    const savedUser = await newUser.save();

    return savedUser.toObject(); // Convert the saved user to a plain JavaScript object
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username });
  }

  async allUser() {
    return this.userModel.find().select('-password -__v').exec();
  }
}
