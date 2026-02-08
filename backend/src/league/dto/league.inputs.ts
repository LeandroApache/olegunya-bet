import { Field, InputType } from '@nestjs/graphql';
import { MinLength, IsOptional } from 'class-validator';
import { SportKey } from '../../../generated/prisma';

@InputType()
export class CreateLeagueInput {
  @Field(() => SportKey)
  sportKey: SportKey;

  @Field()
  @MinLength(2)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  country?: string;
}

@InputType()
export class UpdateLeagueInput {
    @Field(() => String)
  id: string;

  @Field(() => SportKey, { nullable: true })
  @IsOptional()
  sportKey?: SportKey;

  @Field({ nullable: true })
  @IsOptional()
  @MinLength(2)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  country?: string;
}
