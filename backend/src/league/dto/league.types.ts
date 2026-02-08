import { Field, ID, ObjectType } from '@nestjs/graphql';
import { SportKey } from '../../../generated/prisma'; // Prisma enum

@ObjectType()
export class LeagueGql {
  @Field(() => ID)
  id: string;

  @Field(() => SportKey)
  sportKey: SportKey;

  @Field()
  name: string;

    @Field(() => String, { nullable: true })
  country?: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
