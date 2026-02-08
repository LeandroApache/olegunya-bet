import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthTokens, Me } from './dto/auth.types';
import { BootstrapUserInput, LoginInput } from './dto/auth.inputs';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Resolver()
export class AuthResolver {
    constructor(private readonly auth: AuthService) { }

    @Public()
    @Mutation(() => AuthTokens)
    bootstrapUser(@Args('input') input: BootstrapUserInput) {
        return this.auth.bootstrapUser(input.email, input.password);
    }

    @Public()
    @Mutation(() => AuthTokens)
    login(@Args('input') input: LoginInput) {
        return this.auth.login(input.email, input.password);
    }

    @Query(() => Me)
    me(@CurrentUser() user: CurrentUserPayload) {
        return { id: user.userId, email: user.email };
    }
}
