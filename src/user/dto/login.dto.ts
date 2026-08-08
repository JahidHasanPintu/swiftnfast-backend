import { ArrayNotEmpty, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
    @IsNotEmpty()
    @IsString()
    username: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsOptional()
    @ArrayNotEmpty()
    roles?: string[]; // An array of roles the user belongs to
}
