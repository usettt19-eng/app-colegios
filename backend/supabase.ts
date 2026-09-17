import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env.");
}

// Usamos el service_role key para operaciones administrativas del backend
// (ej. insertar audit_logs, enviar notificaciones push bypassando RLS)
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
