# 02: Registro, login y sesión

**What to build:** el dueño de una mascota puede registrarse, iniciar sesión, ver su cuenta y cerrar sesión. El backend emite su propio JWT (bcrypt para contraseñas) y protege todas las rutas salvo las públicas. En el frontend, el servidor de Next guarda el token en una cookie `httpOnly` (nunca en `localStorage`) y reenvía las llamadas al backend con `Authorization: Bearer`; las páginas privadas redirigen al login.

**Blocked by:** 01 (Esqueletos, CI y deploy vacío)

**Status:** done

- [x] Tabla de usuarios por migración (email único en minúsculas, nombre, teléfono opcional, hash de contraseña, fechas).
- [x] `POST /api/v1/auth/register` → `201 AuthToken` (`accessToken`, `tokenType: "Bearer"`, `expiresIn`); contraseña ≥ 8; email repetido → `409 EMAIL_TAKEN`; datos inválidos → 400 con `errors`.
- [x] `POST /api/v1/auth/login` → `200 AuthToken`; credenciales incorrectas → `401 INVALID_CREDENTIALS` sin revelar si falló el email o la contraseña.
- [x] `GET /api/v1/auth/me` → `200 User` (`id`, `email`, `name`, `phone` o null); sin token o token inválido → 401.
- [x] Guard global: todo protegido salvo register, login y capabilities.
- [x] Frontend: pantallas de registro y login; al entrar, la cookie `httpOnly` (`SameSite=Lax`, `Secure` en producción, vence según `expiresIn` o 3600 s) queda guardada; "Mi cuenta" muestra nombre y email; logout borra la cookie.
- [x] Proxy del front al back: agrega `Bearer`, verifica `Origin` en métodos que modifican datos, y ante un 401 borra la cookie y redirige al login.
- [x] Las páginas privadas redirigen al login sin sesión.
- [x] Logs sin contraseñas ni tokens.
- [x] Tests: por HTTP (register/login/me y errores), unitarios del servicio de auth con repositorio en memoria, y test del proxy del front (cookie → `Bearer`, 401 → cookie borrada).

## Comments

- 2026-11-23: Hecho (sesión 4). Verificado en el navegador el 2026-11-23 (sesión 5): registro → cookie httpOnly → "Mis mascotas".
