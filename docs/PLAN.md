# Plan de trabajo (para sesiones de Claude Code)

Estado al 2026-11-23. Marcar `[x]` al completar. Cada fase termina con sus tests en verde.
Detalle de cada sesión (qué se instaló, resultados, arreglos): [avances.md](avances.md).

## Fase 0 — Setup (humano, una vez)
- [ ] Correr `scripts/setup.ps1` (Windows) → descarga SDK/vectores/APK a `vendor/`, chequea herramientas.
- [ ] Crear cuenta y proyecto en Ovenbird; guardar `clientId`/`clientSecret` en `backend/.env` (nunca al repo).
      Orígenes: `http://localhost:3000`, `http://localhost:3001` + los de otros grupos.
- [ ] Crear el dispositivo virtual del proyecto (para probar backend/front sin placa).
- [x] `WOKWI_CLI_TOKEN` como variable de entorno; instalar `wokwi-cli` (ver docs/04-wokwi.md).
- [ ] Iniciar sesión en wokwi.com en el navegador integrado de Claude (para guardar proyectos).
- [x] Instalar PlatformIO (`pip install platformio` o extensión de VS Code).
- [x] Windows: instalar `g++` (MinGW-w64/WinLibs) para `pio test -e native` (ver avances.md).

## Fase 1 — Firmware (base hecha, falta validar en simulador/placa)
- [x] `lib/pet_protocol`: CRC, trama v1, parser con resync, BLE v1, lógica collar/unidad, NMEA sim.
- [x] Tests: 31 nativos (Unity) + 12 Python, con los 8 vectores del acuerdo y los 6 BLE de Ovenbird.
- [x] Collar compilado para ATmega328P (59,7 % flash, 51,7 % RAM) y probado en simavr.
- [x] `pio test -e native` (31/31) y `pio run` de los 6 entornos en la PC, incluida la unidad ESP32/NimBLE.
- [x] Correr escenarios Wokwi de collar y unidad (ambos pasan).
- [ ] Puente collar↔unidad con `radiosim_bridge.py`.
- [ ] Demo de robustez con `chaos` (pérdida/duplicados/corrupción) documentada.
- [ ] Publicar ambos proyectos en wokwi.com y poner los links en el README.
- [ ] Placa real: `collar_lora`/`unit_lora`, BLE contra la app Ovenbird Smart.

## Fase 2 — Backend NestJS (`backend/`, no creado todavía)
Usar **NestJS 11** (`npx @nestjs/cli@11 new backend --strict --skip-git`): Nest 12 trae Vitest y
ESM, y la consigna pide **Jest**; además el módulo `@ovenbird/node/nest` es anterior a Nest 12.
- [ ] Infra: prefijo `/api/v1`, CORS, `ValidationPipe({whitelist, forbidNonWhitelisted:false, transform})`,
      filtro RFC 9457 (`application/problem+json`), Swagger `/api/docs` + `/api/docs-json`, config validada.
- [ ] Persistencia (sugerido Prisma + SQLite en dev) con instrucciones.
- [ ] Auth propio: register/login/me, bcrypt, JWT.
- [ ] Pets CRUD + paginación `{data, meta}` + aislamiento (ajeno ⇒ 404).
- [ ] Ovenbird: `OvenbirdModule.forRoot` + traducción de errores (404/422/429/502-503).
- [ ] Devices: pairing-codes, devices (filtrado), PUT/DELETE pets/{id}/device (409s).
- [ ] embed-token, capabilities (`variants: ["power-saving"]`).
- [ ] Variante: modelo de consumo + endpoints (docs/03).
- [ ] Jest: auth, pets, vínculo con SDK simulado.
Contrato exacto: docs/01 Parte II (14 rutas).

## Fase 3 — Frontend Next.js (`frontend/`, no creado todavía)
- [ ] `create-next-app` (TS, app router, Tailwind). `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_OVENBIRD_URL`.
- [ ] Login/registro, rutas protegidas, mascotas (listado/alta/edición/baja).
- [ ] Emparejar: código + vencimiento + instrucciones; vincular/desvincular.
- [ ] Mapa: `OvenbirdProvider` + `DeviceMap`, `getToken` → backend; centrar mascota seleccionada.
- [ ] `useDeviceStatus` + `OnlineBadge` + `BatteryIndicator`; estados de carga/error; responsive.
- [ ] Leer `/capabilities` y mostrar UI de ahorro/autonomía solo si está `power-saving`.

## Fase 4 — Entrega
- [ ] README único (variante, diagrama, cómo correr, env vars sin valores, decisiones y RNF).
- [ ] Deploy del front (y backend si se puede). Pruebas cruzadas con otros grupos (checklist en docs/01).
