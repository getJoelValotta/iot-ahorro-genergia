# 05: Vincular y desvincular el collar

**What to build:** desde la ficha de una mascota, el dueño elige uno de sus dispositivos disponibles y lo vincula; también puede desvincularlo. El sistema avisa con claridad si el collar ya está en otra mascota o si la mascota ya tiene otro collar, y reintentar el mismo vínculo no da error. Al borrar una mascota, su collar queda libre.

**Blocked by:** 03 (Mascotas), 04 (Ovenbird y emparejamiento)

**Status:** done

- [x] `PUT /api/v1/pets/{petId}/device { deviceId }` → `200 Pet`; el dispositivo debe ser visible para el usuario (mismo filtro que `GET /devices`), si no → 404.
- [x] Collar vinculado a otra mascota → `409 DEVICE_ALREADY_LINKED` (garantizado también por la unicidad en la base).
- [x] Mascota con otro collar → `409 PET_ALREADY_HAS_DEVICE`; mismo collar → `200` idempotente.
- [x] `DELETE /api/v1/pets/{petId}/device` → `204`; mascota ajena → `404 PET_NOT_FOUND`.
- [x] Borrar una mascota libera su collar; `GET /devices` muestra el `petId` correcto o null.
- [x] Frontend: en la ficha de la mascota, selector de dispositivo + vincular/desvincular, con los mensajes de error del backend.
- [x] Tests: por HTTP (todos los 409, idempotencia, aislamiento, borrado que libera) y unitarios del servicio de vínculo con Ovenbird falso y repositorio en memoria.

## Comments

- 2026-11-23: Hecho (sesión 4). Verificado en el navegador (sesión 5): vincular desde la ficha.
