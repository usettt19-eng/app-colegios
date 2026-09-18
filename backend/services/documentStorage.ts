import { supabaseAdmin } from "../supabase";

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const BUCKET = "documents";

/**
 * Sube un documento (data URL "data:<mime>;base64,...") al bucket PRIVADO
 * "documents" y devuelve la ruta interna (no una URL pública: estos
 * documentos pueden ser cédulas, contratos, antecedentes, etc.). La ruta
 * sigue la convención "{tenant_id}/{scope}/{ownerId}/{timestamp}_{nombre}"
 * para que coincida con las políticas RLS del bucket (primer segmento =
 * tenant_id) y para acceder después vía URL firmada (getSignedDocumentUrl).
 */
export async function uploadDocumentFile(
  dataUrl: string,
  tenantId: string,
  scope: string,
  ownerId: string,
  fileName: string
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de archivo inválido.");
  }

  const [, mimeType, base64Data] = match;
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) {
    throw new Error("Tipo de archivo no soportado. Usa PDF, JPEG, PNG, WEBP, DOC o DOCX.");
  }

  const buffer = Buffer.from(base64Data, "base64");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${tenantId}/${scope}/${ownerId}/${Date.now()}_${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    throw new Error(`Error al subir el archivo a Storage: ${error.message}`);
  }

  return filePath;
}

/**
 * Genera una URL firmada temporal (1 hora por defecto) para descargar/ver un
 * documento del bucket privado. Devuelve null si la ruta no existe en
 * Storage (ej. registros antiguos creados antes de la subida real, que solo
 * guardaban un nombre de archivo de referencia) en vez de lanzar un error,
 * para que listar documentos nunca rompa por un registro viejo.
 */
export async function getSignedDocumentUrl(path: string | null | undefined, expiresInSeconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
