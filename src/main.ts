import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  console.log('JWT_ACCESS_SECRET =', process.env.JWT_ACCESS_SECRET);

  app.use(cookieParser());   // ⬅⬅ OBLIGATORIO PARA LEER COOKIES

  app.enableCors({
    origin: 'http://localhost:4000', // frontend
    credentials: true,
  });

  app.use(
    '/stripe/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

  /**
   * ✅ Body parsers normales para el resto de la app
   * (NO se aplican al webhook)
   */
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina campos no definidos en DTO
      forbidNonWhitelisted: true, // lanza error si envías campos de más
      transform: true, // transforma tipos automáticamente (ej. string -> number)
    }),
  );


  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
