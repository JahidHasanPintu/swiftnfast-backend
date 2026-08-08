import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { UserRegistrationDto } from './registration/client-reg.dto';
import { UserRegistration } from './registration/client-reg.model';
import { UserLoginDto } from './login/login.dto';
import { UpdateUserDto } from './update/update-user.dto';

@Injectable()
export class ClientService {
  constructor(
    @InjectModel('Registration') private userModel: Model<UserRegistrationDto>,
    private configService: ConfigService,
  ) {}

  async register(userRegistrationDto: UserRegistrationDto): Promise<UserRegistration> {
    const { username, contactNumber, email, userType, password } = userRegistrationDto;
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const hashedPassword = await this.hashPassword(password);
    const user = new this.userModel({ username, contactNumber, email, userType, password: hashedPassword });
    return user.save();
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async login(userLoginDto: UserLoginDto): Promise<{ user: UserRegistration; token: string }> {
    const { email, password } = userLoginDto;
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!await this.verifyPassword(password, user.password)) {
      throw new NotFoundException('Invalid credentials');
    }
    const token = this.generateToken(user);
    return { user, token };
  }

  private async verifyPassword(plainTextPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainTextPassword, hashedPassword);
  }

  private generateToken(user: UserRegistration): string {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    console.log('JWT_SECRET:', process.env.JWT_SECRET); // Debugging line
    console.log('jwtSecret from ConfigService:', jwtSecret); // Debugging line
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }
    return jwt.sign({ userId: user._id, email: user.email }, jwtSecret, { expiresIn: '1h' });
  }

  async getAllUsers(): Promise<UserRegistration[]> {
    return this.userModel.find().exec();
  }

  async findUserByEmail(email: string): Promise<UserRegistration | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserRegistration | null> {
    // If password is being updated, hash it first
    if (updateUserDto.password) {
      updateUserDto.password = await this.hashPassword(updateUserDto.password);
    }

    // Check if email is being changed and if it already exists
    if (updateUserDto.email) {
      const existingUser = await this.userModel.findOne({ 
        email: updateUserDto.email,
        _id: { $ne: id } // Exclude current user from check
      }).exec();
      
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();
    
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }
    return true;
  }
}