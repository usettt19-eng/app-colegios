import { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../supabase";

export interface AuthProfile {
  id: string;
  tenant_id: string;
  role: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthedRequest extends Request {
  authProfile?: AuthProfile;
}

// Verifica el JWT de Supabase Auth enviado en "Authorization: Bearer <token>"
// y adjunta el perfil (profiles) correspondiente a req.authProfile.
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado." });
  }
  const token = header.slice(7);

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, tenant_id, role, email, first_name, last_name")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: "No existe un perfil vinculado a este usuario." });
  }

  req.authProfile = profile;
  next();
}

// Debe usarse después de requireAuth. Rechaza si el rol del perfil autenticado
// no está en la lista permitida (ej. requireRole("super_admin")).
export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.authProfile || !roles.includes(req.authProfile.role)) {
      return res.status(403).json({ error: "No tienes permisos para realizar esta acción." });
    }
    next();
  };
}
