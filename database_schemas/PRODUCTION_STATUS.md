# Estado de la Base de Datos de Producción

Proyecto Supabase: `rduhseoiukbdqxmtewxt` ("App para colegios").

## Módulos aplicados

Todos los scripts de `database_schemas/*.md` y `FINAL_EXECUTION.sql` ya
fueron aplicados a esta base de datos (vía migraciones de Supabase MCP):
initial/full schema (SIS core + SafeSmartPickup), académico, jerarquía,
contratos, documentos, tareas, horarios, finanzas y ERP corporativo.
Las 37 tablas del modelo completo existen y tienen RLS habilitado.

También se aplicó `storage_schema.md` (bucket `profile_photos`).

## IDs de demostración

El frontend usa IDs fijos mientras no exista Supabase Auth real (Fase 2
del handover). Estos IDs están sembrados con datos reales en la base de
producción para que los portales no se vean vacíos:

| Constante | UUID | Registro |
|---|---|---|
| `DEMO_TENANT_ID` | `11111111-1111-1111-1111-111111111111` | Tenant "Colegio Demo" |
| `DEMO_STUDENT_ID` | `22222222-2222-2222-2222-222222222222` | Alumna Sofía Martínez, 5to Primaria A |
| `DEMO_PARENT_ID` | `33333333-3333-3333-3333-333333333333` | Padre Carlos Martínez |
| `DEMO_TEACHER_ID` | `44444444-4444-4444-4444-444444444444` | Profesora Ana Gómez |
| `DEMO_TERM_ID` | `55555555-5555-5555-5555-555555555555` | Año Lectivo 2026-2027 (activo) |
| `DEMO_SENDER_ID` / `DEMO_REQUESTER_ID` | `66666666-6666-6666-6666-666666666666` | Admin Roberto Díaz |
| Plantilla de contrato demo | `77777777-7777-7777-7777-777777777777` | "Contrato K-12 2026-2027" |
| Departamento demo | `88888888-8888-8888-8888-888888888888` | "Administración" |
| Curso demo | `99999999-9999-9999-9999-999999999999` | MAT-501 Matemáticas |
| Grupo/clase demo | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | "Grupo A" (con la profesora asignada) |
| Matrícula demo | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | Sofía matriculada en el ciclo activo |
| Boletín demo | `cccccccc-cccc-cccc-cccc-cccccccccccc` | Publicado, GPA 4.20 |
| Factura demo | `dddddddd-dddd-dddd-dddd-dddddddddddd` | FAC-2026-00001, $250 pendiente |

Los usuarios `auth.users` para el padre/profesora/admin se crearon
directamente por SQL (sin pasar por el flujo normal de signup de
Supabase Auth) solo para satisfacer las llaves foráneas de `profiles`.
No están pensados para iniciar sesión real todavía — eso llega con la
Fase 2 (Supabase Auth + JWT en el backend, reemplazando estos IDs fijos
por los del usuario autenticado).

**Importante:** antes de usar estos IDs en un entorno donde ya haya
alumnos/padres reales de un colegio, hay que quitarlos o adaptarlos —
son solo para demostrar la app con datos poblados.
