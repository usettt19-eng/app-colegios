import dotenv from "dotenv";

dotenv.config();

const YAPPY_MERCHANT_ID = process.env.YAPPY_MERCHANT_ID || "simulated_merchant_id";
const YAPPY_SECRET_KEY = process.env.YAPPY_SECRET_KEY || "simulated_secret_key";
const YAPPY_ENV = process.env.NODE_ENV === "production" ? "prod" : "sandbox";

/**
 * Genera el enlace de pago con Yappy (Banco General Panamá)
 * Usa la especificación del Botón de Pago Yappy Comercial
 */
export const createYappyCheckout = async (
  invoiceId: string, 
  invoiceNumber: string, 
  amount: number
) => {
  try {
    console.log(`[Yappy API] Iniciando transacción para factura ${invoiceNumber}...`);

    // En un entorno real, aquí instalaríamos la librería `yappy-node-sdk`
    // const yappyClient = createClient(YAPPY_MERCHANT_ID, YAPPY_SECRET_KEY);
    // const response = await yappyClient.payment.create({
    //   total: amount,
    //   subtotal: amount,
    //   taxes: 0,
    //   orderId: invoiceId,
    //   successUrl: `${process.env.FRONTEND_URL}/payments/success?yappy=true`,
    //   failUrl: `${process.env.FRONTEND_URL}/payments/fail`,
    // });
    
    // Para el entorno de desarrollo actual, devolvemos un enlace simulado:
    const mockYappyUrl = `https://pagos.yappy.com.pa/checkout?order=${invoiceId}&amount=${amount}`;

    return {
      success: true,
      url: mockYappyUrl,
      orderId: invoiceId
    };
  } catch (error) {
    console.error("[Yappy API] Error conectando con Banco General:", error);
    throw error;
  }
};
