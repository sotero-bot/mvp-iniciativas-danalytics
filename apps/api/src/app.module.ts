import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { S3Service } from './modules/storage/S3Service';

// Controllers
import { EmpresasController } from './modules/organization/interfaces/empresas.controller';
import { IniciativasController } from './modules/organization/interfaces/iniciativas.controller';
import { UsuariosController } from './modules/organization/interfaces/usuarios.controller';
import { ActividadesController } from './modules/methodology/interfaces/actividades.controller';
import { AdminExecutionController } from './modules/execution/interfaces/admin-execution.controller';
import { ExecutionController } from './modules/execution/interfaces/execution.controller';
import { AdminActividadesController } from './modules/methodology/interfaces/admin-actividades.controller';
import { AdminEnlaceController } from './modules/execution/interfaces/admin-enlace.controller';
import { AdminPlantillasController } from './modules/methodology/interfaces/admin-plantillas.controller';
import { AdminPlantillaPasosController } from './modules/methodology/interfaces/admin-plantilla-pasos.controller';
import { AdminImportController } from './modules/organization/interfaces/admin-import.controller';
import { AdminUsersController } from './modules/users/interfaces/admin-users.controller';
import { AdminProgramasController } from './modules/programas/interfaces/admin-programas.controller';
import { AdminGruposController } from './modules/grupos/interfaces/admin-grupos.controller';
import { FacilitadorGruposController } from './modules/grupos/interfaces/facilitador-grupos.controller';
import { FacilitadorAsistenciaController } from './modules/asistencia/interfaces/facilitador-asistencia.controller';
import { AdminAsistenciaController } from './modules/asistencia/interfaces/admin-asistencia.controller';
import { FacilitadorObservacionesController } from './modules/observaciones/interfaces/facilitador-observaciones.controller';
import { AdminObservacionesController } from './modules/observaciones/interfaces/admin-observaciones.controller';
import { AdminNotificacionesController } from './modules/notificaciones/interfaces/admin-notificaciones.controller';
import { InternalJobsController } from './modules/notificaciones/interfaces/internal-jobs.controller';
import { ActorSesionesController } from './modules/sesiones/interfaces/actor-sesiones.controller';

// Use Cases
import { GenerarInstanciaUseCase } from './modules/execution/application/GenerarInstanciaUseCase';
import { AccederInstanciaPorTokenUseCase } from './modules/execution/application/AccederInstanciaPorTokenUseCase';
import { IniciarInstanciaPorTokenUseCase } from './modules/execution/application/IniciarInstanciaPorTokenUseCase';
import { RegistrarRespuestaPorTokenUseCase } from './modules/execution/application/RegistrarRespuestaPorTokenUseCase';
import { FinalizarInstanciaPorTokenUseCase } from './modules/execution/application/FinalizarInstanciaPorTokenUseCase';
import { ObtenerInstanciaDetalleUseCase } from './modules/execution/application/ObtenerInstanciaDetalleUseCase';
import { AsignarUsuarioPorTokenUseCase } from './modules/execution/application/AsignarUsuarioPorTokenUseCase';
import { GenerarEnlaceActividadUseCase } from './modules/execution/application/GenerarEnlaceActividadUseCase';
import { IniciarSesionPorEnlaceUseCase } from './modules/execution/application/IniciarSesionPorEnlaceUseCase';
import { ConsultarIaPorTokenUseCase } from './modules/execution/application/ConsultarIaPorTokenUseCase';
import { SintetizarCanvasPorTokenUseCase } from './modules/execution/application/SintetizarCanvasPorTokenUseCase';
import { InstanciarPlantillaUseCase } from './modules/methodology/application/InstanciarPlantillaUseCase';

// Repositories
import { PrismaInstanciaRepository } from './modules/execution/infrastructure/prisma/PrismaInstanciaRepository';
import { PrismaEnlaceActividadRepository } from './modules/execution/infrastructure/prisma/PrismaEnlaceActividadRepository';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { TranslationModule } from './modules/translation/translation.module';
import { TranslationService } from './modules/translation/translation.service';
import { EmailModule } from './modules/email/email.module';

// Methodology Module Implementations
import { PrismaActividadRepository } from './modules/methodology/infrastructure/PrismaActividadRepository';
import { PrismaPasoActividadRepository } from './modules/methodology/infrastructure/PrismaPasoActividadRepository';
import { AgregarPasoActividadUseCase } from './modules/methodology/application/AgregarPasoActividadUseCase';
import { ObtenerPasosActividadUseCase } from './modules/methodology/application/ObtenerPasosActividadUseCase';

@Module({
  imports: [AuthModule, TranslationModule, EmailModule],
  controllers: [
    EmpresasController,
    IniciativasController,
    UsuariosController,
    ActividadesController,
    AdminActividadesController,
    AdminExecutionController,
    AdminEnlaceController,
    ExecutionController,
    AdminPlantillasController,
    AdminPlantillaPasosController,
    AdminImportController,
    AdminUsersController,
    AdminProgramasController,
    AdminGruposController,
    FacilitadorGruposController,
    FacilitadorAsistenciaController,
    AdminAsistenciaController,
    FacilitadorObservacionesController,
    AdminObservacionesController,
    AdminNotificacionesController,
    InternalJobsController,
    ActorSesionesController,
  ],
  providers: [
    PrismaService,
    S3Service,
    {
      provide: 'IInstanciaRepository',
      useFactory: (prisma: PrismaService) => new PrismaInstanciaRepository(prisma as any),
      inject: [PrismaService],
    },
    {
      provide: GenerarInstanciaUseCase,
      useFactory: (repo) => new GenerarInstanciaUseCase(repo),
      inject: ['IInstanciaRepository'],
    },
    {
      provide: AccederInstanciaPorTokenUseCase,
      useFactory: (repo) => new AccederInstanciaPorTokenUseCase(repo),
      inject: ['IInstanciaRepository'],
    },
    {
      provide: IniciarInstanciaPorTokenUseCase,
      useFactory: (repo) => new IniciarInstanciaPorTokenUseCase(repo),
      inject: ['IInstanciaRepository'],
    },
    {
      provide: RegistrarRespuestaPorTokenUseCase,
      useFactory: (repo, prisma) => new RegistrarRespuestaPorTokenUseCase(repo, prisma),
      inject: ['IInstanciaRepository', PrismaService],
    },
    {
      provide: FinalizarInstanciaPorTokenUseCase,
      useFactory: (repo) => new FinalizarInstanciaPorTokenUseCase(repo),
      inject: ['IInstanciaRepository'],
    },
    {
      provide: ObtenerInstanciaDetalleUseCase,
      useFactory: (repo) => new ObtenerInstanciaDetalleUseCase(repo),
      inject: ['IInstanciaRepository'],
    },
    {
      provide: AsignarUsuarioPorTokenUseCase,
      useFactory: (repo, prisma) => new AsignarUsuarioPorTokenUseCase(repo, prisma),
      inject: ['IInstanciaRepository', PrismaService],
    },
    {
      provide: ConsultarIaPorTokenUseCase,
      useFactory: (accederUseCase, prisma) => new ConsultarIaPorTokenUseCase(accederUseCase, prisma),
      inject: [AccederInstanciaPorTokenUseCase, PrismaService],
    },
    {
      provide: SintetizarCanvasPorTokenUseCase,
      useFactory: (prisma: PrismaService) => new SintetizarCanvasPorTokenUseCase(prisma),
      inject: [PrismaService],
    },
    // Enlace multi-persona
    {
      provide: 'IEnlaceActividadRepository',
      useFactory: (prisma: PrismaService) => new PrismaEnlaceActividadRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: GenerarEnlaceActividadUseCase,
      useFactory: (repo) => new GenerarEnlaceActividadUseCase(repo),
      inject: ['IEnlaceActividadRepository'],
    },
    {
      provide: IniciarSesionPorEnlaceUseCase,
      useFactory: (enlaceRepo, instanciaRepo) => new IniciarSesionPorEnlaceUseCase(enlaceRepo, instanciaRepo),
      inject: ['IEnlaceActividadRepository', 'IInstanciaRepository'],
    },
    // Mock Provider for controllers injecting raw prisma
    {
      provide: 'PrismaClient',
      useExisting: PrismaService
    },
    // Methodology Module Providers
    {
      provide: 'IActividadRepository',
      useFactory: (prisma: PrismaService) => new PrismaActividadRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IPasoActividadRepository',
      useFactory: (prisma: PrismaService) => new PrismaPasoActividadRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: AgregarPasoActividadUseCase,
      useFactory: (actRepo, pasoRepo) => new AgregarPasoActividadUseCase(actRepo, pasoRepo),
      inject: ['IActividadRepository', 'IPasoActividadRepository'],
    },
    {
      provide: ObtenerPasosActividadUseCase,
      useFactory: (actRepo, pasoRepo) => new ObtenerPasosActividadUseCase(actRepo, pasoRepo),
      inject: ['IActividadRepository', 'IPasoActividadRepository'],
    },
    {
      provide: InstanciarPlantillaUseCase,
      useFactory: (prisma: PrismaService) => new InstanciarPlantillaUseCase(prisma),
      inject: [PrismaService],
    },
    TranslationService,
  ],
})
export class AppModule { }
