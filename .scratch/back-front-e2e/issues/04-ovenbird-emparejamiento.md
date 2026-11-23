# 04: Ovenbird y emparejamiento

**What to build:** el dueño genera un código de emparejamiento, ve cuánto le queda antes de vencer y las instrucciones para ingresarlo en la app Ovenbird Smart, y después ve la lista de dispositivos que puede vincular: los suyos y los que aparecieron dentro de la ventana de 10 minutos de su código (nunca los de otros usuarios). El backend habla con Ovenbird solo a través de `@ovenbird/node` y traduce sus errores a respuestas HTTP coherentes.

**Blocked by:** 02 (Registro, login y sesión). Puede ir en paralelo con 03.

**Status:** done

- [x] Módulo Ovenbird configurado por variables de entorno; el `clientSecret` nunca aparece en respuestas ni en logs.
- [x] Traducción de errores del SDK: no encontrado → 404, validación → 422, rate limit → 429, auth/red/5xx → 502/503, todos en `problem+json` sin detalles internos.
- [x] Tabla de sesiones de emparejamiento por migración (usuario, código, vencimiento).
- [x] `POST /api/v1/pairing-codes` (body opcional `{ label? }`) → `201 { code, expiresAt }` y registra la ventana del usuario.
- [x] `GET /api/v1/devices` → `{ data: Device[], meta }` con `deviceId`, `name`, `productId`, `online`, `lastSeenAt` (null solo si nunca se vio) y `petId`; filtra vinculados al usuario + libres aparecidos dentro de su ventana.
- [x] Frontend: pantalla "Emparejar" con el código, cuenta regresiva hasta el vencimiento, instrucciones para la app, botón para regenerar y lista de dispositivos (en línea / última vez visto); estados de carga y error.
- [x] Verificado a mano contra el dispositivo virtual del proyecto de Ovenbird (anotar resultado en `docs/avances.md`).
- [x] Tests: por HTTP con el servicio de Ovenbird falso (código, filtrado por ventana, otro usuario no ve el dispositivo, traducción de cada error).

## Comments

- 2026-11-23: Hecho (sesión 4). Verificado contra Ovenbird real con una unidad emparejada por el "celular falso" (en lugar del dispositivo virtual).
