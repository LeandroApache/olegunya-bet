import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum DerbyTypeGql {
    DERBY = 'DERBY',
}

registerEnumType(DerbyTypeGql, { name: 'DerbyType' });

@ObjectType()
export class SeasonDerbyMatchGql {
    @Field(() => ID)
    id: string;

    @Field(() => ID)
    seasonId: string;

    @Field(() => ID)
    homeTeamId: string;

    @Field(() => ID)
    awayTeamId: string;

    @Field()
    homeTeamName: string;

    @Field()
    awayTeamName: string;

    @Field(() => DerbyTypeGql)
    type: DerbyTypeGql;
}

