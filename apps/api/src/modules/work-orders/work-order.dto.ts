import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Priority, ReasonType, WorkOrderStatus } from '@prisma/client';
export class MaterialDto {
  @ApiProperty() @IsString() @MaxLength(100) materialCode!: string;
  @ApiProperty() @IsString() @MaxLength(300) materialName!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) materialGrade?: string;
  @ApiProperty({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(999999999999)
  quantity!: number | null;
  @ApiProperty() @IsString() @MaxLength(30) unit!: string;
  @ApiProperty() @IsString() @MaxLength(2000) remark!: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}
export class MachineAssignmentDto {
  @ApiProperty() @IsUUID() machineId!: string;
  @ApiProperty({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(999999999999)
  quantity!: number | null;
  @ApiProperty() @IsString() @MaxLength(2000) remark!: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}
export class CreateWorkOrderDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกผู้สั่งงาน' })
  @MaxLength(150)
  issuerDisplayName!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) quantityText?: string;
  @ApiProperty()
  @IsDateString({ strict: true })
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  orderDate!: string;
  @ApiProperty() @IsUUID() departmentId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20000) description!: string;
  @ApiProperty() @IsBoolean() followAttachment!: boolean;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) productCode!: string;
  @ApiProperty() @IsString() @MaxLength(300) productName!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @ValidateIf((dto, value) => value !== null || !dto.quantityText?.trim())
  @Min(0.0001)
  @Max(999999999999)
  quantity!: number | null;
  @ApiProperty() @IsString() @MaxLength(30) unit!: string;
  @ApiProperty() @IsDateString({ strict: true }) @Matches(/^20\d{2}-\d{2}-\d{2}$/) dueDate!: string;
  @ApiProperty() @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/) dueTime!: string;
  @ApiProperty({ enum: Priority }) @IsEnum(Priority) priority!: Priority;
  @ApiProperty({ enum: ReasonType }) @IsEnum(ReasonType) reasonType!: ReasonType;
  @ApiProperty() @IsString() @MaxLength(4000) reasonDetail!: string;
  @ApiProperty() @IsString() @MaxLength(20000) specialInstructions!: string;
  @ApiProperty() @ValidateIf((_, value) => value !== '') @IsUUID() supervisorId!: string;
  @ApiProperty() @ValidateIf((_, value) => value !== '') @IsUUID() approverId!: string;
  @ApiProperty({ type: [MaterialDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialDto)
  materials!: MaterialDto[];
  @ApiProperty({ type: [MachineAssignmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MachineAssignmentDto)
  machines!: MachineAssignmentDto[];
}
export class UpdateWorkOrderDto extends PartialType(CreateWorkOrderDto, {
  skipNullProperties: false,
}) {
  @ApiProperty() @IsInt() @Min(0) version!: number;
}
export class ActionDto {
  @ApiProperty() @IsInt() @Min(0) version!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) comment?: string;
}
export class ListWorkOrdersDto {
  @IsOptional()
  @IsEnum({ waiting: 'waiting', approved: 'approved', urgent: 'urgent', overdue: 'overdue' })
  summary?: 'waiting' | 'approved' | 'urgent' | 'overdue';
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(WorkOrderStatus) status?: WorkOrderStatus;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsUUID() machineId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() issuerId?: string;
  @IsOptional() @IsDateString({ strict: true }) dateFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) dateTo?: string;
  @IsOptional() @IsDateString({ strict: true }) dueFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) dueTo?: string;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsEnum({
    createdAt: 'createdAt',
    documentNo: 'documentNo',
    dueDate: 'dueDate',
    orderDate: 'orderDate',
    productName: 'productName',
    quantity: 'quantity',
    status: 'status',
    priority: 'priority',
  })
  sortBy = 'createdAt';
  @IsEnum({ asc: 'asc', desc: 'desc' }) sortOrder: 'asc' | 'desc' = 'desc';
}
