import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AuthTokens {
    @Field()
    accessToken: string;
}

@ObjectType()
export class Me {
    @Field()
    id: string;

    @Field()
    email: string;
}
