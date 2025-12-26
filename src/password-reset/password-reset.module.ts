import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { UsersModule } from "../users/users.module";
import { MailModule } from "../mail/mail.module";
import { PasswordResetService } from "./password-reset.service"; // ⬅️ IMPORTAR ESTO

@Module({
  imports: [
    TypeOrmModule.forFeature([PasswordResetToken]),
    UsersModule,
    MailModule,
  ],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
