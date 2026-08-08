import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(['Super Admin', 'Admin', 'User'])
  userType?: 'Super Admin' | 'Admin' | 'User';

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}