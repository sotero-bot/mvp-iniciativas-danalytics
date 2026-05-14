import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';
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

    nestApp.setGlobalPrefix('api');

    await nestApp.init();
    return nestApp;
};

export default async (req: any, res: any) => {
    await createNestServer(server);
    server(req, res);
};
