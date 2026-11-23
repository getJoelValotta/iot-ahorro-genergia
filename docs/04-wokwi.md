# Wokwi — cómo simulamos

Wokwi simula ESP32 y Arduino Nano. **No simula Bluetooth ni el módulo LoRa**: el radio va por
`RadioSim` (tramas crudas por la UART) y el BLE de la unidad se emula por consola.

## Tres formas de usarlo (de más a menos automatizable)

### A. `wokwi-cli` + Claude Code (recomendado para trabajar con IA)
1. Token: https://wokwi.com/dashboard/ci → crear token → variable de entorno de usuario
   `WOKWI_CLI_TOKEN` (Windows: `setx WOKWI_CLI_TOKEN "..."`, reabrir la terminal). Nunca al repo.
2. Instalar CLI: `iwr https://wokwi.com/ci/install.ps1 -useb | iex` (Windows) o
   `curl -L https://wokwi.com/ci/install.sh | sh`. Requiere versión ≥ 0.29.
3. Ya configurado en el repo:
   - `.mcp.json` → servidor MCP `wokwi` (`wokwi-cli mcp`, experimental). Claude Code pide
     aprobarlo la primera vez que abrís el repo.
   - Skills oficiales de Wokwi (hacerlo una vez, dentro de Claude Code):
     `/plugin marketplace add wokwi/skills` y `/plugin install wokwi@wokwi-skills`.
4. Correr: `pio run -e collar_sim` y luego
   `wokwi-cli firmware/wokwi/collar --scenario scenarios/boot_and_telemetry.test.yaml --timeout 60000`.
5. **Las dos placas juntas sin VS Code** (verificado el 2026-11-23): `wokwi-cli` también abre el
   puerto RFC2217 de cada `wokwi.toml` (collar `:4000`, unidad `:4001`), así que alcanza con
   `wokwi-cli firmware/wokwi/unit --timeout 300000 &`, lo mismo con `collar`, y el puente de la
   opción B. Es lo que usa la demo de punta a punta ([07-demo.md](07-demo.md)).

**Límites del plan gratis** (vistos el 2026-11-23): cada simulación por CLI se corta a los
**5 minutos**, y hay una **cuota mensual de minutos de CI** (al agotarse: `API Error: You have used
up your Free plan monthly CI minute quota`). Si pasa, usar la opción B. El puente termina sin error
cuando una simulación se corta.

**Latencia**: las dos simulaciones corren en servidores de Wokwi y se hablan a través de nuestra
PC, y la ida y vuelta supera la ventana de escucha de 500 ms del collar en ahorro. Por eso
`collar_sim` usa `RX_WINDOW_MS=3000`; `collar_lora` y `collar_sim_interop` mantienen los 500 ms
del acuerdo.

### B. Extensión "Wokwi for VS Code" (visual, para ver el circuito y conectar las dos placas)
- Comando "Wokwi: Select Config File" → `firmware/wokwi/collar/wokwi.toml` (o `unit/`).
- Cada `wokwi.toml` expone la UART por RFC2217 (collar `:4000`, unidad `:4001`). Para
  conectar collar ↔ unidad: abrir dos ventanas de VS Code (una por simulación, la pestaña del
  simulador visible) y correr
  `python firmware/tools/radiosim_bridge.py --collar rfc2217://localhost:4000 --unit rfc2217://localhost:4001`.
- Con una sola placa, el bridge hace de par virtual (`--collar ...` = unidad virtual,
  `--unit ...` = collar virtual). Comandos de consola: `find 10`, `ahorro`, `normal`,
  `chaos loss=0.2 dup=0.1 corrupt=0.05`.
- Con `--cloud --pair-code <código> --uid <MAC de prueba>` el puente además hace de celular con
  la app Ovenbird Smart (empareja, sube los datos y entrega los comandos de la nube).

### C. wokwi.com (entregable: "enlace al proyecto de Wokwi")
- `python firmware/tools/export_wokwi_web.py collar` (y `unit`) arma una carpeta plana en
  `firmware/wokwi/web/` con `sketch.ino`, librerías propias, `diagram.json` y `libraries.txt`.
- Verificado el 2026-11-23 desde el navegador integrado de Claude: wokwi.com abre, se puede
  editar el código (Monaco) y lanzar la simulación. **Sin sesión iniciada** el build entra a
  una cola pública y no se puede guardar: iniciar sesión en wokwi.com en ese navegador antes de
  pedirle a Claude que cree/actualice los proyectos. Los proyectos gratis son **públicos**.

## Mapa de pines

| Collar (Nano) | Pin | Unidad (ESP32) | GPIO |
| --- | --- | --- | --- |
| LoRa NSS/RST/DIO0 | D10/D9/D2 | LoRa NSS/RST/DIO0 | 5/14/26 |
| GPS RX/TX (SoftwareSerial) | D4/D3 | LED online | 2 |
| Buzzer | D5 | Buzzer | 25 |
| LED FIND_ME | D6 | Botón FIND_ME 10 s | 4 |
| GPS_EN (LED "GPS ON" en Wokwi) | D7 | Botón ahorro/normal | 15 |
| Batería (potenciómetro) | A0 | | |

Wokwi no tiene Wemos D1 R32: se usa ESP32 DevKit v1 con los mismos GPIO.

## Consola BLE emulada (unidad en Wokwi)
- Salida: `# BLE LOCATION <hex16>`, `# BLE STATUS <hex8>`, `# BLE COMMAND_ACK <hex3>`.
- Entrada: `>ble <hex5>` (COMMAND), p. ej. `>ble 0700010a00` = find_me 10 s, cmd_id 7.
