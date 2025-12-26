import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity({ name: 'cat_clave_prod_serv' })
export class CatClaveProdServ {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  clave: string;

  @Index() // opcional
  @Column({ type: 'text' })
  descripcion: string;
}
