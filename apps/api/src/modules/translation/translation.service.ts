import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type OverlayMap = Record<string, Record<string, string>>;

@Injectable()
export class TranslationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna overlay de traducciones para un conjunto de entidades.
   * Si locale === 'es', retorna vacío (es el idioma nativo de los campos en BD).
   * Para cada (entityId, field) que tenga fila en Translation, sobreescribe el valor.
   */
  async applyOverlay(
    entityType: string,
    ids: string[],
    locale: string,
    fields: string[],
  ): Promise<OverlayMap> {
    if (locale === 'es' || ids.length === 0) return {};

    const rows = await this.prisma.translation.findMany({
      where: { entityType, entityId: { in: ids }, locale, field: { in: fields } },
      select: { entityId: true, field: true, value: true },
    });

    const overlay: OverlayMap = {};
    for (const row of rows) {
      if (!overlay[row.entityId]) overlay[row.entityId] = {};
      overlay[row.entityId][row.field] = row.value;
    }
    return overlay;
  }
}
