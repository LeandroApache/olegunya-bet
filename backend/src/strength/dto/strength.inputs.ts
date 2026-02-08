import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { IsDateString, IsOptional, Min } from 'class-validator';

@InputType()
export class CreateStrengthSnapshotInput {
    @Field(() => ID)
    seasonId: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsDateString()
    toDate?: string;

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @Min(0.000001)
    halfLifeDays?: number;
}

@InputType()
export class CalculateOddsFromStrengthInput {
    @Field(() => ID)
    snapshotId: string;

    @Field(() => ID)
    homeTeamId: string;

    @Field(() => ID)
    awayTeamId: string;
}
