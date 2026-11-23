# Avances

Registro cronológico de lo hecho en cada sesión (qué se instaló, qué se corrió, qué se arregló y
qué quedó pendiente). El estado global por fases está en [PLAN.md](PLAN.md).

---

## 2026-11-23 — Entorno de desarrollo en Windows + validación del firmware

### Herramientas instaladas (PC Windows 11)

| Herramienta | Versión | Cómo se instaló | Para qué |
|---|---|---|---|
| Python | 3.12.10 | `winget install -e --id Python.Python.3.12 --scope user` | PlatformIO y `firmware/tools` |
| PlatformIO Core (`pio`) | última de pip | `python -m pip install -U platformio` | compilar y testear el firmware |
| pytest | última de pip | `python -m pip install -U pytest` | tests de `firmware/tools` |
| `wokwi-cli` | 0.29.1 | `iwr https://wokwi.com/ci/install.ps1 -useb \| iex` → `%USERPROFILE%\.wokwi\bin` | simulación por CLI y servidor MCP |
| MinGW-w64 (`g++`) | WinLibs POSIX UCRT | `winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT` | `pio test -e native` (tests en la PC) |

Además:
- `WOKWI_CLI_TOKEN` quedó como **variable de entorno del usuario** (`setx WOKWI_CLI_TOKEN "<token>"`).
  El token **no** está en el repo; cada integrante genera el suyo en wokwi.com → *CI Dashboard*.
- Las toolchains de AVR (Nano) y ESP32 las descargó PlatformIO solo en el primer `pio run`
  (la de ESP32 tarda ~2–3 min la primera vez).
- `setx` y los instaladores modifican el PATH/variables **solo para programas abiertos después**:
  hay que reiniciar terminal, VS Code y Claude Code (el MCP de Wokwi de `.mcp.json` necesita
  `wokwi-cli` en el PATH y el token).

> Nota para otros integrantes en Windows: **sin `g++` los tests nativos no compilan**
> (`'g++' is not recognized`). En Linux/macOS ya viene con el sistema.

### Resultados

| Comando (desde `firmware/`) | Resultado |
|---|---|
| `pio test -e native` | ✅ 31/31 tests (`test_protocol` + `test_ble_and_logic`) |
| `cd tools && python -m pytest -q` | ✅ 12/12 tests |
| `wokwi-cli wokwi/collar --scenario scenarios/boot_and_telemetry.test.yaml --timeout 60000` | ✅ escenario completo |
| `wokwi-cli wokwi/unit --scenario scenarios/boot_and_button.test.yaml --timeout 60000` | ✅ escenario completo (después del arreglo de abajo) |

Compilación de todos los entornos (`pio run -e <env>`):

| Entorno | Placa | RAM | Flash |
|---|---|---|---|
| `collar_sim` | Nano (ATmega328P) | 45,1 % (923 / 2048 B) | 54,0 % (16 576 / 30 720 B) |
| `collar_sim_interop` | Nano | 40,5 % (829 B) | 50,7 % (15 570 B) |
| `collar_lora` | Nano | 40,8 % (835 B) | 49,1 % (15 084 B) |
| `unit_sim` | ESP32 | 6,8 % (22 256 / 327 680 B) | 21,2 % (277 293 / 1 310 720 B) |
| `unit_sim_interop` | ESP32 | 6,8 % | 21,0 % |
| `unit_lora` | ESP32 (con NimBLE) | 11,1 % (36 372 B) | 46,5 % (609 025 B) |

La unidad ESP32 (incluida la versión con BLE/NimBLE) **compila por primera vez**; antes estaba
marcada como "no compilada todavía" en el plan.

`pio run` sin `-e` solo compila `collar_sim` y `unit_sim` (los `default_envs`); para el resto hay
que nombrarlos.

### Arreglos en el código

1. **`firmware/test/test_ble_and_logic/test_main.cpp`**: faltaba `#include <stdio.h>` para
   `snprintf`. En Linux compilaba porque otro header lo incluía de rebote; con MinGW fallaba con
   `'snprintf' was not declared in this scope`. Solo se agregó el include.
2. **`firmware/wokwi/unit/scenarios/boot_and_button.test.yaml`**: el escenario fallaba por
   timeout aunque el firmware funcionaba bien. La unidad reacciona al **presionar** el botón y
   escribe `# ble cmd op=1 arg=10` durante el `delay: 200ms`; como `wait-serial` solo ve la
   salida que llega después de que empieza el paso, la línea se perdía. Ahora el orden es
   presionar → `wait-serial` → soltar.
   Lección para escenarios nuevos: poner el `wait-serial` inmediatamente después de la acción
   que dispara la salida, sin `delay` en el medio.

### Pendiente (ver PLAN.md)

- Puente collar↔unidad con `radiosim_bridge.py` y demo de robustez con `chaos`.
- Publicar los proyectos en wokwi.com (iniciar sesión en el navegador integrado de Claude).
- Correr `scripts/setup.ps1` para bajar el SDK de Ovenbird a `vendor/` (necesario para backend/frontend).
- Cuenta/proyecto en Ovenbird y `backend/.env` (credenciales nunca al repo).
- Placa real (`collar_lora` / `unit_lora`) y BLE contra la app Ovenbird Smart.
- Fases 2 (backend) y 3 (frontend).

---

## 2026-11-23 (sesión 2) — Definición de arquitectura para back, front y E2E con Wokwi

Sesión de preguntas y decisiones (sin código). Todo lo decidido, con sus motivos, quedó en
[06-decisiones-arquitectura.md](06-decisiones-arquitectura.md); el paso a paso de implementación, en
[PLAN.md](PLAN.md) (fases 1b a 5).

### Decisiones principales
- Back NestJS 11 y front Next.js, **los dos en Vercel**; base **Supabase** (local con `supabase start`).
- Login propio (bcrypt + JWT). El front guarda el token en una **cookie `httpOnly`** y su servidor
  reenvía las llamadas al back con `Bearer` (nunca `localStorage`). Riesgos de compatibilidad en `docs/06` §3.2.
- `docs/01` sigue siendo el contrato oficial. `COMPATIBILIDAD_FRONT_BACK.md` (del Grupo 7) se movió a
  [05-compatibilidad-front-back.md](05-compatibilidad-front-back.md) como referencia; implementamos
  una versión tolerante que cumple los dos (`docs/06` §3.1).
- Variante: tarjeta "Batería y ahorro" + `GET/PUT /api/v1/pets/{id}/power`; batería de ejemplo
  **1000 mAh** (supuesto documentado, configurable).
- E2E con Wokwi: `radiosim_bridge.py` suma un modo "celular falso" que habla con Ovenbird igual que la app.
- Git: todo directo a `main`.

### Datos relevados
- `openapi.json` de Ovenbird expone los endpoints de la app/puente: `POST /v1/app/pair` (sin auth),
  `POST /v1/ingest`, `GET /v1/bridge/commands?wait=`, `POST /v1/bridge/commands/{id}/ack`. Con eso el
  script puede reemplazar al celular en la prueba con Wokwi.
- `wokwi-cli` 0.29.1 tiene `--interactive` (stdin/stdout ↔ puerto serie): permitiría lanzar las dos
  simulaciones desde el script sin VS Code. **Falta verificar** que pase bytes binarios intactos.
- Herramientas presentes: Node 24.19, npm 11.17, pnpm 11.21, Docker 29.7, Supabase CLI 2.113.
- `vendor/` todavía no existe (no se corrió `scripts/setup`).
- `docs/01` dice "Grupo 7 (Nosotros)": el acuerdo se copió de otro grupo; el contrato no cambia.

### ⚠️ Pendiente del equipo (tareas manuales, en paralelo al código)

**1. Ovenbird** (https://iotplatform.ovenbirdconsulting.com.ar → *Cuenta* → proyecto)
- [ ] Agregar orígenes: `http://localhost:3000` y `http://localhost:3001`. Cuando exista el deploy,
      sumar la URL de Vercel del front (ej. `https://<proyecto>.vercel.app`). Sin esto el mapa no carga.
- [ ] Crear el **dispositivo virtual** del proyecto (consola web) para probar back y front sin placa.
- [ ] **Regenerar el `clientSecret` antes de la entrega**: el actual se pegó en un chat. Después de
      regenerarlo, actualizarlo en `backend/.env` y en Vercel.

**2. Supabase** (https://supabase.com/dashboard)
- [ ] *New project* (sugerido: `iot-mascotas-g1`, región São Paulo). Guardar la contraseña de la base
      en un gestor de contraseñas.
- [ ] De *Project Settings → API* anotar `Project URL` y la clave `service_role`. **No pegarlas en el
      chat ni en el repo**: van solo a Vercel.
- [ ] Vincular la CLI una vez que exista la migración: `supabase link --project-ref <ref>` y
      `supabase db push`.
- [ ] Para desarrollar en local: Docker Desktop abierto y `supabase start` desde la raíz del repo.

**3. Vercel** (después del primer push de los esqueletos, Fase 1b)
- [ ] *Add New → Project → Import* el repo de GitHub **dos veces**:
      `Root Directory = backend` y `Root Directory = frontend`.
- [ ] Ir anotando los secretos de Supabase y Vercel en el `.env` de la raíz (ignorado por git;
      plantilla con dónde se saca cada valor en `.env.example`).
- [ ] Cargar las variables de `docs/06` §6 en cada proyecto (panel *Settings → Environment Variables*
      o `vercel env add <NOMBRE>`). En el front, `NEXT_PUBLIC_API_URL` = URL del back en Vercel + `/api/v1`.
- [ ] Pasar las dos URLs resultantes para agregarlas al README y a los orígenes de Ovenbird.

**4. Wokwi**
- [ ] Iniciar sesión en wokwi.com en el navegador integrado de Claude (para guardar/publicar los proyectos).

**5. Hardware (antes del jueves)**
- [ ] Probar `collar_lora` / `unit_lora` en las placas y el BLE contra la app Ovenbird Smart (APK de `vendor/`).
- [ ] Si se consigue la batería real del collar, pasar su capacidad (mAh) para reemplazar el supuesto de 1000 mAh.

### Próximos pasos del agente (en orden, ver PLAN.md)
1. **Fase 1b**: setup del SDK, esqueletos de `backend/`, `frontend/` y `supabase/`, `.env.example`, CI → push.
2. **Fase 2**: backend completo con Jest y e2e.
3. **Fase 3**: frontend con BFF, mapa y tarjeta de ahorro.
4. **Fase 4**: "celular falso" + demo con Wokwi + `docs/07-demo.md`.
5. **Fase 5**: README final.

## Sesión 3 — 2026-11-23: secretos de la nube
- `.env` en la raíz (ignorado por git) con todos los valores de Supabase, Vercel, Ovenbird y
  `JWT_SECRET` (generado al azar). Plantilla con de dónde sale cada valor: `.env.example`.
- Verificado: las credenciales de Ovenbird obtienen token (`POST /v1/auth/token` → 200) y los cuatro
  orígenes (`localhost:3000/3001` y las dos URLs de Vercel) están aceptados por CORS.
- URLs de la app: back `https://iot-ahorro-genergia.vercel.app`, front
  `https://iot-ahorro-genergiafrontend.vercel.app`. Los tokens de Vercel son de proyecto (uno por proyecto).
- Pendiente: Root Directory en Vercel y rotar los secretos que pasaron por el chat (ver PLAN Fase 0).
