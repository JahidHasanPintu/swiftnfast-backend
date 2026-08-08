import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UserDocument } from './interfaces/login.interface';
import { Model } from 'mongoose';
import { User } from './schemas/login.schemas';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('Login') private readonly userModel: Model<UserDocument>,
  ) {}

  async create(userDto: LoginDto): Promise<User> {
    const { username, password, roles } = userDto;

    // Hash and salt the password
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

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userModel.findOne({ username }).exec();
    if (user && (await bcrypt.compare(password, user.password))) {
      return user.toObject();
    }
    return null;
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username });
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.userModel.findById(id).exec();
    return user?.toObject(); // This ensures the returned document is of type User
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({
      email,
    });
  }

  async allUser() {
    return this.userModel.find();
  }
}
