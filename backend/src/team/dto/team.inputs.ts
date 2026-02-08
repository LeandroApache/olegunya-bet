import { Field, ID, InputType } from '@nestjs/graphql';
import { ArrayMaxSize, IsOptional, MinLength } from 'class-validator';

@InputType()
export class CreateTeamInput {
    @Field(() => ID)
    seasonId: string;

    @Field()
    @MinLength(2)
    name: string;

    @Field(() => [String], { nullable: true })
    @IsOptional()
    @ArrayMaxSize(30)
    aliases?: string[];
}

@InputType()
export class UpdateTeamInput {
    @Field(() => ID)
    id: string;

    @Field({ nullable: true })
    @IsOptional()
    @MinLength(2)
    name?: string;

    @Field(() => [String], { nullable: true })
    @IsOptional()
    @ArrayMaxSize(30)
    aliases?: string[];
}
