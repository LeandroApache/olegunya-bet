import { Module } from '@nestjs/common';
import { MatchModule } from '../match/match.module';
import { OddsPapiClient } from './odds-papi.client';
import { OddsPapiResolver } from './odds-papi.resolver';
import { OddsPapiService } from './odds-papi.service';

@Module({
  imports: [MatchModule],
  providers: [OddsPapiClient, OddsPapiService, OddsPapiResolver],
})
export class OddsPapiModule {}
