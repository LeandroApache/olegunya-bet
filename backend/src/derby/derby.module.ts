import { Module } from '@nestjs/common';
import { MatchModule } from '../match/match.module';
import { DerbyResolver } from './derby.resolver';
import { DerbyService } from './derby.service';

@Module({
    imports: [MatchModule],
    providers: [DerbyResolver, DerbyService],
})
export class DerbyModule { }
