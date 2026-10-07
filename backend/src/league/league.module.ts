import { Module } from '@nestjs/common';
import { LeagueResolver } from './league.resolver';
import { LeagueService } from './league.service';
import { SeasonModule } from '../season/season.module';

@Module({
    imports: [SeasonModule],
    providers: [LeagueResolver, LeagueService],
})
export class LeagueModule { }
