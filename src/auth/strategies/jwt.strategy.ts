// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET no está definido en las variables de entorno');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload)
    {
     const SUPER_ADMIN_EMAIL = "srgiorosales123@gmail.com";
 
     const isSuperAdmin = payload.email === SUPER_ADMIN_EMAIL;

       return {
         sub: payload.sub,
         email: payload.email,
         type: isSuperAdmin ? "admin" : (payload.type || "user"),
         role: isSuperAdmin ? "admin" : (payload.role || null),
       };
    }
}
