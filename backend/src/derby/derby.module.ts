import { Module } from '@nestjs/common';
import { DerbyResolver } from './derby.resolver';
import { DerbyService } from './derby.service';

@Module({
    providers: [DerbyResolver, DerbyService],
})
export class DerbyModule { }

