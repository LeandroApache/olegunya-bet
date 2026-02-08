import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TeamService } from './team.service';
import { CreateTeamInput, UpdateTeamInput } from './dto/team.inputs';
import { TeamGql } from './dto/team.types';

@Resolver(() => TeamGql)
export class TeamResolver {
    constructor(private readonly service: TeamService) { }

    @Mutation(() => TeamGql)
    createTeam(@Args('input') input: CreateTeamInput) {
        return this.service.create(input);
    }

    @Query(() => [TeamGql])
    teams(@Args('seasonId', { type: () => ID }) seasonId: string) {
        return this.service.findAll(seasonId);
    }

    @Query(() => TeamGql)
    team(@Args('id', { type: () => ID }) id: string) {
        return this.service.findById(id);
    }

    @Mutation(() => TeamGql)
    updateTeam(@Args('input') input: UpdateTeamInput) {
        return this.service.update(input);
    }

    @Mutation(() => Boolean)
    deleteTeam(@Args('id', { type: () => ID }) id: string) {
        return this.service.remove(id);
    }

    // пригодится для ввода матчей/нормализации
    @Query(() => TeamGql, { nullable: true })
    findTeam(
        @Args('seasonId', { type: () => ID }) seasonId: string,
        @Args('query') query: string,
    ) {
        return this.service.findByNameOrAlias(seasonId, query);
    }
}
