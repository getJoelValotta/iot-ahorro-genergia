# Plan de trabajo (para sesiones de Claude Code)

Estado al 2026-11-23 (actualizado al final de la sesión 5). **Entrega: jueves 2026-11-26.** Marcar `[x]` al completar. Cada fase termina
con sus tests en verde, un commit directo a `main` y una entrada en [avances.md](avances.md).
Decisiones y motivos: [06-decisiones-arquitectura.md](06-decisiones-arquitectura.md).

Orden de trabajo (un agente, en secuencia): **Fase 0 (humanos, en paralelo) → 1b → 2 → 3 → 4 → 5.**
Reparto por frentes si trabaja más de una persona: (1) back core, (2) back Ovenbird + variante,
(3) front base, (4) front mapa + variante, (5) firmware, E2E Wokwi y README.

## Fase 0 — Tareas manuales del equipo
Checklist detallada con el paso a paso en [avances.md](avances.md) (sesión 2).
- [x] Ovenbird: agregar orígenes `http://localhost:3000`, `http://localhost:3001` y las dos URLs de Vercel (verificado por CORS).
- [ ] Ovenbird: crear el dispositivo virtual del proyecto.
- [ ] Ovenbird: **regenerar el `clientSecret`** antes de la entrega (el actual se compartió en un chat).
- [x] Supabase: crear el proyecto en la nube (credenciales en el `.env` de la raíz).
- [ ] Vercel: importar el repo como dos proyectos (`backend/` y `frontend/`) y cargar las variables.
      Proyectos creados (`iot-ahorro-genergia` y `iot-ahorro-genergia_frontend`); falta Root Directory
      (`backend` / `frontend`) y cargar las variables. Las carpetas ya existen; el deploy quedó fuera de la sesión 5.
- [ ] **Rotar antes de la entrega** (pasaron por el chat): tokens de Vercel, access token y `sb_secret` de
      Supabase, contraseña de la base, `clientSecret` de Ovenbird.
- [ ] Iniciar sesión en wokwi.com en el navegador integrado de Claude (para publicar los proyectos).
- [x] `WOKWI_CLI_TOKEN`, `wokwi-cli`, PlatformIO, `g++` (MinGW) instalados.

## Fase 1 — Firmware (base hecha)
- [x] `lib/pet_protocol`: CRC, trama v1, parser con resync, BLE v1, lógica collar/unidad, NMEA sim.
- [x] Tests: 31 nativos (Unity) + 12 Python, con los 8 vectores del acuerdo y los 6 BLE de Ovenbird.
- [x] `pio run` de los 6 entornos y escenarios Wokwi de collar y unidad en verde.
- [ ] Placa real: `collar_lora`/`unit_lora`, BLE contra la app Ovenbird Smart (antes del jueves).

## Fase 1b — Esqueletos + CI (primer paso del agente)
- [x] `scripts/setup.*` → bajar SDK a `vendor/`; sacar `vendor/*.tgz` del `.gitignore` y commitearlos.
- [x] Leer los `.d.ts` de `@ovenbird/node` y `@ovenbird/react` y anotar en `docs/02` lo que falte.
- [x] `backend/`: `npx @nestjs/cli@11 new backend --strict --skip-git --package-manager npm`;
      instalar `@ovenbird/node` (`file:../vendor/...`), `@supabase/supabase-js`, `@nestjs/config`,
      `@nestjs/swagger`, `@nestjs/jwt`, `class-validator`, `class-transformer`, `bcryptjs`.
- [x] `supabase/` en la raíz: `supabase init` + migración inicial (`docs/06` §5).
- [x] `frontend/`: `npx create-next-app@latest frontend --ts --app --tailwind --eslint --src-dir`;
      `shadcn init`; instalar `@ovenbird/react` y agregarlo a `transpilePackages`.
- [x] `.env.example` en `backend/` y `frontend/` (lista de `docs/06` §6, sin valores).
- [x] `.github/workflows/ci.yml`: jobs `firmware` (pio test native + pytest), `backend` (lint + Jest), `frontend` (lint + build).
- [x] Configuración de Vercel para cada carpeta (`vercel.json` del back para Nest serverless).
- [x] Commit + push → los humanos conectan Vercel (Fase 0).

## Fase 2 — Backend NestJS (`backend/`)
Contrato: `docs/01` Parte II (14 rutas), con la versión tolerante de `docs/06` §3.1.
- [x] Infra: prefijo `/api/v1`, `enableCors()`, `ValidationPipe({whitelist, forbidNonWhitelisted:false, transform})`,
      filtro RFC 9457 (`application/problem+json`), Swagger `/api/docs` + `/api/docs-json`, config validada al arrancar,
      logs sin datos sensibles.
- [x] `DatabaseModule`: cliente supabase-js + repositorios (`UsersRepository`, `PetsRepository`, `PairingRepository`).
- [x] `AuthModule`: register/login/me, bcrypt, JWT, guard global con `@Public()`. Jest.
- [x] `PetsModule`: CRUD + paginación `{data, meta}` + aislamiento (ajeno ⇒ `404 PET_NOT_FOUND`);
      al borrar, desvincula antes. Jest.
- [x] `OvenbirdModule`: `OvenbirdModule.forRootAsync` + traducción de errores (404/422/429/502-503). Jest.
- [x] `DevicesModule`: `POST /pairing-codes`, `GET /devices` (filtrado por vínculo + ventana de 10 min),
      `PUT/DELETE /pets/{id}/device` (409s). Jest con SDK simulado.
- [x] `POST /embed-token` y `GET /capabilities` (`variants: ["power-saving"]`).
- [x] `PowerModule` (variante): `power-model.ts` puro + test; `GET/PUT /pets/{id}/power` (`docs/06` §4),
      `x-variant` en Swagger.
- [x] e2e con supertest (las 14 rutas + power) con repositorios en memoria y SDK simulado.
- [ ] Deploy en Vercel. (Probado en local contra Supabase local y Ovenbird real, con una unidad emparejada por el script.)

## Fase 3 — Frontend Next.js (`frontend/`)
- [x] BFF: route handlers `/api/auth/{login,register,logout}` (cookie `httpOnly`) y proxy `/api/backend/[...path]`
      que agrega `Bearer`; 401 ⇒ borra cookie y redirige. Verificación de `Origin`.
- [x] Contexto de `capabilities` (falla ⇒ `variants = []`).
- [x] Login / registro, rutas protegidas (middleware que mira la cookie).
- [x] Mascotas: listado paginado, alta, edición y baja.
- [x] Emparejar: código + cuenta regresiva de vencimiento + instrucciones para la app; vincular/desvincular.
- [x] Mapa: `OvenbirdProvider` (`getToken` → `/api/embed-token` del Next) + `DeviceMap`; centrar la mascota elegida.
- [x] `useDeviceStatus` + `OnlineBadge` + `BatteryIndicator`.
- [x] Tarjeta "Batería y ahorro" (solo si `power-saving` está en `variants`).
- [x] Estados de carga y error en todas las pantallas; responsive (celular y escritorio). Revisado en el navegador
      en escritorio (registro → mascota → código → vincular → ahorro confirmado → mapa); falta mirarlo en un celular.
- [ ] Deploy en Vercel (los orígenes de Ovenbird ya incluyen las URLs de Vercel).

## Fase 4 — Prueba de punta a punta con Wokwi
- [x] Las dos placas por `wokwi-cli` (abre RFC2217 `:4000`/`:4001`, no hace falta VS Code). Límites del plan gratis:
      5 min por simulación y cuota mensual de CI (**agotada el 2026-11-23**).
- [x] `firmware/tools/ble_cloud.py` ("celular falso"): pair, ingest, long-poll de comandos, ack; pytest con HTTP simulado.
- [x] `radiosim_bridge.py --cloud --pair-code <code> --uid <mac-de-prueba>`.
- [ ] Demo de robustez con `chaos`: pérdida, duplicados y "el collar no respondió" hechos y documentados en
      `docs/07`; **falta la muestra en vivo de corrupción** (cuota de Wokwi agotada; cubierta por tests nativos).
- [x] `docs/07-demo.md`: guion paso a paso (registro → mascota → código → script → vincular → mapa → ahorro → ACK).
- [ ] Publicar ambos proyectos en wokwi.com (`export_wokwi_web.py`) y poner los links en el README.

## Fase 5 — Entrega
- [x] README único: variante, diagrama, cómo correr cada componente, variables (sin valores),
      decisiones y justificación de los requisitos no funcionales. Falta agregar los links de Vercel y Wokwi.
- [x] Checklist de pruebas cruzadas listo: `docs/08-pruebas-cruzadas.md`.
- [ ] Hacer las pruebas cruzadas en clase y anotar los resultados en `docs/08` §C.
- [ ] Credenciales al docente por el canal que indique (nunca en el repo), con el secret ya regenerado.
