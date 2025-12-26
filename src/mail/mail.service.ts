import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = process.env.BACKEND_URL+`/auth/verify?token=${token}`;
    const htmlTemplate = this.buildVerificationTemplate(verificationUrl);

    await this.resend.emails.send({
      from: 'CuentIA <no-reply@cuentia.mx>',
      to: email,
      subject: 'Confirma tu correo electrónico',
      html: htmlTemplate,
    });

    return true;
  }

  private buildSupportConfirmationTemplate(data: any) {
    return `
    <div style="background:#f4f6fa; padding:35px; font-family:Arial;">
      <div style="max-width:560px; margin:auto; background:white; padding:30px; border-radius:14px;">
        <h3 style="color:#111;">¡Gracias por contactarnos, ${data.name}!</h3>
        <p style="color:#444;">Recibimos tu mensaje y te responderemos muy pronto.</p>
        <p><b>Asunto:</b> ${data.subject ?? "Sin asunto"}</p>
        <p><b>Categoría:</b> ${data.category ?? "No especificado"}</p>
        <p style="white-space:pre-wrap;">${data.message}</p>
  
        <hr />
        <p style="color:#888; font-size:12px; text-align:center;">
          CuentIA © ${new Date().getFullYear()}
        </p>
      </div>
    </div>
    `;
  }

  private buildSupportTemplate(data: any) {
    return `
    <div style="background:#f7f7fb; padding:30px; font-family:Arial;">
      <div style="max-width:600px; margin:auto; background:white; padding:30px; border-radius:12px;">
        <h2 style="color:#4f46e5;">Nueva solicitud de soporte</h2>
        <p><b>Nombre:</b> ${data.name}</p>
        <p><b>Email:</b> ${data.email}</p>
        <p><b>Categoría:</b> ${data.category ?? "No especificada"}</p>
        <p><b>Asunto:</b> ${data.subject ?? "Sin asunto"}</p>
        <p style="white-space:pre-wrap;"><b>Mensaje:</b><br/>${data.message}</p>
        <hr>
        <p style="color:#888; font-size:12px;">CuentIA · Sistema de soporte automático</p>
      </div>
    </div>
    `;
  }


  private buildVerificationTemplate(url: string) {
    const year = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="es" style="margin:0; padding:0; background:#f6f7fb;">
  <head>
    <meta charset="UTF-8" />
    <title>Verifica tu correo</title>

    <style>
      body {
        font-family: Arial, sans-serif;
        background: #f6f7fb;
        margin: 0;
        padding: 0;
      }

      .container {
        max-width: 600px;
        margin: 40px auto;
        background: white;
        border-radius: 12px;
        padding: 40px;
        box-shadow: 0 6px 30px rgba(0,0,0,0.08);
      }

      .title {
        font-size: 26px;
        color: #1f2937;
        text-align: center;
        font-weight: 700;
      }

      .subtitle {
        color: #6b7280;
        text-align: center;
        font-size: 16px;
        margin-top: 10px;
        line-height: 1.6;
      }

      .button-container {
        text-align: center;
        margin: 40px 0;
      }

      .button {
        background: #4f46e5;
        padding: 14px 28px;
        color: white !important;
        text-decoration: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: bold;
        display: inline-block;
      }

      .footer {
        text-align: center;
        margin-top: 40px;
        color: #a1a1aa;
        font-size: 13px;
      }

      .footer a {
        color: #818cf8;
        text-decoration: none;
      }
    </style>
  </head>

  <body>
    <div class="container">

      <div class="title">Confirma tu cuenta</div>

      <div class="subtitle">
        Gracias por registrarte en <b>CuentIA</b>.<br/>
        Para activar tu cuenta, solo necesitas verificar tu correo electrónico.
      </div>

      <div class="button-container">
        <a href="${url}" class="button">
          Verificar mi correo
        </a>
      </div>

      <div class="subtitle" style="font-size:14px;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:
        <br><br>
        <a href="${url}" style="color:#4f46e5; word-break:break-all;">
          ${url}
        </a>
      </div>

      <div class="footer">
        CuentIA © ${year} • Todos los derechos reservados<br/>
        <a href="https://cuentia.mx">cuentia.mx</a>
      </div>

    </div>
  </body>
</html>`;
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/restablecer?token=${token}`;
  
    await this.resend.emails.send({
      from: "CuentIA <no-reply@cuentia.mx>",
      to: email,
      subject: "Restablece tu contraseña en CuentIA",
      html: `
        <div style="background:#f4f6fa; padding:40px; font-family:'Segoe UI', Helvetica, Arial, sans-serif;">
          <div style="max-width:560px; margin:auto; background:white; padding:40px 35px; border-radius:16px; border:1px solid #e5e7eb;">
  
            <h2 style="color:#111827; font-size:24px; font-weight:700; margin-bottom:10px;">
              Restablecer tu contraseña
            </h2>
  
            <p style="color:#4b5563; font-size:15px; line-height:1.6;">
              Hemos recibido una solicitud para cambiar tu contraseña.  
              Si realizaste esta solicitud, haz clic en el botón inferior para continuar.
            </p>
  
            <div style="text-align:center; margin:32px 0;">
              <a href="${resetUrl}" 
                style="
                  background:#4f46e5;
                  color:white;
                  padding:14px 28px;
                  border-radius:8px;
                  text-decoration:none;
                  font-size:16px;
                  font-weight:600;
                  display:inline-block;
                  box-shadow:0 3px 8px rgba(79,70,229,0.25);
                "
              >
                Restablecer contraseña
              </a>
            </div>
  
            <p style="color:#6b7280; font-size:13px; line-height:1.5;">
              Este enlace es válido por <strong>30 minutos</strong>.  
              Si no solicitaste un cambio de contraseña, puedes ignorar este mensaje.  
              Por seguridad, nadie más puede usar este enlace.
            </p>
  
            <hr style="border:none; border-top:1px solid #e5e7eb; margin:28px 0;" />
  
            <p style="color:#9ca3af; font-size:12px; text-align:center;">
              CuentIA © ${new Date().getFullYear()} — Inteligencia fiscal para todos.  
              <br/>Este es un mensaje automático, por favor no respondas a este correo.
            </p>
  
          </div>
        </div>
      `
    });
  }

  async sendSupportConfirmation(email: string, name: string) {
    await this.resend.emails.send({
      from: "CuentIA <no-reply@cuentia.mx>",
      to: email,
      subject: "Hemos recibido tu solicitud de soporte",
      html: `
        <div style="background:#f4f6fa; padding:30px; font-family:'Segoe UI', Helvetica, Arial, sans-serif;">
          <div style="max-width:550px; margin:auto; background:white; padding:30px 25px; border-radius:12px; border:1px solid #e5e7eb;">
            
            <h2 style="margin:0 0 10px; font-size:20px; color:#111827;">
              Hemos recibido tu solicitud de soporte
            </h2>
  
            <p style="font-size:15px; color:#4b5563; line-height:1.6;">
              Hola <strong>${name}</strong>,<br><br>
              Gracias por ponerte en contacto con nosotros.<br>
              Tu mensaje fue recibido exitosamente y nuestro equipo lo revisará en breve.
            </p>
  
            <p style="font-size:14px; color:#4b5563; line-height:1.6;">
              Si necesitamos información adicional, te contactaremos al correo: <strong>${email}</strong>.
            </p>
  
            <p style="font-size:13px; color:#6b7280; margin-top:30px;">
              CuentIA © ${new Date().getFullYear()} — Gracias por confiar en nosotros.
            </p>
  
          </div>
        </div>
      `,
    });
  }
  
  async sendSupportAdminAlert(support: any) {
    await this.resend.emails.send({
      from: "CuentIA <no-reply@cuentia.mx>",
      to: "srgiorosales123@gmail.com",
      subject: `Nuevo ticket de soporte de ${support.email}`,
      html: `
        <h3>Nueva solicitud de soporte</h3>
        <p><b>Usuario ID:</b> ${support.userId}</p>
        <p><b>Nombre:</b> ${support.name}</p>
        <p><b>Email:</b> ${support.email}</p>
        <p><b>Asunto:</b> ${support.subject ?? "(Sin asunto)"}</p>
        <p><b>Categoría:</b> ${support.category ?? "(No especificada)"}</p>
        <p><b>Mensaje:</b> ${support.message}</p>
      `,
    });
  }

  async sendEnterpriseLeadEmail(lead: any) {
    await this.resend.emails.send({
      from: "CuentIA <no-reply@cuentia.mx>",
      to: "srgiorosales123@gmail.com",
      subject: `Nueva solicitud de plan personalizado — ${lead.empresa}`,
      html: `
        <h2>Nueva solicitud de plan personalizado</h2>
  
        <h3>Información de la empresa</h3>
        <p><b>Empresa:</b> ${lead.empresa}</p>
        <p><b>RFC:</b> ${lead.rfc}</p>
        <p><b>Email:</b> ${lead.email}</p>
        <p><b>Teléfono:</b> ${lead.telefono || "(Sin teléfono)"}</p>
  
        <h3>Necesidades técnicas</h3>
        <p><b>Cantidad de RFCs:</b> ${lead.rfcs}</p>
        <p><b>CFDIs Mensuales:</b> ${lead.cfdisMensuales}</p>
        <p><b>Usuarios internos:</b> ${lead.usuarios}</p>
  
        <h3>Bots y Automatizaciones</h3>
        <p><b>Bot de Gastos:</b> ${lead.botGastos ? "Sí" : "No"}</p>
        <p><b>Bot de Comprobantes:</b> ${lead.botComprobantes ? "Sí" : "No"}</p>
        <p><b>Integraciones personalizadas:</b> ${lead.integraciones ? "Sí" : "No"}</p>

        <h3>Límites de IA solicitados</h3>
        <p><b>Análisis CFDI con IA (diarios):</b> ${lead.limiteAnalisisCfdiIA}</p>
        <p><b>Mensajes diarios al chatbot contable:</b> ${lead.limiteChatbotIA}</p>
  
        <h3>Detalles adicionales</h3>
        <p>${lead.detalles || "(Sin detalles adicionales)"}</p>
  
        <hr />
  
        <p>Solicitud enviada el <b>${new Date(lead.createdAt).toLocaleString()}</b></p>
      `,
    });
  }

  async sendManualPaymentEmail(record: any) {
    await this.resend.emails.send({
      from: "CuentIA <no-reply@cuentia.mx>",
      to: "srgiorosales123@gmail.com",
      subject: `Nuevo pago por transferencia pendiente — User ${record.userId}`,
      html: `
        <h3>Pago manual pendiente</h3>
        <p><b>UserId:</b> ${record.userId}</p>
        <p><b>Plan:</b> ${record.kind}</p>
        <p>Revisa la transferencia y aprueba manualmente en el panel.</p>
      `,
    });
  }
}
