import { Field, ID, InputType } from '@nestjs/graphql';
import { DerbyTypeGql } from './derby.types';

@InputType()
export class CreateSeasonDerbyMatchInput {
    @Field(() => ID)
    seasonId: string;

    @Field(() => ID)
    homeTeamId: string;

    @Field(() => ID)
    awayTeamId: string;

    @Field(() => DerbyTypeGql)
    type: DerbyTypeGql;
}

@InputType()
export class UpdateSeasonDerbyMatchInput {
    @Field(() => ID)
    id: string;

    @Field(() => DerbyTypeGql, { nullable: true })
    type?: DerbyTypeGql;
}

