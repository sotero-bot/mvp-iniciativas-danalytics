import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';
import { ErrorCodeFilter } from '../apps/api/src/shared/errors/error-code.filter';
import { json, urlencoded } from 'express';

const express = require('express');
const server = express();
let nestApp: any = null;

export const createNestServer = async (expressInstance: any) => {
    if (nestApp) {
        return nestApp;
    }

    nestApp = await NestFactory.create(
        AppModule,
        new ExpressAdapter(expressInstance),
        { bodyParser: false },
    );

    nestApp.use(json({ limit: '5mb' }));
    nestApp.use(urlencoded({ limit: '5mb', extended: true }));

    nestApp.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    // Igual que main.ts: serializa los AppError como { code, message, statusCode }
    // para que el frontend mapee code → t('errors:CODE'). Sin esto, prod emitía la
    // forma por defecto de Nest ({ statusCode, message }) y el front mostraba
    // "sesión expiró" en cualquier 401 (p. ej. credenciales inválidas).
    nestApp.useGlobalFilters(new ErrorCodeFilter());

    nestApp.setGlobalPrefix('api');

    await nestApp.init();
    return nestApp;
};

export default async (req: any, res: any) => {
    await createNestServer(server);
    server(req, res);
};
