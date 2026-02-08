import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { SportKey } from '../../../generated/prisma'; // Prisma enum

registerEnumType(SportKey, {
    name: 'SportKey',
});

@ObjectType()
export class SportGql {
    @Field(() => ID)
    id: string;

    @Field(() => SportKey)
    key: SportKey;

    @Field()
    name: string;
}
