import { Controller } from '@nestjs/common';
import { AppService } from './app.service';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  // @Get()
  // getHello(): string {
  //   return this.appService.getHello();
  // }

  // @Get()
  // public async root(@Res() res: any): Promise<void> {
  //   res.sendFile(join(__dirname, '..', 'dist', 'index.html'));

  // }

}
