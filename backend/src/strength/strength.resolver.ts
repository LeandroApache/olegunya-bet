import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { StrengthService } from './strength.service';
import { CalculateOddsFromStrengthInput, CreateStrengthSnapshotInput } from './dto/strength.inputs';
import { OddsFromStrengthGql, StrengthSnapshotGql } from './dto/strength.types';

@Resolver(() => StrengthSnapshotGql)
export class StrengthResolver {
    constructor(private readonly service: StrengthService) { }

    @Mutation(() => StrengthSnapshotGql)
    createStrengthSnapshot(@Args('input') input: CreateStrengthSnapshotInput) {
        return this.service.createSnapshot(input);
    }

    @Query(() => StrengthSnapshotGql)
    strengthSnapshot(@Args('id', { type: () => ID }) id: string) {
        return this.service.getSnapshot(id);
    }

    @Query(() => OddsFromStrengthGql)
    calculateOddsFromStrength(@Args('input') input: CalculateOddsFromStrengthInput) {
        return this.service.calculateOddsFromStrength(input);
    }
}
