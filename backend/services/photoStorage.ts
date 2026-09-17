import { supabaseAdmin } from "../supabase";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const BUCKET = "profile_photos";

/**
 * Sube una foto (data URL "data:image/png;base64,...") al bucket compartido
 * profile_photos y devuelve su URL pública. La ruta sigue la convención
 * "{tenant_id}/{scope}/{ownerId}.{ext}" para que coincida con las políticas
 * RLS del bucket (primer segmento = tenant_id).
 */
export async function uploadProfilePhoto(
  dataUrl: string,
  tenantId: string,
  scope: "students" | "profiles",
  ownerId: string
): Promise<string> {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de imagen no soportado. Usa JPEG, PNG o WEBP.");
  }

  const [, mimeType, base64Data] = match;
  const extension = MIME_EXTENSIONS[mimeType];
  const buffer = Buffer.from(base64Data, "base64");
  const filePath = `${tenantId}/${scope}/${ownerId}.${extension}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    throw new Error(`Error al subir la foto a Storage: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}
