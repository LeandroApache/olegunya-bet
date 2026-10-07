import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { IsDateString, IsOptional, Min, ValidateIf } from 'class-validator';
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
    @ValidateIf((_, v) => v != null)
    @Min(0.000001)
    total?: number;
}

/**
 * Pricing-only update. Teams / date / marketType / source / externalFixtureId
 * are intentionally not accepted.
 */
@InputType()
export class UpdateMatchInput {
    @Field(() => ID)
    id: string;

    @Field(() => Float)
    @Min(1.000001)
    kHome: number;

    @Field(() => Float)
    @Min(1.000001)
    kDraw: number;

    @Field(() => Float)
    @Min(1.000001)
    kAway: number;

    /** Pass null to clear total. Omit only if GraphQL client sends explicit null. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v != null)
    @Min(0.000001)
    total?: number | null;
}
