import { Module } from '@nestjs/common';
import { MatchResolver } from './match.resolver';
import { MatchService } from './match.service';

@Module({
    providers: [MatchResolver, MatchService],
    exports: [MatchService],
})
export class MatchModule { }
