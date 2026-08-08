import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { UserRegistrationDto } from './registration/client-reg.dto';
import { UserLoginDto } from './login/login.dto';
import { UserRegistration } from './registration/client-reg.model';
import { UpdateUserDto } from './update/update-user.dto';

@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post('register')
  async register(@Body() userRegistrationDto: UserRegistrationDto) {
    return this.clientService.register(userRegistrationDto);
  }

  @Post('login')
  async login(@Body() userLoginDto: UserLoginDto) {
    return this.clientService.login(userLoginDto);
  }

  @Get('users')
  async getAllUsers(): Promise<UserRegistration[]> {
    return this.clientService.getAllUsers();
  }

  @Get(':email')
  async findUserByEmail(@Param('email') email: string) {
    const user = await this.clientService.findUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserRegistration> {
    const updatedUser = await this.clientService.updateUser(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    return updatedUser;
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string): Promise<{ message: string }> {
    const result = await this.clientService.deleteUser(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
    return { message: 'User deleted successfully' };
  }
}
