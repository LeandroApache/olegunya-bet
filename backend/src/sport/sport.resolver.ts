import { Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SportService } from './sport.service';
import { SportGql } from './dto/sport.types';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

@Resolver(() => SportGql)
export class SportResolver {
    constructor(private readonly sportService: SportService) { }

    @UseGuards(GqlAuthGuard)
    @Query(() => [SportGql])
    sports() {
        return this.sportService.findAll();
    }
}
