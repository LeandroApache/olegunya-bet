import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, Min, MinLength } from 'class-validator';

@InputType()
export class CreateSeasonInput {
    @Field(() => ID)
    leagueId: string;

    @Field()
    @MinLength(2)
    name: string;

    @Field()
    @Min(1.01)
    baseCoefHomeEqual: number;

    @Field()
    @Min(1.01)
    flipCoef: number;
}

@InputType()
export class UpdateSeasonInput {
    @Field(() => ID)
    id: string;

    @Field({ nullable: true })
    @IsOptional()
    @MinLength(2)
    name?: string;

    @Field({ nullable: true })
    @IsOptional()
    @Min(1.01)
    baseCoefHomeEqual?: number;

    @Field({ nullable: true })
    @IsOptional()
    @Min(1.01)
    flipCoef?: number;
}
