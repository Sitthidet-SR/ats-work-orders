import { IsBoolean, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class LoginDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(254) identifier!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) password!: string;
  @ApiProperty({ default: false }) @IsBoolean() remember = false;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(72) newPassword!: string;
}
