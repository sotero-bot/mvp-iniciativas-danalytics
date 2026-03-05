import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';

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
    );

    nestApp.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    nestApp.setGlobalPrefix('api'); // Ensure NestJS routes match Vercel's /api prefix if they don't already. Otherwise they will 404.
    /* Note: If your controllers already have @Controller('api/...') you can comment out setGlobalPrefix. 
       Usually, Vercel strips the /api part, or NestJS expects it. Safe approach is not to set it unless needed, 
       but let's avoid it here and let it route natively since standard behavior is for controllers to just be @Controller('users') etc. 
       Wait, actually, I will configure Vercel to route /api/(.*) to this index, which passes the original URL (e.g., /api/users).
       So NestJS will see /api/users. If your controllers don't have the 'api' prefix, we must use setGlobalPrefix('api').
    */
    nestApp.setGlobalPrefix('api');

    await nestApp.init();
    return nestApp;
};

export default async (req: any, res: any) => {
    await createNestServer(server);
    server(req, res);
};
