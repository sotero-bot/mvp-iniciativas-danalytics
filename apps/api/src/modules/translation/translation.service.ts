import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type OverlayMap = Record<string, Record<string, string>>;

@Injectable()
export class TranslationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna overlay de traducciones para un conjunto de entidades.
   * Si locale === 'es', retorna vacío (es el idioma nativo de los campos en BD).
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

  /**
   * Upsert de traducciones para una entidad concreta.
   * Campos con valor vacío ('') o undefined se eliminan de Translation (borrado limpio).
   */
  async upsertForEntity(
    entityType: string,
    entityId: string,
    locale: string,
    fields: Record<string, string | undefined>,
  ): Promise<void> {
    const ops: Promise<unknown>[] = [];
    for (const [field, value] of Object.entries(fields)) {
      if (value && value.trim() !== '') {
        ops.push(
          this.prisma.translation.upsert({
            where: { entityType_entityId_field_locale: { entityType, entityId, field, locale } },
            create: { entityType, entityId, field, locale, value: value.trim() },
            update: { value: value.trim() },
          }),
        );
      } else {
        ops.push(
          this.prisma.translation.deleteMany({
            where: { entityType, entityId, field, locale },
          }),
        );
      }
    }
    await Promise.all(ops);
  }

  /**
   * Retorna overlay multi-locale para un conjunto de entidades.
   * Resultado: { entityId: { locale: { field: value } } }
   */
  async applyOverlayMultiLocale(
    entityType: string,
    ids: string[],
    locales: string[],
    fields: string[],
  ): Promise<Record<string, Record<string, Record<string, string>>>> {
    const nonEs = locales.filter(l => l !== 'es');
    if (ids.length === 0 || nonEs.length === 0) return {};

    const rows = await this.prisma.translation.findMany({
      where: { entityType, entityId: { in: ids }, locale: { in: nonEs }, field: { in: fields } },
      select: { entityId: true, locale: true, field: true, value: true },
    });

    const result: Record<string, Record<string, Record<string, string>>> = {};
    for (const row of rows) {
      if (!result[row.entityId]) result[row.entityId] = {};
      if (!result[row.entityId][row.locale]) result[row.entityId][row.locale] = {};
      result[row.entityId][row.locale][row.field] = row.value;
    }
    return result;
  }

  /** Upsert de traducciones para múltiples locales a la vez. */
  async upsertAllLocales(
    entityType: string,
    entityId: string,
    translations: Record<string, Record<string, string | undefined>>,
  ): Promise<void> {
    await Promise.all(
      Object.entries(translations).map(([locale, fields]) =>
        this.upsertForEntity(entityType, entityId, locale, fields),
      ),
    );
  }

  /**
   * Retorna las traducciones de una entidad para un locale dado como { field: value }.
   */
  async getForEntity(
    entityType: string,
    entityId: string,
    locale: string,
  ): Promise<Record<string, string>> {
    const rows = await this.prisma.translation.findMany({
      where: { entityType, entityId, locale },
      select: { field: true, value: true },
    });
    return Object.fromEntries(rows.map(r => [r.field, r.value]));
  }
}
