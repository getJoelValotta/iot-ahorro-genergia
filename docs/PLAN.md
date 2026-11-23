# Plan de trabajo (para sesiones de Claude Code)

Estado al 2026-11-23. **Entrega: jueves 2026-11-26.** Marcar `[x]` al completar. Cada fase termina
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
      (`backend` / `frontend`) cuando existan las carpetas, y cargar las variables.
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
- [ ] `scripts/setup.*` → bajar SDK a `vendor/`; sacar `vendor/*.tgz` del `.gitignore` y commitearlos.
- [ ] Leer los `.d.ts` de `@ovenbird/node` y `@ovenbird/react` y anotar en `docs/02` lo que falte.
- [ ] `backend/`: `npx @nestjs/cli@11 new backend --strict --skip-git --package-manager npm`;
      instalar `@ovenbird/node` (`file:../vendor/...`), `@supabase/supabase-js`, `@nestjs/config`,
      `@nestjs/swagger`, `@nestjs/jwt`, `class-validator`, `class-transformer`, `bcryptjs`.
- [ ] `supabase/` en la raíz: `supabase init` + migración inicial (`docs/06` §5).
- [ ] `frontend/`: `npx create-next-app@latest frontend --ts --app --tailwind --eslint --src-dir`;
      `shadcn init`; instalar `@ovenbird/react` y agregarlo a `transpilePackages`.
- [ ] `.env.example` en `backend/` y `frontend/` (lista de `docs/06` §6, sin valores).
- [ ] `.github/workflows/ci.yml`: jobs `firmware` (pio test native + pytest), `backend` (lint + Jest), `frontend` (lint + build).
- [ ] Configuración de Vercel para cada carpeta (`vercel.json` del back para Nest serverless).
- [ ] Commit + push → los humanos conectan Vercel (Fase 0).

## Fase 2 — Backend NestJS (`backend/`)
Contrato: `docs/01` Parte II (14 rutas), con la versión tolerante de `docs/06` §3.1.
- [ ] Infra: prefijo `/api/v1`, `enableCors()`, `ValidationPipe({whitelist, forbidNonWhitelisted:false, transform})`,
      filtro RFC 9457 (`application/problem+json`), Swagger `/api/docs` + `/api/docs-json`, config validada al arrancar,
      logs sin datos sensibles.
- [ ] `DatabaseModule`: cliente supabase-js + repositorios (`UsersRepository`, `PetsRepository`, `PairingRepository`).
- [ ] `AuthModule`: register/login/me, bcrypt, JWT, guard global con `@Public()`. Jest.
- [ ] `PetsModule`: CRUD + paginación `{data, meta}` + aislamiento (ajeno ⇒ `404 PET_NOT_FOUND`);
      al borrar, desvincula antes. Jest.
- [ ] `OvenbirdModule`: `OvenbirdModule.forRootAsync` + traducción de errores (404/422/429/502-503). Jest.
- [ ] `DevicesModule`: `POST /pairing-codes`, `GET /devices` (filtrado por vínculo + ventana de 10 min),
      `PUT/DELETE /pets/{id}/device` (409s). Jest con SDK simulado.
- [ ] `POST /embed-token` y `GET /capabilities` (`variants: ["power-saving"]`).
- [ ] `PowerModule` (variante): `power-model.ts` puro + test; `GET/PUT /pets/{id}/power` (`docs/06` §4),
      `x-variant` en Swagger.
- [ ] e2e con supertest (las 14 rutas + power) con repositorios en memoria y SDK simulado.
- [ ] Deploy en Vercel y prueba contra el dispositivo virtual de Ovenbird.

## Fase 3 — Frontend Next.js (`frontend/`)
- [ ] BFF: route handlers `/api/auth/{login,register,logout}` (cookie `httpOnly`) y proxy `/api/backend/[...path]`
      que agrega `Bearer`; 401 ⇒ borra cookie y redirige. Verificación de `Origin`.
- [ ] Contexto de `capabilities` (falla ⇒ `variants = []`).
- [ ] Login / registro, rutas protegidas (middleware que mira la cookie).
- [ ] Mascotas: listado paginado, alta, edición y baja.
- [ ] Emparejar: código + cuenta regresiva de vencimiento + instrucciones para la app; vincular/desvincular.
- [ ] Mapa: `OvenbirdProvider` (`getToken` → `/api/embed-token` del Next) + `DeviceMap`; centrar la mascota elegida.
- [ ] `useDeviceStatus` + `OnlineBadge` + `BatteryIndicator`.
- [ ] Tarjeta "Batería y ahorro" (solo si `power-saving` está en `variants`).
- [ ] Estados de carga y error en todas las pantallas; responsive (celular y escritorio).
- [ ] Deploy en Vercel; agregar su URL a los orígenes de Ovenbird.

## Fase 4 — Prueba de punta a punta con Wokwi
- [ ] Verificar si `wokwi-cli --interactive` deja pasar bytes binarios (tramas RadioSim). Si no:
      dos ventanas de VS Code (RFC2217 `:4000`/`:4001`) o unidad en Wokwi + collar virtual del script.
- [ ] `firmware/tools/ble_cloud.py` ("celular falso"): pair, ingest, long-poll de comandos, ack; pytest con HTTP simulado.
- [ ] `radiosim_bridge.py --cloud --pair-code <code> --uid <mac-de-prueba>`.
- [ ] Demo de robustez con `chaos` (pérdida/duplicados/corrupción) documentada.
- [ ] `docs/07-demo.md`: guion paso a paso (registro → mascota → código → script → vincular → mapa → ahorro → ACK).
- [ ] Publicar ambos proyectos en wokwi.com (`export_wokwi_web.py`) y poner los links en el README.

## Fase 5 — Entrega
- [ ] README único: variante, diagrama, cómo correr cada componente, variables (sin valores),
      decisiones y justificación de los requisitos no funcionales.
- [ ] Pruebas cruzadas con otros grupos (checklist de `docs/01`).
- [ ] Credenciales al docente por el canal que indique (nunca en el repo), con el secret ya regenerado.
