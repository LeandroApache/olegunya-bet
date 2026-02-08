import { Module } from '@nestjs/common';
import { SportResolver } from './sport.resolver';
import { SportService } from './sport.service';

@Module({
    providers: [SportResolver, SportService],
})
export class SportModule { }
