import { IsBoolean, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class LoginDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(254) identifier!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) password!: string;
  @ApiProperty({ default: false }) @IsBoolean() remember = false;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 4, maxLength: 6 })
  @IsString()
  @MinLength(4, { message: 'รหัสผ่านต้องมีความยาว 4–6 ตัวอักษร' })
  @MaxLength(6, { message: 'รหัสผ่านต้องมีความยาว 4–6 ตัวอักษร' })
  newPassword!: string;
}
