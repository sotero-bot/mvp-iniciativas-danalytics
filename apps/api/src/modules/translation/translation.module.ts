import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [TranslationController],
  providers: [TranslationService, PrismaService],
  exports: [TranslationService],
})
export class TranslationModule {}
