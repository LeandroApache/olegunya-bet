import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StrengthValueGql {
    @Field(() => ID)
    teamId: string;

    @Field(() => String)
    teamName: string;

    @Field(() => Float)
    strength: number;
}

@ObjectType()
export class StrengthSnapshotGql {
    @Field(() => ID)
    id: string;

    @Field(() => ID)
    seasonId: string;

    @Field(() => Date, { nullable: true })
    fromDate?: Date | null;

    @Field(() => Date, { nullable: true })
    toDate?: Date | null;

    @Field(() => String)
    weightMode: string;

    @Field(() => Float, { nullable: true })
    halfLifeDays?: number | null;

    @Field(() => Date)
    createdAt: Date;

    @Field(() => [StrengthValueGql])
    values: StrengthValueGql[];
}

@ObjectType()
export class OddsFromStrengthGql {
    @Field(() => Float)
    coefficient: number;

    @Field()
    teamName: string;

    @Field()
    isHomeTeam: boolean;

    @Field(() => Float)
    delta: number;

    @Field(() => Float)
    impliedProbability: number;
}
