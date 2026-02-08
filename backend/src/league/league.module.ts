import { Module } from '@nestjs/common';
import { LeagueResolver } from './league.resolver';
import { LeagueService } from './league.service';

@Module({
    providers: [LeagueResolver, LeagueService],
})
export class LeagueModule { }
