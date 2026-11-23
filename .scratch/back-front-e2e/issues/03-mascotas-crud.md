# 03: Mascotas (CRUD)

**What to build:** el dueño ve el listado paginado de sus mascotas, crea una indicando solo nombre y especie (raza, fecha de nacimiento y foto opcionales), la edita y la borra. Nadie más puede ver ni tocar sus mascotas: una mascota ajena se comporta como si no existiera.

**Blocked by:** 02 (Registro, login y sesión)

**Status:** done

- [x] Tabla de mascotas por migración (dueño, nombre, especie, raza/fecha/foto opcionales, `device_id` único y opcional, columnas de modo de energía y último comando, fechas).
- [x] `GET /api/v1/pets?page&limit` → `{ data: Pet[], meta: { page, limit, total } }`, `limit` 1..100, solo las del usuario.
- [x] `POST /api/v1/pets` → `201 Pet`; solo `name` y `species` obligatorios (`dog`/`cat`/`other`); campos extra ignorados; inválido → 400 con `errors`.
- [x] `GET`, `PATCH` (parcial) y `DELETE` (`204`) de `/api/v1/pets/{petId}`; mascota ajena o inexistente → `404 PET_NOT_FOUND` (nunca 403).
- [x] `Pet` responde opcionales como `null`, `deviceId` null si no tiene collar, fechas ISO 8601 UTC, IDs string.
- [x] Frontend: listado paginado, alta, edición y baja (con confirmación), imagen por defecto sin foto, estados de carga y error con `detail`/`title`/mensaje genérico, responsive.
- [x] Tests: por HTTP (CRUD, paginación, aislamiento entre dos usuarios, validación) y unitarios del servicio de mascotas con repositorio en memoria.

## Comments

- 2026-11-23: Hecho (sesión 4). Verificado en el navegador (sesión 5): alta y ficha.
