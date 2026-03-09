import { Controller, Get, Post, Delete, Param, Body, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';
import { GenerarEnlaceActividadUseCase } from '../application/GenerarEnlaceActividadUseCase';
import { IniciarSesionPorEnlaceUseCase } from '../application/IniciarSesionPorEnlaceUseCase';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { BusinessRuleViolationError } from '../../../shared/domain/DomainError';
import { PrismaService } from '../../../prisma.service';

@Controller('admin/enlaces')
export class AdminEnlaceController {
    constructor(
        private readonly generarEnlaceUseCase: GenerarEnlaceActividadUseCase,
        private readonly prisma: PrismaService
    ) { }

    @Post('generar')
    async generar(@Body() body: { actividadId: string; nombre?: string }) {
        const enlace = await this.generarEnlaceUseCase.execute(body.actividadId, body.nombre);
        return {
            id: enlace.id,
            accessToken: enlace.accessToken,
            actividadId: enlace.actividadId,
            nombre: enlace.nombre,
        };
    }

    @Get()
    async listAll() {
        return this.prisma.enlaceActividad.findMany({
            where: { activo: true },
            orderBy: { createdAt: 'desc' },
            include: {
                actividad: {
                    include: {
                        iniciativa: { include: { empresa: true } }
                    }
                }
            }
        });
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string) {
        await this.prisma.enlaceActividad.update({
            where: { id },
            data: { activo: false }
        });
    }
}
