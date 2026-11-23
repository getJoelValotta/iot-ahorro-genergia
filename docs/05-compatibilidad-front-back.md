# 🔗 Compatibilidad Definitiva Frontend ↔ Backend (Estándar Unificado)

> **Nota del Grupo 1:** documento de referencia escrito por el Grupo 7 (por eso habla de `lost-pet`).
> El contrato vigente es [01-acuerdo-interoperabilidad.md](01-acuerdo-interoperabilidad.md). Donde
> los dos difieren, implementamos una versión tolerante que cumple ambos: ver
> [06-decisiones-arquitectura.md §3](06-decisiones-arquitectura.md#3-compatibilidad-con-otros-grupos).

Este documento reúne **la mejor opción unificada** para que el Frontend (Next.js) de cualquier grupo funcione con el Backend (NestJS) de cualquier otro grupo sin tocar código, integrando el contrato `/api/v1` + `GET /capabilities` + RFC 9457 con todas las protecciones de tolerancia a fallos, conexión a Ovenbird y la variante **Mascota Perdida (`lost-pet`)**.

---

## 1. Reglas Globales Obligatorias

| Regla | Estándar Acordado | Por qué |
| :--- | :--- | :--- |
| **Prefijo de API** | `/api/v1` | Permite versionar a `/api/v2` sin romper frontends existentes. |
| **Formato y Nombres** | `application/json`, inglés en `camelCase` | Evita errores `undefined` por diferencias de idioma (`name` vs `nombre`). |
| **IDs y Fechas** | IDs siempre `string` · Fechas ISO 8601 en UTC | Evita fallos entre UUIDs y enteros autoincrementales de distintas DBs. |
| **Autenticación** | `Authorization: Bearer <accessToken>` | JWT emitido por el backend (internamente cada grupo usa JWT propio o Auth0). |
| **Paginación** | `?page=1&limit=20` ➔ `{ data: [...], meta: { page, limit, total } }` | Garantiza que las listas paginadas se rendericen igual en cualquier React. |
| **Errores (RFC 9457)** | `Content-Type: application/problem+json`<br>`{ type, title, status, detail, code, errors? }` | Cualquier frontend puede mostrar mensajes claros y códigos estables sin conocer la lógica interna del backend. |
| **Variantes** | Descubrimiento dinámico con `GET /api/v1/capabilities` | Cada frontend oculta botones de variantes que el backend conectado no soporta. |
| **Base de Datos** | 100% libre y privada de cada grupo | El frontend nunca toca la DB; Backend + DB viajan como un bloque cerrado. |

---

## 2. Modelos Base Unificados

* **Regla de extensibilidad:** Los backends pueden agregar campos propios, pero **nunca quitar** ni renombrar los base. Los clientes ignoran los campos que no conocen.

```typescript
// AuthToken
{
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number; // segundos
}

// User
{
  id: string;
  email: string;
  name: string;
  phone?: string; // Opcional (útil para contacto en mascota perdida)
}

// Pet
{
  id: string;
  name: string;                          // Obligatorio al crear
  species: "dog" | "cat" | "other";      // Obligatorio al crear
  breed?: string;                        // Opcional
  birthDate?: string;                    // Opcional (ISO UTC)
  photoUrl?: string;                     // Opcional
  deviceId: string | null;               // ID de Ovenbird vinculado o null
  createdAt: string;
  updatedAt: string;
}

// Device
{
  deviceId: string;
  name: string;
  productId: string; // "ob.lora.unit"
  online: boolean;
  lastSeenAt: string;
  petId: string | null; // null si está libre para vincular
}
```

---

## 3. Endpoints Comunes Obligatorios (Idénticos en Todos)

| Módulo | Método y Ruta | Auth | Request / Query | Response | Errores comunes |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Auth** | `POST /api/v1/auth/register` | — | `{ email, password (≥8), name, phone? }` | `201 AuthToken` | `400`, `409 EMAIL_TAKEN` |
| **Auth** | `POST /api/v1/auth/login` | — | `{ email, password }` | `200 AuthToken` | `400`, `401` |
| **Auth** | `GET /api/v1/auth/me` | ✔ | — | `200 User` | `401` |
| **Mascotas** | `GET /api/v1/pets` | ✔ | `?page=1&limit=20` | `200 { data: Pet[], meta }` | `401` |
| **Mascotas** | `POST /api/v1/pets` | ✔ | `{ name, species, breed?, birthDate?, photoUrl? }` | `201 Pet` | `400`, `401` |
| **Mascotas** | `GET /api/v1/pets/{petId}` | ✔ | — | `200 Pet` | `401`, `404 PET_NOT_FOUND` |
| **Mascotas** | `PATCH /api/v1/pets/{petId}` | ✔ | Campos parciales de `Pet` | `200 Pet` | `400`, `401`, `404` |
| **Mascotas** | `DELETE /api/v1/pets/{petId}` | ✔ | — | `204 No Content` | `401`, `404` |
| **Dispositivos** | `POST /api/v1/pairing-codes` | ✔ | — | `201 { code, expiresAt }` | `401` |
| **Dispositivos** | `GET /api/v1/devices` | ✔ | — | `200 { data: Device[] }` | `401` |
| **Dispositivos** | `PUT /api/v1/pets/{petId}/device` | ✔ | `{ deviceId }` | `200 Pet` | `400`, `401`, `404`, `409 DEVICE_ALREADY_LINKED` |
| **Dispositivos** | `DELETE /api/v1/pets/{petId}/device` | ✔ | — | `204 No Content` | `401`, `404` |
| **Mapa** | `POST /api/v1/embed-token` | ✔ | `{ deviceIds?: string[] }` *(opcional)* | `200 { token, expiresAt }` | `401`, `409 NO_LINKED_DEVICES` |
| **Variantes** | `GET /api/v1/capabilities` | — | — | `200 { apiVersion: "1", variants: string[] }` | — |

---

## 4. Descubrimiento de Variantes (`GET /capabilities`) y Nuestra Variante (`lost-pet`)

Identificadores oficiales para `variants`: `power-saving`, `gps-quality`, `link-loss-zones`, `find-and-guide`, `history-routes`, `sharing-roles`, `lost-pet`, `notifications`.

### Endpoints de la Variante `lost-pet` (Grupo 7)
| Método y Ruta | Auth | Acción interna (Ovenbird + DB) | Response |
| :--- | :---: | :--- | :--- |
| `POST /api/v1/pets/{petId}/lost` | ✔ | Marca `isLost = true`, genera `publicToken`, envía a Ovenbird `{ dps: { report_interval_s: 5, find_me: 5 } }`. | `200 { isLost: true, publicToken, publicUrl }` |
| `DELETE /api/v1/pets/{petId}/lost` | ✔ | Marca `isLost = false`, revoca `publicToken`, envía a Ovenbird `{ dps: { report_interval_s: 60 } }`. | `200 { isLost: false }` |
| `GET /api/v1/public/lost-pet/{token}` | — | Busca mascota por `token` (si no está perdida responde `404`). Genera `embedToken` de solo lectura. | `200 { name, species, breed, photoUrl, ownerName, contactPhone, lastSeen, embedToken, deviceId }` |
| `POST /api/v1/public/lost-sighting` *(Extra AirTag)* | — | Recibido por WiFi desde ESP32 vecinas si escuchan otro collar (`{ collarId, lat, lon, battery }`). Si `isLost == true`, guarda avistamiento y responde `{ lost: true, targetInterval: 5 }`. | `200 { lost: boolean, targetInterval?: number }` |

---

## 5. Qué Hacer Paso a Paso en el Backend (NestJS)

1. **Habilitar CORS y `ValidationPipe` tolerante en `main.ts`:**
   ```typescript
   app.setGlobalPrefix('api/v1');
   app.enableCors(); // Permite que cualquier Frontend en otra IP/puerto se conecte

   app.useGlobalPipes(
     new ValidationPipe({
       whitelist: true,            // Limpia campos extra que tu backend no guarda
       forbidNonWhitelisted: false, // ¡CLAVE! No tira 400 si un frontend ajeno envía campos extra
       transform: true,
     }),
   );
   ```
2. **No hacer obligatorios campos opcionales en `CreatePetDto`:**
   * Solo `name` y `species` llevan `@IsNotEmpty()`.
   * `breed`, `birthDate` y `photoUrl` llevan `@IsOptional()`. Así, un frontend que no pida foto puede crear mascotas en tu backend sin recibir un `400`.
3. **Filtro global de errores RFC 9457 (`ProblemDetailsFilter`):**
   * Formatear todas las `HttpException` devolviendo `{ type: 'about:blank', title, status, detail, code }` con header `Content-Type: application/problem+json`.
4. **Conectar `@ovenbird/node` (nunca devolver `clientSecret`):**
   * `POST /pairing-codes`: llama a `ob.pairing.createCode()` y guarda en tu DB la ventana de 10 minutos para ese usuario.
   * `GET /devices`: llama a `ob.devices.list()` y **filtra** para mostrar al usuario únicamente los dispositivos ya vinculados a sus mascotas o los libres que aparecieron dentro de la vigencia de su último código de emparejamiento (privacidad entre usuarios).
   * `POST /embed-token`: calcula los `deviceId` de las mascotas del usuario autenticado y llama a `ob.embed.createToken({ deviceIds, ttlS: 900 })`.
5. **Exponer `GET /api/v1/capabilities`:**
   * Devolver `{ apiVersion: '1', variants: ['lost-pet'] }`.
   * *(Opcional)* Si alguien llama por error a una ruta de otra variante (ej. `/power`), responder `HTTP 501 Not Implemented` con formato RFC 9457.

---

## 6. Qué Hacer Paso a Paso en el Frontend (Next.js)

1. **Nunca hardcodear la URL del Backend (`.env.local`):**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
   NEXT_PUBLIC_OVENBIRD_URL=https://iotplatform.ovenbirdconsulting.com.ar
   ```
   Para probar contra el Backend de otro grupo, **solo cambiás `NEXT_PUBLIC_API_URL`** (por su IP local o dominio desplegado) y reiniciás el dev server.
2. **Consultar `GET /api/v1/capabilities` al iniciar:**
   * Guardar el array `variants` en el estado/contexto global.
   * Mostrar los botones de **"Declarar Perdida"** solo si `variants.includes('lost-pet')`. Si te conectás a un backend de otro grupo, los botones de tus variantes se ocultan limpiamente sin romper la pantalla.
3. **Configurar `@ovenbird/react`:**
   ```tsx
   <OvenbirdProvider
     baseUrl={process.env.NEXT_PUBLIC_OVENBIRD_URL}
     getToken={async () => {
       const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/embed-token`, {
         method: 'POST',
         headers: { Authorization: `Bearer ${accessToken}` },
       });
       const data = await res.json();
       return data.token;
     }}
   >
     <DeviceMap />
   </OvenbirdProvider>
   ```
4. **Tolerancia en UI:**
   * **Imagen fallback:** `<img src={pet.photoUrl || '/images/default-pet.png'} alt={pet.name} />` (tanto en el panel como en `/lost/[token]`).
   * **Carga tardía de foto:** Si una mascota se creó sin foto desde otro frontend, permitir agregarla con `PATCH /api/v1/pets/{petId}` al declararla perdida.
   * **Lectura de errores RFC 9457:** Mostrar `error.detail || error.title || 'Error inesperado'` en toasts/alertas.

---

## 7. Documentación OpenAPI / Swagger (`/api/docs`)

* La consigna exige exponer la documentación en **Swagger** conforme al contrato acordado entre todos los grupos.
* Todos los grupos comparten un mismo archivo **`openapi.yaml`** base (con los endpoints comunes de la Sección 3) donde cada grupo agrega sus rutas de variante etiquetadas con `x-variant: "<nombre-variante>"`.
* En NestJS, Swagger queda accesible en `/api/docs` y el contrato exportable en `/api/docs-json`.

---

## 8. Puntos a Confirmar / Debatir entre Todos los Grupos

Para dejar cerrado el acuerdo de **Frontend ↔ Backend** antes de implementar, proponemos confirmar estos 5 puntos clave:

### 1. Prefijo (`/api/v1`), paginación (`{ data, meta }`), tipos y errores RFC 9457
* **Qué acordar:** Todas las rutas bajo `/api/v1`, listados paginados como `{ data: [...], meta: { page, limit, total } }`, todos los IDs como `string`, fechas en formato ISO 8601 UTC y errores en formato estándar **RFC 9457** (`application/problem+json` con `{ type, title, status, detail, code }`).
* **Por qué:** Si un grupo usa `/api` y otro `/api/v1`, o uno devuelve `{ items }` y otro `{ data }`, o uno usa IDs numéricos y otro UUIDs, los frontends cruzados fallan con `404` o `undefined`. Usar RFC 9457 permite que cualquier frontend muestre el mensaje de error (`detail`) de cualquier backend sin conocer su lógica interna.

### 2. Descubrimiento de variantes con `GET /api/v1/capabilities`
* **Qué acordar:** Todo backend expone `GET /api/v1/capabilities` devolviendo `{ apiVersion: "1", variants: ["<mi-variante>"] }` (y opcionalmente `HTTP 501` si alguien llama directo a una variante ajena).
* **Por qué:** Cuando conectamos un Frontend propio al Backend de otro grupo, el Frontend consulta `/capabilities` al iniciar y **oculta automáticamente** los botones de variantes que ese backend no implementa, evitando botones rotos en pantalla y ahorrando a todos programar stubs vacíos para las 7 variantes ajenas.

### 3. Modelos base comunes y campos opcionales (`phone?`, `photoUrl?`)
* **Qué acordar:** Usar exactamente los mismos nombres en `User` (`id, email, name, phone?`) y `Pet` (`id, name, species, breed?, birthDate?, photoUrl?, deviceId`), donde al crear una mascota **solo `name` y `species` son obligatorios**, y los demás campos son **opcionales**.
* **Por qué:** Si un backend exige `photoUrl` o `phone` como obligatorios (`@IsNotEmpty()`), cualquier frontend de otro grupo que no tenga ese campo en su formulario va a recibir `400 Bad Request` y no va a poder ni crear una mascota.

### 4. Flujo unificado de vinculación y mapa con Ovenbird
* **Qué acordar:** Seguir la secuencia exacta de 4 pasos:
  1. `POST /api/v1/pairing-codes` (pide código de 6 dígitos a Ovenbird).
  2. `GET /api/v1/devices` (lista dispositivos disponibles filtrados por la vigencia de 10 minutos del último código de ese usuario, para no exponer dispositivos de otros usuarios).
  3. `PUT /api/v1/pets/{petId}/device` (asocia el dispositivo elegido a la mascota).
  4. `POST /api/v1/embed-token` (emite el token efímero para `<DeviceMap />` sin exponer nunca el `clientSecret`).
* **Por qué:** Refleja el ciclo real de Ovenbird IoT Cloud y garantiza la privacidad entre usuarios de un mismo proyecto.

### 5. Tolerancia técnica (`CORS`, `ValidationPipe` y URL por entorno)
* **Qué acordar:** Todos los backends habilitan `app.enableCors()` y `ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })` en `main.ts`, y todos los frontends leen la URL del backend desde `NEXT_PUBLIC_API_URL` en `.env.local`.
* **Por qué:**
  * Sin `CORS`, los navegadores bloquean las peticiones entre distintos puertos o IPs de notebooks en el aula.
  * Con `forbidNonWhitelisted: false`, si un frontend envía un campo extra propio (como `photoUrl`), un backend que no lo usa simplemente lo ignora en silencio sin tirar error `400`.
  * Con `NEXT_PUBLIC_API_URL`, cambiar de backend durante la demostración lleva 5 segundos sin tocar una línea de código.


