# TP Final IoT — Seguimiento de mascotas · Grupo 1 (variante `power-saving`)

Materia Sistemas Distribuidos (UNMdP). Collar LoRa (Arduino Nano + SX1278 + NEO-6M) ↔ Unidad
(ESP32 + SX1278 + BLE) ↔ app Ovenbird Smart ↔ Ovenbird IoT Cloud ↔ backend NestJS ↔ frontend Next.js.
Entrega con poco tiempo: se trabaja "IA first", pero cada pieza debe tener tests y quedar documentada.

## Leer antes de tocar algo
- `docs/PLAN.md` — qué está hecho y qué sigue (actualizarlo al terminar cada tarea).
- `docs/avances.md` — registro por sesión (instalaciones, resultados, arreglos); agregar una entrada al terminar.
- `docs/00-consigna.md` — consigna completa (requisitos no funcionales: se evalúan en código y demo).
- `docs/01-acuerdo-interoperabilidad.md` — **contrato entre los 8 grupos** (trama LoRa + API REST). No cambiarlo unilateralmente.
- `docs/02-ovenbird-plataforma.md` — API, SDKs, perfil BLE v1 y sus diferencias con el acuerdo.
- `docs/03-variante-ahorro-energia.md` — diseño de nuestra variante.
- `docs/04-wokwi.md` — simulación (wokwi-cli/MCP, VS Code + bridge, wokwi.com).
- `docs/05-compatibilidad-front-back.md` — referencia del Grupo 7 (el contrato vigente es docs/01).
- `docs/06-decisiones-arquitectura.md` — **decisiones acordadas** (Supabase, Vercel, BFF con cookie,
  versión tolerante del contrato, rutas de la variante, variables de entorno).

## Estructura
```
firmware/   PlatformIO: lib/pet_protocol (puro C++, testeado), lib/pet_radio (RadioSim/RadioLoRa),
            src/collar, src/unit, test/ (Unity), wokwi/ (diagram.json, wokwi.toml, escenarios), tools/ (Python)
backend/    (a crear) NestJS 11 + Jest
frontend/   (a crear) Next.js
docs/       documentación y vendor/ (vectores BLE, consigna PDF)
scripts/    setup.ps1 / setup.sh
vendor/     tarballs del SDK de Ovenbird (descargados por setup, ignorados por git)
```

## Comandos
- Tests firmware: `cd firmware && pio test -e native` (alternativa sin pio: `make test`)
- Tests herramientas: `cd firmware/tools && python -m pytest -q`
- Build: `cd firmware && pio run -e collar_sim -e unit_sim` (también `*_lora`, `*_sim_interop`)
- Simular: `wokwi-cli firmware/wokwi/collar --scenario scenarios/boot_and_telemetry.test.yaml --timeout 60000`
- Puente collar↔unidad / par virtual: `python firmware/tools/radiosim_bridge.py --help`
- Exportar a wokwi.com: `python firmware/tools/export_wokwi_web.py collar|unit`

## Reglas
- **Secretos**: nunca en código, repo, logs ni frontend. `.env` ignorado; solo `.env.example` sin valores.
  Los proyectos Wokwi gratis son públicos: ahí solo valores de prueba.
- **Interop**: big-endian en LoRa, little-endian en BLE; DEV_ID solo por config (`platformio.ini`,
  Grupo 1 = `0x0101`); extensiones solo en rangos propios (TLV/comandos `0x10..0x1F`).
- Toda lógica nueva del firmware va en `lib/pet_protocol` (sin Arduino) con test; los `main.cpp` solo cablean.
- El Nano tiene 2 KB de RAM: sin `String`, sin memoria dinámica, `F()` en logs.
- Backend: acceso a Ovenbird **solo** vía `@ovenbird/node`; frontend solo vía `@ovenbird/react`.
  Antes de usar el SDK, leer sus `.d.ts` en `node_modules/@ovenbird/*` (la doc web no tiene los tipos).
- Consigna pide **Jest** en el backend → NestJS 11 (Nest 12 usa Vitest).
- Idioma: código/identificadores en inglés (contrato camelCase), comentarios y docs en español.
- Wokwi: si hay que operar wokwi.com, usar el navegador integrado de Claude (la sesión de wokwi.com vive ahí).

## Agent skills

### Issue tracker

Issues y specs como markdown local en `.scratch/<feature>/` (spec en `spec.md`, tickets en `issues/NN-*.md`). See `docs/agents/issue-tracker.md`.

### Triage labels

Las cinco etiquetas por defecto (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` en la raíz + `docs/adr/`; las decisiones vigentes están en `docs/06-decisiones-arquitectura.md`. See `docs/agents/domain.md`.
