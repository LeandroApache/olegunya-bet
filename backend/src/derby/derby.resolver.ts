import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { DerbyService } from './derby.service';
import { CreateSeasonDerbyMatchInput, UpdateSeasonDerbyMatchInput } from './dto/derby.inputs';
import { SeasonDerbyMatchGql } from './dto/derby.types';

@Resolver(() => SeasonDerbyMatchGql)
export class DerbyResolver {
    constructor(private readonly service: DerbyService) { }

    @Query(() => [SeasonDerbyMatchGql])
    seasonDerbyMatches(@Args('seasonId', { type: () => ID }) seasonId: string) {
        return this.service.findAllBySeason(seasonId);
    }

    @Mutation(() => SeasonDerbyMatchGql)
    createSeasonDerbyMatch(@Args('input') input: CreateSeasonDerbyMatchInput) {
        return this.service.create(input);
    }

    @Mutation(() => SeasonDerbyMatchGql)
    updateSeasonDerbyMatch(@Args('input') input: UpdateSeasonDerbyMatchInput) {
        return this.service.update(input);
    }

    @Mutation(() => Boolean)
    deleteSeasonDerbyMatch(@Args('id', { type: () => ID }) id: string) {
        return this.service.remove(id);
    }
}

