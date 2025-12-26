import { Request } from 'express';

export interface AuthRequest extends Request {
  user: {
    sub: number;
    email: string;
    type: "user" | "employee";   // ← YA NO string
    role: "admin" | "consulta" | null;
  };
}
