import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class InitiateUploadDto {
  @IsString()
  @MaxLength(150)
  title: string;

  @IsString()
  @MaxLength(255)
  filename: string;

  @IsString()
  @MaxLength(100)
  contentType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;

  @IsInt()
  @Min(1)
  partCount: number;
}
