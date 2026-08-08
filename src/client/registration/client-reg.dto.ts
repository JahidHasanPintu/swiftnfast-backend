// user-registration.dto.ts
import { IsString, IsEmail, IsEnum, MinLength } from 'class-validator';

export class UserRegistrationDto {
    @IsString()
    readonly username: string;

    @IsString()
    readonly contactNumber: string;

    @IsEmail()
    readonly email: string;

    @IsEnum(['Admin', 'Super Admin']) // Use enum or other validation for userType
    readonly userType: string;

    @IsString()
    @MinLength(6) // Adjust minimum password length as needed
    readonly password: string;
}
