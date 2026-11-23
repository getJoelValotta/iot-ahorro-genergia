# 09: "Celular falso" para Wokwi

**What to build:** un integrante del equipo puede reemplazar la app Ovenbird Smart por un script mientras prueba con Wokwi. El script que ya hace de "aire LoRa" entre collar y unidad suma el rol de celular: empareja la unidad simulada con un código, sube a Ovenbird la ubicación y el estado que la unidad publica por BLE (consola), y le pasa a la unidad los comandos que llegan de la nube, confirmándolos con el ACK de la unidad.

**Blocked by:** None (can start immediately). Para probarlo contra Ovenbird real hace falta un código de emparejamiento (del ticket 04 o de la consola de Ovenbird).

**Status:** ready-for-agent

- [ ] Verificado si `wokwi-cli --interactive` deja pasar las tramas binarias de RadioSim; documentado en `docs/04` cómo se corren las dos simulaciones (CLI, VS Code con RFC2217 o unidad + collar virtual).
- [ ] Módulo "celular" nuevo en el tooling Python, activado con una opción del puente existente, con código de emparejamiento y UID de prueba por parámetro y URL de Ovenbird por variable de entorno.
- [ ] Empareja con `ob.lora.unit` y guarda el token del puente solo en memoria (nunca en logs).
- [ ] Convierte LOCATION/STATUS BLE (little-endian, lat/lon × 10⁷) en reportes con DPs `location`, `battery_pct`, `collar_online`, `link_*`, con `seq` monotónico.
- [ ] Recibe comandos por long-poll, los traduce a COMMAND BLE (`find_me` → opcode 1, `report_interval_s` → opcode 2), y confirma `ok`/`error` según el COMMAND_ACK de la unidad (sin respuesta → error).
- [ ] Reintenta con espera creciente ante red/5xx y respeta 429; sigue funcionando si Ovenbird se cae un rato.
- [ ] Reusa los codecs existentes del tooling (sin duplicar el perfil BLE).
- [ ] Tests pytest por los dos bordes (líneas de consola de la unidad y cliente HTTP falso): emparejamiento, conversión de reportes, ciclo comando → `>ble` → ACK → confirmación, reintentos.
- [ ] Verificado a mano: la unidad simulada aparece en Ovenbird y sus datos llegan.
