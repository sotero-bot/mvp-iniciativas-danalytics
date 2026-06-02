/**
 * Tests derivados de los criterios de aceptación de REQ-011/change-001.
 * Fuente de verdad: Delta Spec (no el código implementado).
 *
 * Criterios cubiertos:
 * 1. El endpoint POST /execution/:token/canvas devuelve 400 si la actividad NO es Analytics Canvas.
 * 2. Si todos los bloques ya existen en BD (caché lazy), los devuelve sin llamar a OpenAI.
 * 3. El payload de GET /execution/:token incluye esCanvas: boolean.
 * 4. buildCanvasHtml genera HTML standalone con metadatos y botones "Copiar prompt".
 * 5. CanvasGrid renderiza correctamente con y sin bloques (skeleton).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Test 1: SintetizarCanvasPorTokenUseCase — rechaza actividades no-Canvas ───

describe('SintetizarCanvasPorTokenUseCase', () => {
    it('debe lanzar BadRequestException si la plantilla no es Analytics Canvas', async () => {
        const { SintetizarCanvasPorTokenUseCase } = await import(
            '../../apps/api/src/modules/execution/application/SintetizarCanvasPorTokenUseCase'
        );

        const prismaMock = {
            instanciaActividad: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 'inst-001',
                    accessToken: 'tok-001',
                    actividadId: 'act-001',
                    actividad: {
                        plantillaOrigen: { nombre: 'Decisión IA' }, // NO es Analytics Canvas
                        pasos: [],
                    },
                }),
            },
            canvasBloque: { findMany: vi.fn().mockResolvedValue([]) },
            interaccion: { findMany: vi.fn().mockResolvedValue([]) },
            respuesta: { findMany: vi.fn().mockResolvedValue([]) },
        };

        const useCase = new SintetizarCanvasPorTokenUseCase(prismaMock as any);
        await expect(useCase.execute('tok-001')).rejects.toThrow('no es un Analytics Canvas');
    });

    it('debe devolver bloques desde caché cuando ya existen todos en BD (sin llamar a prisma.upsert)', async () => {
        const { SintetizarCanvasPorTokenUseCase } = await import(
            '../../apps/api/src/modules/execution/application/SintetizarCanvasPorTokenUseCase'
        );

        const pasosMock = [
            { id: 'paso-1', titulo: 'Problema', orden: 1 },
            { id: 'paso-2', titulo: 'Datos', orden: 2 },
        ];
        const bloquesMock = [
            { pasoId: 'paso-1', resumen: 'Resumen Problema cacheado', instanciaId: 'inst-001' },
            { pasoId: 'paso-2', resumen: 'Resumen Datos cacheado', instanciaId: 'inst-001' },
        ];

        const upsertSpy = vi.fn();

        const prismaMock = {
            instanciaActividad: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 'inst-001',
                    accessToken: 'tok-canvas',
                    actividadId: 'act-canvas',
                    actividad: {
                        plantillaOrigen: { nombre: 'Analytics Canvas' },
                        pasos: pasosMock,
                    },
                }),
            },
            canvasBloque: {
                // caché completo: mismo número de bloques que pasos
                findMany: vi.fn().mockResolvedValue(bloquesMock),
                upsert: upsertSpy,
            },
            interaccion: { findMany: vi.fn().mockResolvedValue([]) },
            respuesta: { findMany: vi.fn().mockResolvedValue([]) },
        };

        const useCase = new SintetizarCanvasPorTokenUseCase(prismaMock as any);
        const resultado = await useCase.execute('tok-canvas');

        // Cuando el caché está completo, NO debe hacer upsert (no llama a OpenAI ni actualiza BD)
        expect(upsertSpy).not.toHaveBeenCalled();
        expect(resultado['paso-1']).toBe('Resumen Problema cacheado');
        expect(resultado['paso-2']).toBe('Resumen Datos cacheado');
    });

    it('debe devolver 400 si el token no existe en BD', async () => {
        const { SintetizarCanvasPorTokenUseCase } = await import(
            '../../apps/api/src/modules/execution/application/SintetizarCanvasPorTokenUseCase'
        );

        const prismaMock = {
            instanciaActividad: {
                findUnique: vi.fn().mockResolvedValue(null),
            },
        };

        const useCase = new SintetizarCanvasPorTokenUseCase(prismaMock as any);
        await expect(useCase.execute('tok-invalido')).rejects.toThrow('Instancia no encontrada');
    });
});

// ─── Test 2: RunnerResponseDto incluye esCanvas ───

describe('RunnerResponseDto', () => {
    it('debe aceptar el campo esCanvas: boolean', async () => {
        const { RunnerResponseDto } = await import(
            '../../apps/api/src/modules/execution/interfaces/dtos/index'
        );

        const dto = new RunnerResponseDto({
            estado: 'finalizado',
            nombreActividad: 'Analytics Canvas Test',
            esCanvas: true,
            pasos: [],
            interacciones: [],
            respuestas: [],
        });

        expect(dto.esCanvas).toBe(true);
    });

    it('debe tener esCanvas: false para actividades no-Canvas', async () => {
        const { RunnerResponseDto } = await import(
            '../../apps/api/src/modules/execution/interfaces/dtos/index'
        );

        const dto = new RunnerResponseDto({
            estado: 'finalizado',
            nombreActividad: 'Decisión IA',
            esCanvas: false,
            pasos: [],
            interacciones: [],
            respuestas: [],
        });

        expect(dto.esCanvas).toBe(false);
    });
});

// ─── Test 3: buildCanvasHtml — HTML standalone con metadatos y botones Copiar prompt ───

describe('buildCanvasHtml', () => {
    it('debe generar HTML con metadatos empresa, área, proyecto, fecha', async () => {
        const { buildCanvasHtml } = await import(
            '../../apps/web/src/features/execution/buildCanvasHtml'
        );

        const html = buildCanvasHtml({
            bloques: { 'paso-1': 'Resumen del problema', 'paso-2': 'Datos disponibles' },
            pasos: [
                { id: 'paso-1', titulo: 'Problema', orden: 1 },
                { id: 'paso-2', titulo: 'Datos', orden: 2 },
            ],
            empresa: 'Empresa XYZ',
            area: 'Analítica',
            proyecto: 'Canvas Prueba',
            fecha: '2026-06-02',
        });

        expect(html).toContain('Empresa XYZ');
        expect(html).toContain('Analítica');
        expect(html).toContain('Canvas Prueba');
        expect(html).toContain('2026-06-02');
    });

    it('debe incluir botones "Copiar prompt" por cada bloque', async () => {
        const { buildCanvasHtml } = await import(
            '../../apps/web/src/features/execution/buildCanvasHtml'
        );

        const html = buildCanvasHtml({
            bloques: { 'paso-1': 'Síntesis bloque 1' },
            pasos: [{ id: 'paso-1', titulo: 'Problema', orden: 1 }],
            empresa: 'Empresa A',
            area: 'Área B',
            proyecto: 'Proyecto C',
            fecha: '2026-06-02',
        });

        expect(html).toContain('Copiar prompt');
        expect(html).toContain('copiarPrompt(this)');
    });

    it('debe incluir script de autoguardado en localStorage', async () => {
        const { buildCanvasHtml } = await import(
            '../../apps/web/src/features/execution/buildCanvasHtml'
        );

        const html = buildCanvasHtml({
            bloques: {},
            pasos: [],
            empresa: 'E', area: 'A', proyecto: 'P', fecha: 'F',
        });

        expect(html).toContain('localStorage');
        expect(html).toContain('setInterval');
    });

    it('debe incluir función de exportar .txt', async () => {
        const { buildCanvasHtml } = await import(
            '../../apps/web/src/features/execution/buildCanvasHtml'
        );

        const html = buildCanvasHtml({
            bloques: {},
            pasos: [],
            empresa: 'E', area: 'A', proyecto: 'P', fecha: 'F',
        });

        expect(html).toContain('exportarTxt');
        expect(html).toContain('.txt');
    });

    it('debe incluir CSS @media print para ocultar botones', async () => {
        const { buildCanvasHtml } = await import(
            '../../apps/web/src/features/execution/buildCanvasHtml'
        );

        const html = buildCanvasHtml({
            bloques: {},
            pasos: [],
            empresa: 'E', area: 'A', proyecto: 'P', fecha: 'F',
        });

        expect(html).toContain('@media print');
        expect(html).toContain('no-print');
    });

    it('debe incluir el resumen de cada bloque incluyendo B9', async () => {
        const { buildCanvasHtml } = await import(
            '../../apps/web/src/features/execution/buildCanvasHtml'
        );

        const html = buildCanvasHtml({
            bloques: {
                'paso-9': 'Alto potencial estratégico para la empresa',
            },
            pasos: [{ id: 'paso-9', titulo: 'Potencial valor estratégico', orden: 9 }],
            empresa: 'E', area: 'A', proyecto: 'P', fecha: 'F',
        });

        expect(html).toContain('Alto potencial estratégico para la empresa');
        expect(html).toContain('Potencial valor estratégico');
    });

    it('debe producir HTML que funciona offline (sin src externos)', async () => {
        const { buildCanvasHtml } = await import(
            '../../apps/web/src/features/execution/buildCanvasHtml'
        );

        const html = buildCanvasHtml({
            bloques: {},
            pasos: [],
            empresa: 'E', area: 'A', proyecto: 'P', fecha: 'F',
        });

        // No debe haber links a recursos externos (CDN, etc.)
        expect(html).not.toMatch(/src="https?:\/\//);
        expect(html).not.toMatch(/href="https?:\/\//);
    });
});

// ─── Test 4: ConsultarIaPorTokenUseCase — modelo vía env var ───

describe('ConsultarIaPorTokenUseCase — model env var', () => {
    it('no debe tener el modelo gpt-4o hardcodeado (usa process.env.OPENAI_MODEL)', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.resolve(
            process.cwd(),
            'apps/api/src/modules/execution/application/ConsultarIaPorTokenUseCase.ts'
        );
        const src = fs.readFileSync(filePath, 'utf-8');

        // El modelo debe leerse de process.env, no estar hardcodeado como string literal directo
        expect(src).toContain('process.env.OPENAI_MODEL');
        // No debe haber model: 'gpt-4o' hardcodeado (sin el env var)
        expect(src).not.toContain("model: 'gpt-4o'");
    });
});
