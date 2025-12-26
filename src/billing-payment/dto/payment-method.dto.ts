import {
  IsIn,
  IsOptional,
  IsString,
  IsNumberString,
  Length,
  Matches,
  ValidateIf,
} from "class-validator";

export class UpdatePaymentMethodDto {
  // =====================================================
  // MÉTODO PRINCIPAL (obligatorio)
  // =====================================================
  @IsIn(["TRANSFERENCIA", "TARJETA", "PAYPAL"])
  metodoPago: string;

  // =====================================================
  // TARJETA (solo si metodoPago === TARJETA)
  // =====================================================
  @ValidateIf((o) => o.metodoPago === "TARJETA")
  @IsString()
  stripeCustomerId?: string;

  @ValidateIf((o) => o.metodoPago === "TARJETA")
  @IsString()
  stripePaymentMethodId?: string;

  @ValidateIf((o) => o.metodoPago === "TARJETA")
  @IsNumberString()
  @Length(4, 4, { message: "last4 debe tener exactamente 4 dígitos" })
  last4?: string;

  @ValidateIf((o) => o.metodoPago === "TARJETA")
  @IsIn(["visa", "mastercard", "amex", "discover", "unknown"], {
    message: "brand debe ser una marca válida (visa, mastercard, amex, discover)",
  })
  brand?: string;

  @ValidateIf((o) => o.metodoPago === "TARJETA")
  @Matches(/^(0[1-9]|1[0-2])$/, {
    message: "expMonth debe ser un mes válido con formato MM (01–12)",
  })
  expMonth?: string;

  @ValidateIf((o) => o.metodoPago === "TARJETA")
  @Matches(/^(\d{2}|\d{4})$/, {
    message: "expYear debe ser un año válido (YY o YYYY)",
  })
  expYear?: string;

  // =====================================================
  // TRANSFERENCIA SPEI (solo si metodoPago === TRANSFERENCIA)
  // =====================================================
  @ValidateIf((o) => o.metodoPago === "TRANSFERENCIA")
  @IsString()
  banco?: string;

  @ValidateIf((o) => o.metodoPago === "TRANSFERENCIA")
  @IsNumberString()
  @Length(18, 18, {
    message: "La CLABE debe tener exactamente 18 dígitos",
  })
  clabe?: string;

  @ValidateIf((o) => o.metodoPago === "TRANSFERENCIA")
  @Matches(/^[A-Za-z0-9\-]{4,20}$/, {
    message: "La referencia debe ser alfanumérica (4–20 caracteres)",
  })
  referencia?: string;
}
