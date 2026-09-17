import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Configuración del Transporter (SMTP)
// En producción, aquí van las credenciales de SendGrid, AWS SES, Resend, o Microsoft 365
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.mailtrap.io",
  port: Number(process.env.SMTP_PORT) || 2525,
  auth: {
    user: process.env.SMTP_USER || "test_user",
    pass: process.env.SMTP_PASS || "test_password"
  }
});

/**
 * Función para enviar un correo electrónico
 */
export const sendEmail = async (to: string | string[], subject: string, htmlContent: string) => {
  try {
    const info = await transporter.sendMail({
      from: `"Colegio SIS" <${process.env.SMTP_FROM || "no-reply@colegio.edu"}>`,
      to: Array.isArray(to) ? to.join(",") : to,
      subject,
      html: htmlContent
    });
    
    console.log(`[Email Service] Correo enviado: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email Service] Error enviando correo:", error);
    throw error;
  }
};

/**
 * Plantilla HTML básica para comunicaciones oficiales
 */
export const getOfficialEmailTemplate = (title: string, body: string) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
      <div style="text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px;">
        <h2 style="color: #0056b3; margin: 0;">Colegio Smart SIS</h2>
      </div>
      <h3 style="color: #333;">${title}</h3>
      <div style="color: #555; line-height: 1.6;">
        ${body}
      </div>
      <div style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
        Este es un mensaje automático generado por el Sistema de Gestión Escolar.
      </div>
    </div>
  `;
};
