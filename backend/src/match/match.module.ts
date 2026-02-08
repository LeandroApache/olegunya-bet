import { Module } from '@nestjs/common';
import { MatchResolver } from './match.resolver';
import { MatchService } from './match.service';

@Module({
    providers: [MatchResolver, MatchService],
})
export class MatchModule { }
