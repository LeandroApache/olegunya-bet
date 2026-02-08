import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SportKey } from '../../generated/prisma';
import { LeagueService } from './league.service';
import { CreateLeagueInput, UpdateLeagueInput } from './dto/league.inputs';
import { LeagueGql } from './dto/league.types';

@Resolver(() => LeagueGql)
export class LeagueResolver {
    constructor(private readonly service: LeagueService) { }

    @Mutation(() => LeagueGql)
    createLeague(@Args('input') input: CreateLeagueInput) {
        return this.service.create(input);
    }

    @Query(() => [LeagueGql])
    leagues(@Args('sportKey', { type: () => SportKey, nullable: true }) sportKey?: SportKey) {
        return this.service.findAll(sportKey);
    }

    @Query(() => LeagueGql)
    league(@Args('id', { type: () => ID }) id: string) {
        return this.service.findById(id);
    }

    @Mutation(() => LeagueGql)
    updateLeague(@Args('input') input: UpdateLeagueInput) {
        return this.service.update(input);
    }

    @Mutation(() => Boolean)
    deleteLeague(@Args('id', { type: () => ID }) id: string) {
        return this.service.remove(id);
    }
}
