import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { IsDateString, IsOptional, Min } from 'class-validator';
import { MarketTypeGql } from './match.types';

@InputType()
export class CreateMatchInput {
    @Field(() => ID)
    seasonId: string;

    @Field(() => ID, { nullable: true })
    @IsOptional()
    tourId?: string;

    @Field()
    @IsDateString()
    date: string; // ISO string

    @Field(() => MarketTypeGql, { nullable: true })
    @IsOptional()
    marketType?: MarketTypeGql;

    @Field(() => ID)
    homeTeamId: string;

    @Field(() => ID)
    awayTeamId: string;

    @Field(() => Float)
    @Min(1.000001)
    kHome: number;

    @Field(() => Float)
    @Min(1.000001)
    kDraw: number;

    @Field(() => Float)
    @Min(1.000001)
    kAway: number;

    @Field(() => Float, { nullable: true })
    @IsOptional()
    total?: number;
}

@InputType()
export class UpdateMatchInput {
    @Field(() => ID)
    id: string;

    @Field(() => ID, { nullable: true })
    @IsOptional()
    tourId?: string | null;

    @Field({ nullable: true })
    @IsOptional()
    @IsDateString()
    date?: string;

    @Field(() => ID, { nullable: true })
    @IsOptional()
    homeTeamId?: string;

    @Field(() => ID, { nullable: true })
    @IsOptional()
    awayTeamId?: string;

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @Min(1.000001)
    kHome?: number;

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @Min(1.000001)
    kDraw?: number;

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @Min(1.000001)
    kAway?: number;

    @Field(() => Float, { nullable: true })
    @IsOptional()
    total?: number | null;
}
