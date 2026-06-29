import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCycleDto {
  @IsString() name!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
}

export class UpdateReviewDto {
  @IsOptional() @IsBoolean() selfDone?: boolean;
  @IsOptional() @IsBoolean() managerDone?: boolean;
  @IsOptional() @IsBoolean() o2oDone?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(5) rating?: number;
}

class KeyResultInput {
  @IsString() title!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
}

export class CreateObjectiveDto {
  @IsOptional() @IsString() cycleId?: string;
  @IsString() scope!: string;
  @IsString() ownerId!: string;
  @IsString() title!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => KeyResultInput) keyResults?: KeyResultInput[];
}

export class UpdateKeyResultDto {
  @IsInt() @Min(0) @Max(100) progress!: number;
}
