# App Colegios — Estado del Proyecto

> Documento vivo. Actualízalo cada vez que se cierre o se abra una tarea importante.
> Regla operativa: cada vez que Claude avance en algo, actualiza este archivo en el mismo commit. Para retomar contexto del proyecto, leer este archivo primero — no releer toda la sesión.
> Última actualización: 2026-09-18

## 1. Qué es esto

Sistema de Información Escolar (SIS) + ERP multi-tenant (multi-colegio) construido con:

- **Frontend**: React 19 + Vite + TypeScript (strict) + Tailwind.
- **Backend**: Express 4 + `@supabase/supabase-js` (usa la **service-role key**, o sea que el backend salta RLS; la autorización real para los portales ya migrados a Fase 2 la hace el middleware `requireAuth`/`requireRole`, no RLS).
- **Base de datos**: Supabase Postgres (proyecto `rduhseoiukbdqxmtewxt`), Storage y Auth.
- **Deploy**: Docker Compose en un VPS. Claude NO tiene acceso SSH directo al VPS — el usuario ejecuta los comandos de redeploy que Claude le da después de cada push.

Cada tabla tiene `tenant_id` (modelo multi-tenant). El repo vive en GitHub, rama de trabajo actual: `claude/loving-bardeen-snlh1m`.

## 2. Arquitectura y convenciones clave

- **Auth (Fase 2)**: Supabase Auth real (JWT), no más "login" simulado.
  - `backend/middleware/auth.ts`: `requireAuth`, `requireRole(...roles)`.
  - `backend/routes/auth.ts`: `GET /api/v1/auth/me`.
  - `src/lib/supabaseClient.ts`, `src/contexts/AuthContext.tsx`.
  - Patrón "gate": cada portal migrado (`ParentStudentPortal`, `TeacherPortal`, `SuperAdminPortal`) tiene un componente `...Inner` que recibe IDs ya resueltos, y un export que muestra `<LoginPage/>` si no hay sesión, mensaje de rol incorrecto si aplica, o el `Inner`.
  - Roles: `parent`, `teacher`, `admin`, `super_admin` (super_admin puede crear colegios/tenants y admins de colegio).
  - **Pendiente**: migrar Admisiones, Portal Corporativo y Portal Admin al mismo patrón de auth real (hoy siguen sin login real).

- **Docker + Vite env vars**: los `VITE_*` se hornean en el **build**, no en runtime. Por eso el `Dockerfile` tiene `ARG`/`ENV VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` en el builder stage, y `docker-compose.yml` tiene `build.args` que los toma del `.env` del host. Si cambian esas variables hay que hacer `docker compose build --no-cache`, no solo `up -d`.

- **Verificación en sandbox**: el sandbox no tiene acceso HTTP a la DB real de Supabase, así que las capturas de Playwright muestran estados vacíos/error como señal aceptable de que la UI no rompe. La verificación con datos reales se hace vía `mcp__Supabase__execute_sql` / `apply_migration` directo contra el proyecto de producción.

- **Flujo de trabajo estándar por feature**: migración SQL (Supabase MCP) → backend → frontend → `npx tsc --noEmit` → probar con Playwright (screenshot) → commit con mensaje descriptivo en español → push a `claude/loving-bardeen-snlh1m` → dar al usuario los comandos exactos de redeploy:
  ```bash
  cd ~/app-colegios
  git pull origin claude/loving-bardeen-snlh1m
  docker compose build --no-cache
  docker compose up -d
  ```

## 3. Módulos construidos (funcionando, deployado)

- **Portal de Padres**: Dashboard/Resumen Ejecutivo, Centro de Pagos (`fee_schedules` + generación de facturas), Notas y Agendas, Mensajería.
- **Portal Docente**: tareas/asignaciones con tipo (tarea/examen/actividad/proyecto), notas, **Notas Finales** (calificación final + generar/publicar boletín con un clic), **Mensajería** (puede escribirle a padres). Tiene su propio login real (Supabase Auth, gate por role='teacher'), accesible desde "VER PORTAL DOCENTE" en el nav.
- **Alta de Docentes/Staff** (Admin → Organización): formulario "Agregar Docente / Staff" que crea la cuenta real (Supabase Auth + `profiles`) vía `POST /api/v1/profiles` con rol `teacher` / `admin` / `guard` (el enum `user_role` en la DB es `admin|parent|teacher|guard|super_admin`, **no existe** el rol `'staff'` aunque algún código viejo de `communications.ts` lo referencie — ojo con eso). Antes de esto no existía NINGÚN lugar en la UI para crear un docente; el backend ya lo soportaba pero solo estaba conectado para crear padres/acudientes.
- **Expediente documental de Staff/Docentes**: tabla `staff_documents` (título/diploma, certificación, CV, carta de experiencia laboral, antecedentes, cédula, contrato, otro), mismo patrón que `student_documents` (RLS: el propio docente ve/sube los suyos vía `profile_id = auth.uid()`, admin del tenant gestiona todo). Backend en `backend/routes/staffDocuments.ts` montado en `/api/v1/staff-documents` (`GET /:profile_id`, `POST /upload`, `POST /review`). En la tabla "Organigrama del Staff" (Admin → Organización) cada fila tiene un botón "Ver expediente" que expande `<StaffDocuments>` inline: subir documento (select de tipo + `<input type=file>`) y botones Verificar/Rechazar por documento pendiente. **Nota**: igual que `student_documents`, la subida de archivo real a Storage está mockeada (solo se guarda un `file_url` de referencia con el nombre del archivo, no el binario) — es una limitación heredada del patrón ya existente en Admisiones, no algo nuevo de esta feature; subir el archivo real a Supabase Storage queda en el backlog para ambos casos (alumnos y staff). Aún no hay UI para que el propio docente vea/suba su expediente desde el Portal Docente (solo se construyó el lado Admin, que es lo que se pidió).
- **Admin → Costos**: pantalla para gestionar `fee_schedules` (grado ahora es un `<select>` desde el catálogo de grados, no texto libre).
- **Auth real (Fase 2)**: login con Supabase Auth para Padres, Docentes y Super Admin.
- **Super Admin**: portal para crear colegios (tenants) y sus administradores (usa `supabaseAdmin.auth.admin.createUser`, no el truco de SQL crudo usado solo para sembrar los usuarios demo).
- **Grados y Secciones**: catálogo real (`grade_levels` + `grade_sections`) configurable en Admin, usado en Admisiones, Costos, Directorio de Alumnos y Cursos/Grupos.
- **Directorio de Alumnos y Padres** (Admin): listado de alumnos agrupado por grado/sección, vincular/crear acudientes, botón rápido "+ Agregar Alumno" (datos mínimos; el resto se completa desde el Portal de Padres). Directorio de Padres con hijos vinculados.
- **Importación masiva (CSV)**: alumnos y padres vinculados por `family_code`, sin dependencias nuevas (parser hecho a mano).
- **Transporte**: buses, paradas, dirección (ida/vuelta/ambos), asignación de alumnos.
- **Admisiones ampliada**: captura cédula, fecha de nacimiento, colegio anterior, dirección del alumno; 3 responsables independientes (Madre/Padre/Acudiente), cada uno con búsqueda o creación de perfil.
- **Multi-clase por docente**: un profesor puede tener varios `classes` (curso + grado-sección distintos) vía `classes.grade_section_id` + reasignación de docente por grupo en el Admin.
- **Plan de estudios**: `course_grade_levels` (qué cursos aplican a qué grados, con **horas semanales propias por grado** — ver abajo) + **Matriz curricular por grado** (selector de grado + tabla Área × Asignatura × Aplica × Horas/semana; se filtra a un grado a la vez porque un colegio puede tener 13+ grados y no cabrían todos como columnas) + botón "Generar Grupos" (crea automáticamente un `classes` por cada grado-sección mapeado al curso).
- **Horas semanales + Distributivo por Docente**: las horas de clase por semana NO son un campo único del curso — viven en `course_grade_levels.weekly_hours`, porque el mismo curso puede tener distintas horas según el grado (ej. Matemática de 1ro ≠ Matemática de 5to). Se editan inline en la Matriz de Plan de Estudios (input por celda, solo si el curso está marcado "Sí" para ese grado). Nueva pestaña "Distributivo por Docente" dentro de Admin → Horarios: eliges un docente y ves todos sus `classes` (distintos cursos/grados/secciones), con horas requeridas (buscadas en `course_grade_levels` según el `grade_level_id` de cada clase) vs. horas ya asignadas (suma de bloques `class_schedules`), badge ámbar si faltan horas por asignar, y cada bloque se puede borrar (X). El backend valida en `POST /api/v1/academics/schedules` que el docente de la clase no tenga ya otro bloque cruzado ese día/hora (409 si hay conflicto) y expone `DELETE /api/v1/academics/schedules/:id`. `GET /api/v1/academics/schedules` ahora también acepta `tenant_id`+`teacher_id` (sin `class_id`) para traer todos los bloques de un docente de una vez.
- **Portal ERP → Nómina y Planillas (RRHH/Salarios)**: YA EXISTÍA de antes (esquema `corporate_erp_schema.md`: `hr_employees`, `payroll_runs`, `paystubs`, backend completo en `backend/routes/corporate.ts`, UI en `src/portals/CorporatePortal.tsx`, accesible desde "VER PORTAL ERP" en el nav) — cuando el usuario pidió "un portal de RRHH para salarios" no hubo que construirlo, solo se confirmó que existe y se corrigió una falla de usabilidad real: el formulario "Dar de Alta Empleado en Nómina" pedía el `profile_id` como UUID escrito a mano; ahora es un `<select>` poblado desde `GET /api/v1/hierarchy/staff`, excluyendo a quienes ya están en nómina (comparando por `profile_id`, no por nombre). Flujo completo: dar de alta empleado con salario base → abrir planilla por periodo → "Calcular" genera un recibo (paystub) por cada empleado activo aplicando % de deducción → marcar cada recibo como pagado.
- **Departamentos por defecto**: todo colegio (tenant) arranca con 9 departamentos estándar (Dirección General, Dirección Operativa, Finanzas, Recursos Humanos, Contabilidad, TI, Operaciones, Coordinación Académica, Psicología). Se sembraron para los tenants ya existentes (sin duplicar los que ya tenían, comparando por nombre case-insensitive) y `POST /api/v1/tenants` (alta de colegio nuevo desde Super Admin) ahora los crea automáticamente (`DEFAULT_DEPARTMENTS` en `backend/routes/tenants.ts`). No se tocó el tenant especial de la plataforma (Super Admin, `00000000-0000-0000-0000-000000000001`) porque no es un colegio real.
- **Portal de Finanzas** (nuevo, `src/portals/FinancePortal.tsx`, accesible desde "VER PORTAL FINANZAS"): 3 pestañas.
  - **Flujo Financiero**: tarjetas resumen (ingresos recibidos de alumnos + pendiente por cobrar, egresos pagados a staff/nómina + pendiente, egresos pagados a proveedores + pendiente) y tabla de movimientos recientes (mezcla pagos de alumnos, nómina pagada y compras pagadas, ordenados por fecha). Backend: `GET /api/v1/finance/cashflow?tenant_id=...` en `backend/routes/finance.ts`.
  - **Cotizaciones y Compras**: el responsable de compras/contrataciones sube una cotización (proveedor + concepto + costo + archivo, mismo patrón mockeado de `file_url` que el resto de la app) → queda `pending_approval` → alguien la aprueba o rechaza.
  - **Programar Pagos**: contabilidad le pone fecha a una orden ya `approved` (pasa a `scheduled`) y luego alguien más da la aprobación final que la marca `paid`.
  - Esto requirió extender `purchase_orders` (migración `finance_portal_quotes_and_payment_scheduling`): nuevas columnas `quote_file_url`, `quote_title`, `scheduled_payment_date`, `scheduled_by`, `approved_by`; nuevo estado `scheduled` en el flujo (`pending_approval → approved → scheduled → paid`, o `cancelled` desde `pending_approval`). Nuevos endpoints en `corporate.ts`: `POST /purchase-orders/:id/schedule` y `POST /purchase-orders/:id/confirm-payment`. El endpoint viejo `POST /purchase-orders/:id/status` ya **no** acepta pasar directo a `paid` (antes sí) — solo `approved`/`cancelled` desde `pending_approval`. Por eso se ajustó la pestaña "Proveedores y Compras" del Portal ERP: el botón "Marcar Pagada" se quitó (ya no funcionaría) y ahora dice "Programar/pagar desde el Portal de Finanzas".
  - Antes de escribir cualquier embed nuevo en `finance.ts`, se verificó con `pg_constraint` que cada par de tablas (`payments`↔`invoices`, `invoices`↔`students`, `paystubs`↔`hr_employees`, `hr_employees`↔`profiles`, `purchase_orders`↔`vendors`) solo tiene una relación — para no repetir el bug de PostgREST 300 Multiple Choices de la sección 4 anterior.
  - **Gastos Recurrentes Mensuales** (energía, agua, internet, etc.): nueva tabla `recurring_expenses` (tenant_id, vendor_id, concept, estimated_amount, due_day, is_active). Se configuran una sola vez; dentro de la pestaña "Cotizaciones y Compras" hay una sección arriba de "Subir Cotización" que lista los gastos activos con un botón "Generar cargo de {mes actual}" — genera automáticamente una `purchase_orders` con `status='pending_approval'`, `recurring_expense_id` y `billing_period` (formato `YYYY-MM`, igual que las facturas de alumnos), saltándose el paso de subir cotización (no la necesitan, son facturas de servicio recurrentes) pero entrando al mismo flujo de aprobar → programar → pagar. El monto es editable al generar (por si la factura real del mes varió del estimado). Único índice `(recurring_expense_id, billing_period) WHERE recurring_expense_id IS NOT NULL` evita generar el mismo cargo dos veces en el mismo mes; el frontend además detecta si ya se generó el del mes actual y lo marca con un check en vez de mostrar el botón. Nuevos endpoints: `GET/POST /api/v1/corporate/recurring-expenses`, `PATCH /api/v1/corporate/recurring-expenses/:id`, `POST /api/v1/corporate/recurring-expenses/:id/generate`.

## 4. Tarea en curso

Ninguna en este momento. Última tarea completada: Gastos Recurrentes Mensuales (energía/agua/internet) dentro del Portal de Finanzas, a pedido del usuario tras ver el Portal de Finanzas y preguntar cómo se incluían los gastos fijos que no tienen cotización nueva cada mes. Ver sección 3. Typecheck limpio, verificado con Playwright, sin errores JS.

## 5. Backlog conocido (no urgente, no iniciado)

- Migrar Admisiones, Portal Corporativo, Portal de Finanzas y Portal Admin (aparte de Super Admin) a auth real (Fase 2).
- Integración saliente con SafeSmartPickup (pendiente de credenciales de API del usuario).
- Subida real de archivos a Supabase Storage para `student_documents`, `staff_documents` y las cotizaciones de `purchase_orders` (los tres mockean `file_url`/`quote_file_url` con solo el nombre del archivo, no suben el binario).
- El asset assignment (`assigned_to_profile_id`) en Portal ERP → Patrimonio IT probablemente tenga el mismo problema de UX que tenía Nómina (pedir un profile_id a mano en vez de un select) — no confirmado/revisado todavía, pendiente de revisar si se vuelve a reportar.
- Conectar la pestaña "Importar Datos" del frontend al endpoint `POST /api/v1/bulk-import/staff` (ya existe en el backend, falta la tarjeta "3. Importar Docentes/Staff" en `BulkImport.tsx`, mismo patrón que alumnos/padres).
- Decidir quién puede aprobar cotizaciones vs. quién programa pagos vs. quién da la aprobación final en el Portal de Finanzas — hoy cualquiera que entre al portal puede hacer las 3 cosas (no hay separación de roles todavía, similar a como el resto de portales sin Fase 2 auth funcionan hoy).
- UI para que el propio docente vea/suba su expediente desde el Portal Docente (hoy `staff_documents` solo tiene UI del lado Admin; el backend ya lo permitiría vía RLS `profile_id = auth.uid()`).

## 6. Notas operativas / cosas que ya se rompieron una vez (para no repetirlas)

- **Nunca** nombrar una variable de entorno del frontend con el prefijo `VITE_` si contiene un secreto (ej. service role key) — Vite la puede hornear en el bundle público. Verificar siempre `cut -d= -f1 .env` antes de asumir algo grave.
- El backend necesita `SUPABASE_URL` **sin** el prefijo `VITE_`, además de la versión `VITE_` que usa el frontend. Si falta, el server arranca con un warning pero varias rutas fallan en silencio.
- Si el login falla sin mensaje visible, revisar que `LoginPage` esté mostrando también el `error` interno de `AuthContext` (bug ya corregido, pero vigilar si se reintroduce).
- Los inputs deben tener `color` explícito en `src/index.css` — el tema oscuro del shell (`text-slate-100`) se hereda en todos los `input/select/textarea` y puede volver el texto invisible en tarjetas blancas.
- Antes de correr una migración combinada, revisar si algún índice/columna ya existe (pasó con `idx_classes_teacher`) para no perder la migración completa por un solo statement duplicado.
- **Embeds de PostgREST con más de un FK entre dos tablas devuelven 500 (en realidad 300 Multiple Choices) sin mensaje claro** en nuestro backend porque no logueamos el `error` completo en todas las rutas. Si un `.select("tabla_a(campo)")` falla sin razón aparente y las dos tablas tienen más de una relación entre sí (ej. `profiles.department_id -> departments.id` Y `departments.head_id -> profiles.id`), hay que desambiguar con `tabla_a!nombre_del_fk(campo)`. Para diagnosticar esto en el futuro sin acceso SSH al VPS, usar `mcp__Supabase__query_logs` contra `source = 'edge_logs'` filtrando por la tabla — ahí se ve el status code real (300, no 500) y la URL exacta de la query que falló.
- El sandbox de desarrollo **no tiene acceso de red al host de Supabase** (`Host not in allowlist`), ni siquiera corriendo el server local con las credenciales reales de producción — solo las tools `mcp__Supabase__*` (execute_sql, query_logs, apply_migration) pueden llegar a la DB real desde este entorno. No perder tiempo con `curl localhost:3000/api/...` esperando que refleje el comportamiento real contra producción.
