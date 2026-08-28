import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // forbidNonWhitelisted: true,
      // forbidUnknownValues: true,
    }),
  );

  // CORS: restrict origins via env (comma-separated); allow all when unset.
  const corsOrigins = process.env.CORS_ORIGINS;
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
  });

  app.setViewEngine('hbs');
  app.setBaseViewsDir(join(__dirname, '..', 'views'));

  // Swagger API docs at /api
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SWIFTNFAST API')
    .setDescription('SWIFTNFAST backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 30003;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log('server up and running');
  logger.log(`Application running at ${await app.getUrl()}`);
}
bootstrap();
