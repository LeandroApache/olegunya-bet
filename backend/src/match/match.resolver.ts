import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MatchService } from './match.service';
import { CreateMatchInput, UpdateMatchInput } from './dto/match.inputs';
import { MatchGql, MatchesPageGql } from './dto/match.types';

@Resolver(() => MatchGql)
export class MatchResolver {
    constructor(private readonly service: MatchService) { }

    @Mutation(() => MatchGql)
    createMatch(@Args('input') input: CreateMatchInput) {
        return this.service.create(input);
    }

    @Query(() => [MatchGql])
    matches(@Args('seasonId', { type: () => ID }) seasonId: string) {
        return this.service.findAllBySeason(seasonId);
    }

    @Query(() => MatchesPageGql)
    matchesPaginated(
        @Args('seasonId', { type: () => ID }) seasonId: string,
        @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page?: number,
        @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.service.findAllBySeasonPaginated(seasonId, page, pageSize);
    }

    @Query(() => MatchGql)
    match(@Args('id', { type: () => ID }) id: string) {
        return this.service.findById(id);
    }

    @Mutation(() => MatchGql)
    updateMatch(@Args('input') input: UpdateMatchInput) {
        return this.service.update(input);
    }

    @Mutation(() => Boolean)
    deleteMatch(@Args('id', { type: () => ID }) id: string) {
        return this.service.remove(id);
    }
}
