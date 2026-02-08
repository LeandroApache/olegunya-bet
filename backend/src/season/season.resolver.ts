import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SeasonService } from './season.service';
import { CreateSeasonInput, UpdateSeasonInput } from './dto/season.inputs';
import { SeasonGql } from './dto/season.types';

@Resolver(() => SeasonGql)
export class SeasonResolver {
    constructor(private readonly service: SeasonService) { }

    @Mutation(() => SeasonGql)
    createSeason(@Args('input') input: CreateSeasonInput) {
        return this.service.create(input);
    }

    @Query(() => [SeasonGql])
    seasons(@Args('leagueId', { type: () => ID }) leagueId: string) {
        return this.service.findAll(leagueId);
    }

    @Query(() => SeasonGql)
    season(@Args('id', { type: () => ID }) id: string) {
        return this.service.findById(id);
    }

    @Mutation(() => SeasonGql)
    updateSeason(@Args('input') input: UpdateSeasonInput) {
        return this.service.update(input);
    }

    @Mutation(() => Boolean)
    deleteSeason(@Args('id', { type: () => ID }) id: string) {
        return this.service.remove(id);
    }
}
