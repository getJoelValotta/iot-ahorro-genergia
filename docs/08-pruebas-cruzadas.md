# Pruebas cruzadas con otros grupos (checklist para clase)

Basado en la checklist de [docs/01](01-acuerdo-interoperabilidad.md#checklist-rápida-para-pruebas-cruzadas-en-clase).
Copiar la tabla de resultados del final, completarla en clase y commitearla.
**Nunca** intercambiar secretos (clientSecret, `.env`) con otros grupos: solo URLs y `DEV_ID`.

## A. Collar ↔ Unidad (interfaz 1)

Parámetros comunes: LoRa `433.175 MHz`, `SF7`, `BW 125 kHz`, `CR 4/5`, sync `0x12`, 14 dBm, CRC
activado. RadioSim: `115200 8N1`, bytes crudos, **sin logs** en el puerto (`*_sim_interop`).

### A1. Nuestro collar → unidad del Grupo X
1. Ellos configuran su unidad para vincularse con nuestro `DEV_ID` **`0x0101`**.
2. Simulación: `pio run -e collar_sim_interop` (sin logs). Conectar los dos puertos con el puente:
   `python firmware/tools/radiosim_bridge.py --collar <nuestro puerto> --unit <puerto de ellos>`.
   Placas reales: `collar_lora` y ponerlas cerca.
3. Verificar:
   - [ ] Su unidad recibe telemetría `0x01` con posición, batería y `SEQ` creciente.
   - [ ] La tolera aunque traiga nuestro TLV `0x10` (lo tiene que saltear).
   - [ ] `FIND_ME 0x02` (10 s): nuestro collar suena/prende el LED y responde `ACK OK`; se apaga solo.
   - [ ] `SET_INTERVAL 0x01` 150 s: nuestro collar pasa a ahorro (`FLAGS` con `MODO_AHORRO`,
         sin `ESCUCHA_CONTINUA`) y reporta cada 150 s. Ojo: en ahorro solo escucha 500 ms
         después de cada reporte; su unidad tiene que encolar los comandos.
   - [ ] `SET_INTERVAL` 15 s (mandado justo después de un reporte): vuelve a normal.
   - [ ] `REQUEST_TELEMETRY 0x03`: `ACK OK` + telemetría con TLV `0x01 FW_VERSION`.
   - [ ] `SET_INTERVAL 2` (fuera de rango): `ACK INVALID_PARAM` y no cambia nada.

### A2. Collar del Grupo X → nuestra unidad
1. En `firmware/platformio.ini`, cambiar `PAIRED_DEV_ID` al `DEV_ID` de su collar (ej. `0x0401`)
   y compilar `unit_sim_interop` (o `unit_lora`). **No** commitear ese cambio.
2. Conectar con el puente (`--collar <puerto de ellos> --unit <nuestro puerto>`) o por aire.
3. Verificar:
   - [ ] Nuestra unidad publica `# BLE LOCATION` / `# BLE STATUS` (o en la app Ovenbird Smart)
         con su posición y batería; `collar_online` en verdadero.
   - [ ] Duplicados descartados (`tel duplicada seq=`) y tramas de otro `DEV_ID` ignoradas.
   - [ ] Comandos desde la consola del puente (`find 10`, `interval 60`) o desde la app llegan a
         su collar y su `ACK` vuelve como `COMMAND_ACK`.
   - [ ] Si su collar no soporta ahorro, `interval 150` igual se confirma (solo cambia el intervalo).
   - [ ] Al apagar su collar, `collar_online` pasa a falso pasado `max(2 × I + 30 s, 60 s)`.

## B. Frontend ↔ Backend (interfaz 2)

### B1. Nuestro frontend → backend del Grupo X
1. En `frontend/.env.local`: `NEXT_PUBLIC_API_URL=<URL de ellos>/api/v1` (o `API_URL`) y
   reiniciar `npm run dev`. Nada más.
2. Ellos tienen que agregar `http://localhost:3000` (o nuestra URL) a los orígenes de **su**
   proyecto de Ovenbird; si no, el mapa no carga.
3. Verificar:
   - [ ] Registro, login, "Mi cuenta" y cerrar sesión.
   - [ ] Mascotas: listado paginado, alta, edición y baja.
   - [ ] Emparejar: código con vencimiento; la unidad aparece en "Tus dispositivos".
   - [ ] Vincular / desvincular desde la ficha.
   - [ ] Mapa: la mascota aparece con estado y batería (`embed-token` de su back).
   - [ ] La tarjeta "Batería y ahorro" **no aparece** si su `/capabilities` no anuncia
         `power-saving` (o da 404).
   - [ ] Un error de su back se ve como mensaje claro (sin detalles internos).
   - [ ] Al vencer su token, el front vuelve al login ("Tu sesión venció").

### B2. Frontend del Grupo X → nuestro backend
1. Levantar nuestro back accesible desde su máquina: `npm run start:dev` en una PC de la red del
   aula y pasarles `http://<IP-de-esa-PC>:3001/api/v1` (o la URL de Vercel cuando esté).
   Swagger para que lo consulten: `/api/docs`.
2. Agregar su origen (ej. `http://<IP-de-ellos>:3000`) a **nuestro** proyecto de Ovenbird, para que
   su mapa funcione con nuestros tokens.
3. Verificar:
   - [ ] Las 14 rutas comunes funcionan con su front (login, mascotas, emparejar, vincular, mapa).
   - [ ] `GET /capabilities` → `{"apiVersion":"1","variants":["power-saving"]}`; si su front no
         conoce la variante, la ignora sin romperse.
   - [ ] Errores en `application/problem+json` (`409 EMAIL_TAKEN`, `404 PET_NOT_FOUND`, etc.).

## C. Resultados

| Fecha | Grupo | Prueba | Resultado | Notas |
|---|---|---|---|---|
| | | A1 nuestro collar → su unidad | | |
| | | A2 su collar → nuestra unidad | | |
| | | B1 nuestro front → su back | | |
| | | B2 su front → nuestro back | | |
