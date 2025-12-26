import { IsString, IsOptional, IsIn, IsEmail, Matches, Length } from "class-validator";

const REGIMENES_SAT = [
  "601","602","603","604","605","606","607","608","609","610","611","612",
  "613","614","615","616","617","618","619","620","621","622","623","624",
  "625","626"
];

const USO_CFDI = [
  "G01","G02","G03","I01","I02","I03","I04","I05","I06","I07","I08",
  "D01","D02","D03","D04","D05","D06","D07","D08","D09","D10",
  "S01","CP01","CN01","P01"
];

const ESTADOS_MX = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua",
  "Ciudad de México","Coahuila","Colima","Durango","Estado de México","Guanajuato",
  "Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit","Nuevo León",
  "Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora",
  "Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"
];

// RFC PF/PM válido SAT
const RFC_REGEX =
  /^[A-ZÑ&]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{3}$/i;

export class UpdateBillingDto {
  @IsString()
  @Matches(RFC_REGEX, { message: "RFC inválido. Verifica estructura y fecha SAT." })
  rfc: string;

  @IsString()
  @Length(3, 200)
  razonSocial: string;

  @IsIn(REGIMENES_SAT, { message: "Régimen fiscal no válido según catálogo SAT." })
  regimenFiscal: string;

  @IsIn(USO_CFDI, { message: "Uso de CFDI inválido según catálogo SAT." })
  usoCfdi: string;

  @IsString()
  @Matches(/^[0-9]{10}$/i, {
    message: "El teléfono debe tener 10 dígitos (sin +52).",
  })
  telefono: string;

  @IsString()
  @Length(3, 200)
  calle: string;

  @IsString()
  @Length(1, 50)
  numero: string;

  @Matches(/^[0-9]{5}$/, { message: "El CP debe tener 5 dígitos." })
  cp: string;

  @IsIn(ESTADOS_MX, { message: "Estado inválido." })
  estado: string;

  @IsString()
  @Length(3, 120)
  municipio: string;

  @IsString()
  @Length(3, 120)
  pais: string;
}
