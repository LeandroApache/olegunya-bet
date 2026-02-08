import { Module } from '@nestjs/common';
import { StrengthResolver } from './strength.resolver';
import { StrengthService } from './strength.service';

@Module({
    providers: [StrengthResolver, StrengthService],
})
export class StrengthModule { }
