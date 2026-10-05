import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class AskDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}

export class WeightChargeDto {
  @IsIn(['USA', 'UK'])
  country: 'USA' | 'UK';

  @IsInt()
  @Min(0)
  grams: number;
}
