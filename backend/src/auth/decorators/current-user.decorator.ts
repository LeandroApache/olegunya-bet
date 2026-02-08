import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export type CurrentUserPayload = {
    userId: string;
    email: string;
};

export const CurrentUser = createParamDecorator(
    (_: unknown, context: ExecutionContext): CurrentUserPayload => {
        const ctx = GqlExecutionContext.create(context);
        return ctx.getContext().req.user;
    },
);
