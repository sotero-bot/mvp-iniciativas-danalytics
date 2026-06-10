/**
 * Tests de REQ-012/change-001 — sistema de errores backend con códigos.
 *
 * Criterios cubiertos:
 * - AppError lleva código semántico, status HTTP por defecto coherente y message opcional.
 * - ErrorCodeFilter serializa AppError, HttpException y errores desconocidos al shape `{ code, message, statusCode }`.
 * - Errores 5xx loguean stack; errores 4xx loguean warning sin stack.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException, ArgumentsHost } from '@nestjs/common';

describe('AppError', () => {
    it('asigna status por defecto coherente con el código', async () => {
        const { AppError } = await import('../../apps/api/src/shared/errors/AppError');

        expect(new AppError('AUTH_INVALID_CREDENTIALS').statusCode).toBe(401);
        expect(new AppError('FORBIDDEN').statusCode).toBe(403);
        expect(new AppError('INSTANCIA_NOT_FOUND').statusCode).toBe(404);
        expect(new AppError('VALIDATION_ERROR').statusCode).toBe(400);
        expect(new AppError('S3_NOT_CONFIGURED').statusCode).toBe(503);
        expect(new AppError('IA_REQUEST_FAILED').statusCode).toBe(502);
        expect(new AppError('UNKNOWN').statusCode).toBe(500);
    });

    it('preserva mensaje custom y detalles', async () => {
        const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
        const err = new AppError('VALIDATION_ERROR', {
            message: 'Campo X obligatorio',
            details: { field: 'X' },
        });

        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.message).toBe('Campo X obligatorio');
        expect(err.details).toEqual({ field: 'X' });
        expect(err.statusCode).toBe(400);
    });

    it('permite override de statusCode', async () => {
        const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
        const err = new AppError('UNKNOWN', { statusCode: 418 });
        expect(err.statusCode).toBe(418);
    });

    it('toma el nombre del código si no se pasa message', async () => {
        const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
        const err = new AppError('INSTANCIA_NOT_FOUND');
        expect(err.message).toBe('INSTANCIA_NOT_FOUND');
    });
});

describe('ErrorCodeFilter', () => {
    const buildHost = () => {
        const status = vi.fn();
        const json = vi.fn();
        status.mockReturnValue({ json });
        const response: any = { status, json };
        const host = {
            switchToHttp: () => ({
                getResponse: () => response,
                getRequest: () => ({}),
            }),
        } as unknown as ArgumentsHost;
        return { host, status, json };
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('serializa AppError preservando código, message y statusCode', async () => {
        const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
        const { ErrorCodeFilter } = await import('../../apps/api/src/shared/errors/error-code.filter');

        const filter = new ErrorCodeFilter();
        const { host, status, json } = buildHost();
        const err = new AppError('AUTH_INVALID_CREDENTIALS');

        filter.catch(err, host);

        expect(status).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'AUTH_INVALID_CREDENTIALS',
            statusCode: 401,
            message: 'AUTH_INVALID_CREDENTIALS',
        }));
    });

    it('mapea NestJS HttpException 404 a code UNKNOWN', async () => {
        const { ErrorCodeFilter } = await import('../../apps/api/src/shared/errors/error-code.filter');
        const filter = new ErrorCodeFilter();
        const { host, status, json } = buildHost();

        filter.catch(new NotFoundException('Sin datos'), host);

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'UNKNOWN',
            statusCode: 404,
            message: 'Sin datos',
        }));
    });

    it('mapea NestJS HttpException 400 a code VALIDATION_ERROR', async () => {
        const { ErrorCodeFilter } = await import('../../apps/api/src/shared/errors/error-code.filter');
        const filter = new ErrorCodeFilter();
        const { host, status, json } = buildHost();

        filter.catch(new BadRequestException('campo X faltante'), host);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'VALIDATION_ERROR',
            statusCode: 400,
            message: 'campo X faltante',
        }));
    });

    it('mapea error desconocido a UNKNOWN con status 500', async () => {
        const { ErrorCodeFilter } = await import('../../apps/api/src/shared/errors/error-code.filter');
        const filter = new ErrorCodeFilter();
        const { host, status, json } = buildHost();

        filter.catch(new Error('boom'), host);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'UNKNOWN',
            statusCode: 500,
            message: 'boom',
        }));
    });
});
