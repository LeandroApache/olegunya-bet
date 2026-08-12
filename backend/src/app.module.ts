import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GqlAuthGuard } from './auth/guards/gql-auth.guard';

import { LeagueModule } from './league/league.module';
import { SeasonModule } from './season/season.module';
import { TeamModule } from './team/team.module';
import { MatchModule } from './match/match.module';
import { StrengthModule } from './strength/strength.module';
import { SportModule } from './sport/sport.module';
import { DerbyModule } from './derby/derby.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // В проде на Railway нет смысла писать в src/; schema рядом с cwd надёжнее.
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    AuthModule,
    LeagueModule,
    SeasonModule,
    TeamModule,
    MatchModule,
    StrengthModule,
    SportModule,
    DerbyModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: GqlAuthGuard,
    },
  ],
})
export class AppModule { }
