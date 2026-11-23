# 06: Mapa en vivo

**What to build:** el dueño ve en un mapa todas sus mascotas con collar; al elegir una, el mapa se centra en ella. Para cada una ve si el collar está en línea, su batería y cuándo se recibió el último dato. El mapa sigue funcionando cuando vence su token y muestra un mensaje claro si no hay collares vinculados.

**Blocked by:** 05 (Vincular y desvincular el collar)

**Status:** ready-for-agent

- [ ] `POST /api/v1/embed-token { deviceIds?, petId?, ttlS? }` → `200 { token, expiresAt }`; sin parámetros usa todos los collares del usuario (1..50); sin collares → `409 NO_LINKED_DEVICES`; `deviceIds`/`petId` ajenos → 403/404 sin revelar existencia; `ttlS` por defecto 900, máximo 3600; nunca devuelve el `clientSecret`.
- [ ] Frontend: `OvenbirdProvider` con `getToken` contra una ruta del propio Next que pide el token al backend con la cookie; `DeviceMap` con las mascotas vinculadas; al elegir una se centra.
- [ ] `useDeviceStatus` + `OnlineBadge` + `BatteryIndicator` + última vez visto por mascota.
- [ ] Estados de carga y error; mensaje con enlace a "Emparejar" si no hay collares.
- [ ] Las llamadas a Ovenbird salen solo de `@ovenbird/react`.
- [ ] Verificado a mano con el dispositivo virtual de Ovenbird (requiere orígenes `localhost:3000` y la URL de Vercel cargados).
- [ ] Tests: por HTTP de `embed-token` (todos los casos de arriba) con Ovenbird falso.
