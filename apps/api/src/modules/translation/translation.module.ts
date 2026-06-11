import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { PrismaService } from '../../prisma.service';

@Module({
  providers: [TranslationService, PrismaService],
  exports: [TranslationService],
})
export class TranslationModule {}
