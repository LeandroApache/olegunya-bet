import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TeamGql {
    @Field(() => ID)
    id: string;

    @Field(() => ID)
    seasonId: string;

    @Field()
    seasonName: string;

    @Field()
    name: string;

    @Field(() => [String])
    aliases: string[];

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;
}
