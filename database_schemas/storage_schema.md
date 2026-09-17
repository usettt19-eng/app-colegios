# Storage: Fotos de Perfil (Alumnos y Padres/Staff)

Bucket compartido para las fotos del expediente de alumnos y de
padres/staff. Es de lectura pública (para que tanto el SIS como
SafeSmartPickup puedan mostrar la foto directamente por URL) con
escritura restringida por RLS.

Ya fue aplicado al proyecto de Supabase de producción
(`rduhseoiukbdqxmtewxt` / "App para colegios") vía migración
`create_profile_photos_bucket`. Este archivo documenta ese script para
poder reproducirlo en otro entorno (staging, otro colegio, etc.).

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile_photos',
  'profile_photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Lectura pública (cualquiera con la URL puede ver la foto; es el mismo
-- modelo que un avatar público)
create policy "Lectura publica de fotos de perfil"
on storage.objects for select
using (bucket_id = 'profile_photos');

-- Solo usuarios autenticados del mismo colegio (su propio tenant_id como
-- primer segmento de la ruta) pueden subir/actualizar/borrar fotos.
-- El backend del SIS usa la service_role key, que siempre bypassa RLS,
-- así que esto aplica cuando haya subida directa desde el cliente (Fase 2).
create policy "Staff autenticado sube fotos de su colegio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile_photos'
  and (storage.foldername(name))[1] = (
    select tenant_id::text from public.profiles where id = auth.uid()
  )
);

create policy "Staff autenticado actualiza fotos de su colegio"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile_photos'
  and (storage.foldername(name))[1] = (
    select tenant_id::text from public.profiles where id = auth.uid()
  )
);

create policy "Staff autenticado borra fotos de su colegio"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile_photos'
  and (storage.foldername(name))[1] = (
    select tenant_id::text from public.profiles where id = auth.uid()
  )
);
```

## Convención de rutas

`{tenant_id}/{scope}/{ownerId}.{ext}`

- `scope` es `students` o `profiles`.
- `ownerId` es el `id` del alumno o del perfil (padre/staff).
- `ext` es `jpg`, `png` o `webp` según el tipo de imagen subida.

Ejemplo: `a1b2c3.../students/f9e8d7....png`

El primer segmento (`tenant_id`) es lo que valida la política RLS de
escritura, para que un usuario autenticado de un colegio no pueda
sobrescribir fotos de otro colegio.

## Consumo desde SafeSmartPickup

Como el bucket es público de lectura, SafeSmartPickup (o cualquier otro
sistema) puede mostrar la foto directamente con la URL pública guardada
en `students.photo_url` / `profiles.photo_url` — no necesita autenticarse
contra Supabase para leerla, solo para subir/reemplazar una foto.
