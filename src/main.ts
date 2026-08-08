import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { NestExpressApplication } from '@nestjs/platform-express'; // Add this import

dotenv.config(); // Load environment variables from .env file

async function bootstrap() {
  // const app = await NestFactory.create(AppModule);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // transform: true,
      // forbidNonWhitelisted: true,
      // forbidUnknownValues: true,
    }),
  );

  app.enableCors();
  
  app.setViewEngine('hbs');
  app.setBaseViewsDir(join(__dirname, '..', 'views'));

  await app.listen(30003);
  // await app.listen(3000);
  console.log('server up and running hello');
  console.log(`Application running at ${await app.getUrl()}`)
}
bootstrap();
