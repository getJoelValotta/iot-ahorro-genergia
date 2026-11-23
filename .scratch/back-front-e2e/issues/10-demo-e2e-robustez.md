# 10: Demo de punta a punta y robustez

**What to build:** el equipo puede hacer el recorrido completo en simulación y mostrarlo: registrarse → crear mascota → generar código → el script empareja la unidad de Wokwi → vincular el collar → verla moverse en el mapa → activar el ahorro → ver "Aplicado en el collar" cuando el collar simulado confirma. Además, se demuestra que el sistema tolera pérdida, duplicados y corrupción en el enlace LoRa.

**Blocked by:** 06 (Mapa en vivo), 08 (Cambiar el modo de ahorro), 09 ("Celular falso" para Wokwi)

**Status:** ready-for-human

- [x] Recorrido completo ejecutado con el back y el front desplegados (o locales) y las dos simulaciones de Wokwi; arreglos que surjan, con sus tests.
- [x] El cambio a Ahorro llega al collar simulado (FLAGS con `MODO_AHORRO`, intervalo 150 s) y vuelve confirmado a la UI; el cambio a Normal también funciona estando en ahorro.
- [x] Caso "el collar no respondió" reproducido (por ejemplo, collar detenido) y visible en la UI.
- [ ] Demo de `chaos` (pérdida/duplicados/corrupción) ejecutada: la unidad descarta lo inválido y lo duplicado, y el mapa sigue funcionando; resultado documentado.
- [x] Guion paso a paso de la demo en `docs/`, que cualquiera del equipo pueda seguir, con el paso equivalente con hardware real para el jueves.
- [x] `docs/PLAN.md` y `docs/avances.md` actualizados.

## Comments

- 2026-11-23: Recorrido completo, ahorro/normal y "el collar no respondió" verificados con Wokwi (sesión 4). Pérdida y duplicados con `chaos` OK. **Falta la muestra en vivo de corrupción**: se agotó la cuota mensual de CI de Wokwi (cubierta por tests nativos de CRC y resincronización). Repetir con la extensión de VS Code o cuando vuelva la cuota y anotar el resultado en `docs/07` §4. Guion: `docs/07-demo.md`.
