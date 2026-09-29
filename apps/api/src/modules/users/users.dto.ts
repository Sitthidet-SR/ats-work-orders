import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateUserDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty() @Matches(/^[A-Za-z0-9._-]{3,50}$/) username!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) position!: string;
  @ApiProperty() @IsUUID() departmentId!: string;
  @ApiProperty({ writeOnly: true, minLength: 4, maxLength: 6 })
  @IsString()
  @MinLength(4, { message: 'รหัสผ่านต้องมีความยาว 4–6 ตัวอักษร' })
  @MaxLength(6, { message: 'รหัสผ่านต้องมีความยาว 4–6 ตัวอักษร' })
  password!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(['ADMIN', 'ISSUER', 'SUPERVISOR', 'APPROVER', 'VIEWER'], { each: true })
  roles!: string[];
}
export class UpdateUserRolesDto {
  @ApiProperty({
    type: [String],
    enum: ['ADMIN', 'ISSUER', 'SUPERVISOR', 'APPROVER', 'VIEWER'],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(['ADMIN', 'ISSUER', 'SUPERVISOR', 'APPROVER', 'VIEWER'], { each: true })
  roles!: string[];
}
