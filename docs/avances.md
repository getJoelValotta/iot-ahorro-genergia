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
