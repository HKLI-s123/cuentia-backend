// src/types/express.d.ts
import 'express';

declare module 'express' {
  export interface User {
    sub: number;
    email: string;
  }
}
