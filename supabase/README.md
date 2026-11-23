# Base de datos (Supabase / Postgres)

Esquema en `migrations/` (tablas `users`, `pets`, `pairing_sessions`; ver
[docs/06 §5](../docs/06-decisiones-arquitectura.md#5-base-de-datos-primera-migración)).

## Local (Docker Desktop abierto)
```bash
supabase start     # desde la raíz del repo; la primera vez baja las imágenes
supabase status    # "API URL" → SUPABASE_URL y "service_role key" → SUPABASE_SERVICE_ROLE_KEY (backend/.env)
supabase db reset  # borra todo y reaplica las migraciones
supabase stop
```
Puertos de este proyecto: API `54331`, Postgres `54332`, Studio `54333` (corridos 10 respecto de los
de fábrica para convivir con otros proyectos de Supabase en la misma PC).

## Nube
```bash
supabase link --project-ref <ref>
supabase db push
```
La clave `service_role` va solo al backend (Vercel / `backend/.env`), nunca al front ni al repo.

## Seguridad
Row Level Security está activado **sin políticas** y se quitaron los permisos de `anon` y
`authenticated`: solo entra el backend con la clave de servicio. Cada consulta del backend filtra
por dueño.
