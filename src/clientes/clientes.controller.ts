import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Delete,
  Body,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

import { promises as fs } from 'fs';
import { join } from 'path';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { VerifiedGuard } from 'src/auth/guards/verified.guard';
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @UseGuards(new RateLimitGuard(5, 60_000), RolesGuard)
  @Roles('employee-admin')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'key_path', maxCount: 1 },
        { name: 'cer_path', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/temp', // carpeta temporal inicial
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            callback(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
          },
        }),
      },
    ),
  )
  async create(
    @Body() createClienteDto: CreateClienteDto,
    @Req() req: AuthRequest,
    @UploadedFiles()
    files: {
      key_path?: Express.Multer.File[];
      cer_path?: Express.Multer.File[];
    },
  ) {
    const { rfc, fiel } = createClienteDto;
  
    // 1️⃣ Crear carpeta del RFC
    const clienteFolder = join('./uploads/clientes', rfc);
    await fs.mkdir(clienteFolder, { recursive: true });
  
    // 2️⃣ Mover archivos subidos a la carpeta del RFC
    let keyPath: string | undefined;
    let cerPath: string | undefined;
  
    if (files?.key_path && files.key_path.length > 0) {
      const originalKeyPath = files.key_path[0].path;
      const destKeyPath = join(clienteFolder, files.key_path[0].filename);
      await fs.rename(originalKeyPath, destKeyPath);
      keyPath = `/${destKeyPath.replace(/\\/g, '/')}`;
      createClienteDto.key_path = keyPath;
    }
  
    if (files?.cer_path && files.cer_path.length > 0) {
      const originalCerPath = files.cer_path[0].path;
      const destCerPath = join(clienteFolder, files.cer_path[0].filename);
      await fs.rename(originalCerPath, destCerPath);
      cerPath = `/${destCerPath.replace(/\\/g, '/')}`;
      createClienteDto.cer_path = cerPath;
    }
  
    // 3️⃣ Crear archivo .txt con FIEL (sin espacios)
    if (fiel) {
     const fielClean = fiel.replace(/\s+/g, '');
     const fielTxtPath = join(clienteFolder, 'fiel.txt');
     await fs.writeFile(fielTxtPath, fielClean, 'utf-8');
    }
  
    console.log('✅ Archivos guardados en carpeta RFC:', clienteFolder);

    const userId = req.user?.sub;  // <<--- EL ID REAL DEL JWT
    const userType = req.user?.type;
  
    return this.clientesService.create(createClienteDto, userId, userType);
  }


  @Get(':id')
  @UseGuards(new RateLimitGuard(60, 60_000))
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.clientesService.findOne(+id, userId, type);
  }
  
  @Patch(':id')
  @UseGuards(new RateLimitGuard(5, 60_000), RolesGuard)
  @Roles('employee-admin')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'key_path', maxCount: 1 },
        { name: 'cer_path', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/clientes',
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
          },
        }),
      },
    ),
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClienteDto,
    @Req() req: AuthRequest,
    @UploadedFiles()
    files: {
      key_path?: Express.Multer.File[];
      cer_path?: Express.Multer.File[];
    },
  ) {
    const userId = req.user.sub;
    const userType = req.user.type;
    // Guardamos la ruta completa si hay archivos nuevos
    if (files?.key_path && files.key_path.length > 0) {
      dto.key_path = `/${files.key_path[0].path.replace(/\\/g, '/')}`;
    }
  
    if (files?.cer_path && files.cer_path.length > 0) {
      dto.cer_path = `/${files.cer_path[0].path.replace(/\\/g, '/')}`;
    }
  
    return this.clientesService.update(+id, dto, userId, userType);
  }


  @Delete(':id')
  @UseGuards(new RateLimitGuard(60, 60_000), RolesGuard)
  @Roles('employee-admin')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const userId = req.user.sub;
    const userType = req.user.type;
    console.log("id del controlador", userId);
    return this.clientesService.remove(+id, userId, userType);
  }

  @Get()
  @UseGuards(new RateLimitGuard(200, 60_000))
  findAll(@Req() req: AuthRequest) {
      const userId = req.user.sub;
      const type = req.user.type;
    return this.clientesService.findAll(userId, type);
  }

  @Post('upload-own-firma')
  @UseGuards(new RateLimitGuard(100, 60_000), VerifiedGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cer', maxCount: 1 },
        { name: 'key', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/temp',
          filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
      },
    ),
  )
  async uploadOwnFirma(
    @Req() req: AuthRequest,
    @UploadedFiles()
    files: {
      cer?: Express.Multer.File[];
      key?: Express.Multer.File[];
    },
    @Body('fielPass') fielPass: string,
    @Body('rfc') rfc: string,
  ) {
    const userId = req.user.sub;
  
    if (!rfc) {
      throw new BadRequestException('No se recibió el RFC detectado.');
    }
  
    if (!files?.cer?.length || !files?.key?.length) {
      throw new BadRequestException('Se requieren archivos .cer y .key');
    }
  
    return this.clientesService.uploadOwnFirma({
      userId,
      cerFile: files.cer[0],
      keyFile: files.key[0],
      fielPass,
      rfc,
    });
  }

  @Post('update-certificates')
  @UseGuards(new RateLimitGuard(50, 60000), VerifiedGuard, RolesGuard)
  @Roles('owner')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cer', maxCount: 1 },
        { name: 'key', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/temp',
          filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
      },
    ),
  )
  async updateCertificates(
    @Req() req: AuthRequest,
    @UploadedFiles()
    files: {
      cer?: Express.Multer.File[];
      key?: Express.Multer.File[];
    },
    @Body('fielPass') fielPass: string,
    @Body('rfc') rfc?: string,
  ) {
    const userId = req.user.sub;
  
    if (!files?.cer?.length || !files?.key?.length) {
      throw new BadRequestException('Debes subir archivo .cer y .key');
    }
  
    if (!fielPass?.trim()) {
      throw new BadRequestException('La contraseña FIEL es requerida');
    }
  
    return this.clientesService.updateCertificates({
      userId,
      cerFile: files.cer[0],
      keyFile: files.key[0],
      fielPass,
      rfc,
    });
  }

  @Post('update-own-certificates')
  @UseGuards(new RateLimitGuard(50, 60000), VerifiedGuard, RolesGuard)
  @Roles('owner')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cer', maxCount: 1 },
        { name: 'key', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/temp',
          filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
          },
        }),
      },
    ),
  )
  async updateOwnCertificates(
    @Req() req: AuthRequest,
    @UploadedFiles()
    files: {
      cer?: Express.Multer.File[];
      key?: Express.Multer.File[];
    },
    @Body('fielPass') fielPass: string,
  ) {
    const userId = req.user.sub;
  
    if (!files?.cer?.length || !files?.key?.length) {
      throw new BadRequestException('Debes subir archivo .cer y .key');
    }
  
    if (!fielPass?.trim()) {
      throw new BadRequestException('La contraseña FIEL es requerida');
    }
  
    return this.clientesService.updateOwnCertificates({
      userId,
      cerFile: files.cer[0],
      keyFile: files.key[0],
      fielPass,
    });
  }

  @Patch(":rfc/pause-sync")
  @UseGuards(new RateLimitGuard(15, 60000), VerifiedGuard, RolesGuard)
  @Roles("owner")
  async pauseSync(@Req() req: AuthRequest, @Param("rfc") rfc: string) {
    return this.clientesService.pauseSync(req.user.sub, rfc);
  }

  @Patch(":rfc/resume-sync")
  @UseGuards(new RateLimitGuard(15, 60000), VerifiedGuard, RolesGuard)
  @Roles("owner")
  async resumeSync(@Req() req: AuthRequest, @Param("rfc") rfc: string) {
    return this.clientesService.resumeSync(req.user.sub, rfc);
  }

  @Patch("sync/toggle")
  @UseGuards(new RateLimitGuard(15, 60000), JwtAuthGuard, VerifiedGuard)
  async toggleSync(@Req() req: AuthRequest) {
    return this.clientesService.resumeSyncMe(req.user.sub);
  }
}