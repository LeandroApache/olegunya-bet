import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SeasonGql {
    @Field(() => ID)
    id: string;

    @Field(() => ID)
    leagueId: string;

    @Field()
    leagueName: string;

    @Field()
    name: string; // "2025/26"

    @Field()
    baseCoefHomeEqual: number;

    @Field()
    flipCoef: number;

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;
}
