import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('test')
export class AppController {
  @Get()
  getTest() {
    return { message: 'Conexión con CuentIA backend exitosa ✅' };
  }
  getHello() {
    return { message: 'Conexión con CuentIA backend exitosa ✅' };
  }
}

