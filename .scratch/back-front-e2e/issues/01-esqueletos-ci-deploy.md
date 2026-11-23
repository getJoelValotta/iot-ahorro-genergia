# 01: Esqueletos, CI y deploy vacío

**What to build:** el punto de partida para que todo lo demás sea fácil. Un backend NestJS 11 y un frontend Next.js que arrancan, se testean en la CI y se pueden desplegar en Vercel. El backend ya responde con la infraestructura del contrato (prefijo `/api/v1`, CORS abierto, validación tolerante, errores RFC 9457 `problem+json`, Swagger, config validada al arrancar) y expone `GET /api/v1/capabilities` con `power-saving`. El frontend muestra una home que lee las capacidades a través de su propio servidor (base del intermediario/BFF). Supabase queda inicializado para desarrollo local y el SDK de Ovenbird (`.tgz`) queda commiteado para que Vercel pueda construir.

Ver spec: `.scratch/back-front-e2e/spec.md` y `docs/06-decisiones-arquitectura.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] El SDK de Ovenbird (node y react) está en el repo y sus `.d.ts` fueron leídos; lo que falte se anota en `docs/02`.
- [x] El backend (NestJS 11 + Jest) arranca en el puerto 3001; `GET /api/v1/capabilities` es pública y responde `{ apiVersion: "1", variants: ["power-saving"] }`.
- [x] Toda respuesta de error sale como `application/problem+json` con `type`, `title`, `status`, `detail`, `code` (y `errors` por campo en validación), sin detalles internos; una ruta inexistente da 404 en ese formato.
- [x] La validación descarta campos desconocidos sin dar 400.
- [x] Swagger disponible en `/api/docs` y `/api/docs-json`.
- [x] La config se valida al arrancar y falla con un mensaje claro si falta una variable; `.env.example` del back y del front con todas las variables de `docs/06` §6, sin valores.
- [x] El frontend (Next.js + Tailwind + shadcn) arranca en el puerto 3000 y su home muestra las capacidades obtenidas por su servidor (URL del back leída en tiempo de ejecución); si `/capabilities` falla, muestra modo base sin romperse.
- [x] Supabase inicializado (local con la CLI) con migraciones versionadas en el repo.
- [x] CI de GitHub Actions en verde en cada push a `main`: tests nativos del firmware, pytest del tooling, lint + Jest del back, lint + build del front.
- [x] Configuración de Vercel lista para ambos proyectos (back como función serverless); queda documentado en `docs/avances.md` qué tiene que conectar el equipo.
- [x] Tests por HTTP (supertest) de `capabilities`, 404 en `problem+json` y validación tolerante.

## Comments

- 2026-11-23: Hecho en local (sesión 4, commit e18f168). CI verde en GitHub Actions. `backend/vercel.json` + `backend/api/index.ts` escritos pero **sin deploy** (fuera de alcance por pedido del usuario).
