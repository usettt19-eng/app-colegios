import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

// En producción, asegúrate de colocar tu STRIPE_SECRET_KEY en el .env
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_simulacion";
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-08-26.dahlia", // Usa la versión actual de la API
});

/**
 * Crea una sesión de Checkout para una factura del colegio.
 */
export const createCheckoutSession = async (
  invoiceId: string, 
  invoiceNumber: string, 
  amount: number, 
  currency: string = "usd"
) => {
  try {
    // Si no hay key real, devolvemos un link simulado
    if (stripeSecretKey === "sk_test_simulacion") {
      return { 
        url: `https://simulador.stripe.com/pay/${invoiceId}`, 
        sessionId: "cs_test_mock123" 
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"], // Habilitar tarjetas de crédito/débito
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Factura Escolar ${invoiceNumber}`,
              description: "Pago de colegiatura/servicios",
            },
            unit_amount: Math.round(amount * 100), // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // URLs a las que el usuario es redirigido tras pagar (o cancelar)
      success_url: `${process.env.FRONTEND_URL}/payments/success?invoice=${invoiceId}`,
      cancel_url: `${process.env.FRONTEND_URL}/payments/cancel?invoice=${invoiceId}`,
      metadata: {
        invoice_id: invoiceId, // Metadato vital para conciliar el pago en el webhook
      },
    });

    return { url: session.url, sessionId: session.id };
  } catch (error) {
    console.error("Error creando sesión de Stripe:", error);
    throw error;
  }
};
