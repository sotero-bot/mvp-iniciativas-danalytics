import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Controllers
import { EmpresasController } from './modules/organization/interfaces/empresas.controller';
import { IniciativasController } from './modules/organization/interfaces/iniciativas.controller';
import { UsuariosController } from './modules/organization/interfaces/usuarios.controller';
import { ActividadesController } from './modules/methodology/interfaces/actividades.controller';
import { AdminExecutionController } from './modules/execution/interfaces/admin-execution.controller';
import { ExecutionController } from './modules/execution/interfaces/execution.controller';
import { AdminActividadesController } from './modules/methodology/interfaces/admin-actividades.controller';
import { AdminEnlaceController } from './modules/execution/interfaces/admin-enlace.controller';

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

// Repositories
import { PrismaInstanciaRepository } from './modules/execution/infrastructure/prisma/PrismaInstanciaRepository';
import { PrismaEnlaceActividadRepository } from './modules/execution/infrastructure/prisma/PrismaEnlaceActividadRepository';

// Modules
import { AuthModule } from './modules/auth/auth.module';

// Methodology Module Implementations
import { PrismaActividadRepository } from './modules/methodology/infrastructure/PrismaActividadRepository';
import { PrismaPasoActividadRepository } from './modules/methodology/infrastructure/PrismaPasoActividadRepository';
import { AgregarPasoActividadUseCase } from './modules/methodology/application/AgregarPasoActividadUseCase';
import { ObtenerPasosActividadUseCase } from './modules/methodology/application/ObtenerPasosActividadUseCase';

@Module({
  imports: [AuthModule],
  controllers: [
    EmpresasController,
    IniciativasController,
    UsuariosController,
    ActividadesController,
    AdminActividadesController,
    AdminExecutionController,
    AdminEnlaceController,
    ExecutionController
  ],
  providers: [
    PrismaService,
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
      useFactory: (repo) => new RegistrarRespuestaPorTokenUseCase(repo),
      inject: ['IInstanciaRepository'],
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
    }
  ],
})
export class AppModule { }
