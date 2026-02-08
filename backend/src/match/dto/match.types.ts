import { Field, Float, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum MarketTypeGql {
    MATCH_1X2_REGULAR_TIME = 'MATCH_1X2_REGULAR_TIME',
}

registerEnumType(MarketTypeGql, { name: 'MarketType' });

@ObjectType()
export class MatchComputedGql {
    @Field(() => Float)
    baseProbUsed: number;

    @Field(() => Float)
    pHomeImplied: number;

    @Field(() => Float)
    pDrawImplied: number;

    @Field(() => Float)
    pAwayImplied: number;

    @Field(() => Float)
    deltaHome: number;

    @Field(() => Float)
    deltaAway: number;
}


@ObjectType()
export class MatchGql {
    @Field(() => ID)
    id: string;

    @Field(() => ID)
    seasonId: string;

    @Field(() => ID, { nullable: true })
    tourId?: string | null;

    @Field()
    date: Date;

    @Field(() => MarketTypeGql)
    marketType: MarketTypeGql;

    @Field(() => ID)
    homeTeamId: string;

    @Field(() => ID)
    awayTeamId: string;

    @Field()
    homeTeamName: string;

    @Field()
    awayTeamName: string;

    @Field(() => Float)
    kHome: number;

    @Field(() => Float)
    kDraw: number;

    @Field(() => Float)
    kAway: number;

    @Field(() => Float, { nullable: true })
    total?: number | null;

    @Field(() => MatchComputedGql, { nullable: true })
    computed?: MatchComputedGql | null;

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;
}

@ObjectType()
export class MatchesPageGql {
    @Field(() => [MatchGql])
    matches: MatchGql[];

    @Field(() => Float)
    totalCount: number;

    @Field(() => Float)
    page: number;

    @Field(() => Float)
    pageSize: number;

    @Field(() => Float)
    totalPages: number;
}
