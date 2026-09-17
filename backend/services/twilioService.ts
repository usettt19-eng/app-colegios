import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

// Instancia del cliente Twilio (solo si las credenciales existen)
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Envía una alerta por SMS al representante del alumno.
 */
export const sendAbsenceAlertSMS = async (toPhone: string, studentName: string, absencesCount: number) => {
  const message = `Alerta Escolar: ${studentName} ha acumulado ${absencesCount} ausencias seguidas. Por favor, comunícate con Tutoría lo antes posible.`;

  if (!client) {
    console.warn("[Twilio Mock] SMS Simulado (Faltan credenciales):", { toPhone, message });
    return { success: true, simulated: true, sid: "mock_sid_123" };
  }

  try {
    const response = await client.messages.create({
      body: message,
      from: fromPhone,
      to: toPhone
    });
    
    console.log(`[Twilio] SMS enviado a ${toPhone} con SID: ${response.sid}`);
    return { success: true, simulated: false, sid: response.sid };
  } catch (error) {
    console.error("[Twilio Error] Fallo al enviar SMS:", error);
    return { success: false, error };
  }
};
