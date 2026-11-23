# Spec: backend, frontend y prueba E2E con Wokwi

Status: ready-for-agent

## Problem Statement

Somos el Grupo 1 del TP final de Sistemas Distribuidos (variante **ahorro de energía**, `power-saving`). El firmware del collar y de la unidad ya existe y está testeado, pero el sistema todavía no funciona de punta a punta: no hay backend ni frontend, y no hay forma de ver un collar simulado en Wokwi aparecer en un mapa web.

Desde el punto de vista del usuario final (el dueño de una mascota):
- No puede registrarse, cargar sus mascotas ni vincularles un collar.
- No puede ver dónde está su mascota ni si el collar está en línea o con poca batería.
- No puede activar el modo ahorro del collar ni saber cuánto le va a durar la batería en cada modo.

Desde el punto de vista del equipo:
- Entregamos el jueves 2026-11-26 y en la demo prueban todo con hardware real. Necesitamos probar el flujo completo antes, sin placas, usando Wokwi.
- Wokwi no simula LoRa ni BLE, así que la unidad simulada no puede hablar con la app Ovenbird Smart ni llegar a la nube.
- Nuestro backend y nuestro frontend tienen que poder combinarse con los de los otros 7 grupos (contrato acordado en `docs/01`), sin romper la compatibilidad con nuestra variante.

## Solution

Construir tres piezas nuevas y conectarlas con lo existente:

1. **Backend NestJS** (desplegado en Vercel, base en Supabase): usuarios con login propio, CRUD de mascotas, emparejamiento y vínculo de collares a través de Ovenbird, emisión del token del mapa y la variante de ahorro (cambio de modo + estimación de autonomía). Cumple las 14 rutas comunes del acuerdo en una versión tolerante que también satisface el documento de referencia del Grupo 7.
2. **Frontend Next.js** (desplegado en Vercel): portal del dueño con login, mascotas, emparejamiento, mapa en vivo y la tarjeta "Batería y ahorro". El token de sesión vive en una cookie `httpOnly` y el servidor de Next hace de intermediario con el backend (nunca `localStorage`).
3. **"Celular falso"** para la prueba con Wokwi: el script que ya hace de "aire LoRa" entre collar y unidad suma el rol de la app Ovenbird Smart. Empareja la unidad simulada con un código, sube a Ovenbird lo que la unidad publica por BLE y le pasa a la unidad los comandos que llegan de la nube.

Con esto, el equipo puede hacer el recorrido completo en simulación: registrarse → crear mascota → generar código → el script empareja la unidad de Wokwi → vincular el collar a la mascota → verla en el mapa → activar el ahorro → ver "Aplicado en el collar" cuando el collar simulado confirma. El jueves se reemplaza el script por el celular real y los entornos `*_sim` por `*_lora`.

## User Stories

**Cuenta y sesión**
1. As a dueño de mascota, I want registrarme con email, nombre, contraseña y teléfono opcional, so that pueda usar el portal.
2. As a dueño de mascota, I want que el sistema me avise si mi email ya está registrado, so that no cree cuentas duplicadas.
3. As a dueño de mascota, I want que se me pida una contraseña de al menos 8 caracteres, so that mi cuenta sea razonablemente segura.
4. As a dueño de mascota, I want iniciar sesión con email y contraseña, so that acceda a mis datos.
5. As a dueño de mascota, I want ver un mensaje claro si mis credenciales son incorrectas, sin saber si falló el email o la contraseña, so that nadie pueda averiguar qué emails existen.
6. As a dueño de mascota, I want que mi sesión dure un tiempo razonable y me lleve al login cuando vence, so that no quede en un estado roto.
7. As a dueño de mascota, I want cerrar sesión, so that nadie más use mi cuenta en un equipo compartido.
8. As a dueño de mascota, I want que las páginas privadas me redirijan al login si no estoy autenticado, so that no vea pantallas vacías o con errores.
9. As a dueño de mascota, I want que mi sesión no se pueda robar leyendo el almacenamiento del navegador, so that mi cuenta esté protegida ante scripts maliciosos.
10. As a dueño de mascota, I want ver mi nombre y email en el portal, so that sepa con qué cuenta entré.

**Mascotas**
11. As a dueño de mascota, I want ver el listado de mis mascotas, so that las administre.
12. As a dueño de mascota, I want que el listado esté paginado, so that cargue rápido aunque tenga muchas.
13. As a dueño de mascota, I want crear una mascota indicando solo nombre y especie (perro, gato u otro), so that el alta sea rápida.
14. As a dueño de mascota, I want agregar opcionalmente raza, fecha de nacimiento y foto, so that la ficha esté completa.
15. As a dueño de mascota, I want editar los datos de una mascota, so that los mantenga actualizados.
16. As a dueño de mascota, I want borrar una mascota y que su collar quede liberado, so that pueda vincularlo a otra.
17. As a dueño de mascota, I want ver un mensaje claro cuando un dato que cargué es inválido, indicando qué campo, so that lo corrija.
18. As a dueño de mascota, I want que nadie más pueda ver, editar ni borrar mis mascotas, so that mis datos sean privados.
19. As a dueño de mascota, I want ver una imagen por defecto cuando una mascota no tiene foto, so that la pantalla no se vea rota.

**Emparejamiento y vínculo del collar**
20. As a dueño de mascota, I want generar un código de emparejamiento, so that lo ingrese en la app Ovenbird Smart.
21. As a dueño de mascota, I want ver cuánto tiempo le queda al código antes de vencer, so that sepa si tengo que generar otro.
22. As a dueño de mascota, I want instrucciones claras de cómo ingresar el código en la app, so that pueda emparejar la unidad sin ayuda.
23. As a dueño de mascota, I want ver la lista de dispositivos que puedo vincular (los míos y los que emparejé con mi código reciente), so that elija el correcto.
24. As a dueño de mascota, I want no ver dispositivos de otros usuarios del mismo proyecto, so that nadie vincule un collar ajeno.
25. As a dueño de mascota, I want vincular un dispositivo a una mascota, so that su posición se muestre en el mapa.
26. As a dueño de mascota, I want un aviso claro si el dispositivo ya está vinculado a otra mascota, so that entienda por qué no se puede.
27. As a dueño de mascota, I want un aviso claro si la mascota ya tiene otro collar, so that primero lo desvincule.
28. As a dueño de mascota, I want que volver a vincular el mismo collar a la misma mascota no dé error, so that reintentar sea seguro.
29. As a dueño de mascota, I want desvincular el collar de una mascota, so that lo use en otra.
30. As a dueño de mascota, I want ver si cada dispositivo está en línea y cuándo se vio por última vez, so that elija uno que funcione.

**Mapa y estado en vivo**
31. As a dueño de mascota, I want ver en un mapa todas mis mascotas con collar, so that sepa dónde están.
32. As a dueño de mascota, I want que al elegir una mascota el mapa se centre en ella, so that la encuentre rápido.
33. As a dueño de mascota, I want ver si el collar está en línea, so that sepa si la posición es actual.
34. As a dueño de mascota, I want ver la batería del collar, so that lo cargue a tiempo.
35. As a dueño de mascota, I want ver cuándo se recibió el último dato, so that sepa qué tan reciente es la posición.
36. As a dueño de mascota, I want que el mapa siga funcionando cuando vence su token, so that no tenga que recargar la página.
37. As a dueño de mascota, I want un mensaje claro si no tengo ningún collar vinculado, so that sepa que tengo que emparejar uno.
38. As a dueño de mascota, I want ver estados de carga y error en el mapa, so that sepa si hay un problema.

**Variante: ahorro de energía**
39. As a dueño de mascota, I want ver en la ficha de cada mascota con collar una tarjeta "Batería y ahorro", so that controle el consumo.
40. As a dueño de mascota, I want cambiar entre modo Normal y modo Ahorro con un interruptor, so that prolongue la batería cuando no necesito posiciones tan seguidas.
41. As a dueño de mascota, I want ver si el cambio se está enviando, si ya se aplicó en el collar o si el collar no respondió, so that sepa en qué estado está realmente.
42. As a dueño de mascota, I want ver cuánto dura la batería con carga completa en cada modo, so that compare.
43. As a dueño de mascota, I want ver cuánto le queda a la batería actual en cada modo, so that decida si activar el ahorro.
44. As a dueño de mascota, I want que el collar en ahorro siga respondiendo mis órdenes (por ejemplo, volver a modo normal), so that no pierda control.
45. As a dueño de mascota, I want un aviso claro si intento cambiar el modo de una mascota sin collar, so that entienda qué falta.
46. As a dueño de mascota, I want que el modo elegido se recuerde aunque cierre la sesión, so that no tenga que volver a elegirlo.

**Robustez y errores**
47. As a dueño de mascota, I want un mensaje entendible si Ovenbird no está disponible, sin detalles técnicos, so that sepa que es temporal.
48. As a dueño de mascota, I want que el portal se recupere solo cuando Ovenbird vuelve, so that no tenga que hacer nada.
49. As a dueño de mascota, I want usar el portal cómodamente en el celular y en la computadora, so that lo consulte desde donde esté.
50. As a dueño de mascota, I want que nunca se me muestren mensajes internos del servidor, so that la experiencia sea clara y segura.

**Interoperabilidad con otros grupos**
51. As a otro grupo, I want usar nuestro backend con su frontend cambiando solo la URL, so that podamos hacer pruebas cruzadas.
52. As a otro grupo, I want que nuestro backend acepte campos extra sin error, so that su frontend no falle por mandar datos propios.
53. As a otro grupo, I want que nuestro backend responda los errores en formato `problem+json` con códigos estables, so that mi frontend los muestre.
54. As a otro grupo, I want que `GET /capabilities` anuncie solo `power-saving`, so that mi frontend oculte las variantes que no tenemos.
55. As a otro grupo, I want que una ruta de variante que no implementamos responda 404, so that mi frontend no se rompa.
56. As a equipo, I want usar nuestro frontend con el backend de otro grupo cambiando solo una variable de entorno, so that la prueba cruzada lleve segundos.
57. As a equipo, I want que nuestro frontend oculte la tarjeta de ahorro si el backend conectado no anuncia `power-saving`, so that no muestre botones rotos.
58. As a equipo, I want que nuestro frontend tolere campos opcionales en `null` o ausentes, `lastSeenAt` nulo y listados sin `meta`, so that funcione con backends escritos según cualquiera de los dos documentos de acuerdo.
59. As a equipo, I want que la documentación Swagger del backend esté publicada y marque las rutas de la variante, so that otros grupos sepan qué consumir.

**Prueba de punta a punta con Wokwi**
60. As a integrante del equipo, I want correr el collar y la unidad en Wokwi conectados entre sí, so that pruebe la comunicación sin placas.
61. As a integrante del equipo, I want que un script empareje la unidad simulada con el código que muestra el frontend, so that el dispositivo aparezca en mi cuenta.
62. As a integrante del equipo, I want que el script suba a Ovenbird la ubicación y el estado que publica la unidad simulada, so that la mascota se mueva en el mapa.
63. As a integrante del equipo, I want que los comandos enviados desde el portal (activar ahorro) lleguen a la unidad simulada y vuelvan confirmados, so that vea el ciclo completo.
64. As a integrante del equipo, I want que el script informe "el collar no respondió" cuando la unidad no confirma, so that la UI muestre el fallo.
65. As a integrante del equipo, I want que el script se recupere solo si Ovenbird o la conexión se caen un rato, so that la demo no se corte.
66. As a integrante del equipo, I want simular pérdida, duplicados y corrupción en el enlace LoRa, so that muestre que el sistema los tolera.
67. As a integrante del equipo, I want un guion paso a paso de la demo, so that cualquiera del equipo la pueda hacer.
68. As a integrante del equipo, I want que el UID de la unidad simulada sea un valor de prueba configurable, so that no expongamos identificadores reales.

**Operación, seguridad y entrega**
69. As a integrante del equipo, I want que los secretos (Ovenbird, Supabase, JWT) solo vivan en variables de entorno, so that nunca lleguen al repo, a los logs ni al frontend.
70. As a integrante del equipo, I want archivos `.env.example` con todas las variables documentadas y sin valores, so that cualquiera pueda configurar el proyecto.
71. As a integrante del equipo, I want levantar la base local con un solo comando y migraciones versionadas, so that cada uno trabaje sin pisar a los demás.
72. As a integrante del equipo, I want que la CI corra los tests del firmware, del backend y del script, y compile el frontend, en cada push a `main`, so that detectemos roturas enseguida.
73. As a integrante del equipo, I want que el backend y el frontend se desplieguen en Vercel desde `main`, so that la URL esté siempre al día para la demo y las pruebas cruzadas.
74. As a integrante del equipo, I want logs útiles para diagnosticar fallas que no incluyan contraseñas, tokens ni datos personales, so that cumplamos el requisito de diagnóstico.
75. As a docente, I want un README único con la variante, la arquitectura, cómo correr cada componente, las variables y la justificación de los requisitos no funcionales, so that pueda evaluar y reproducir el sistema.
76. As a docente, I want ver documentados los supuestos del modelo de consumo (incluida la batería de ejemplo de 1000 mAh), so that entienda de dónde salen los números de autonomía.

## Implementation Decisions

**Arquitectura general**
- Backend NestJS 11 (por Jest) y frontend Next.js (app router), los dos desplegados en Vercel como proyectos separados del mismo repo. Back en el puerto 3001 y front en el 3000 en local.
- El backend corre como función serverless: sin procesos de fondo ni suscripciones SSE persistentes. Todo lo que dependa del tiempo (estado de un comando) se reconcilia a demanda cuando se consulta.
- Contrato oficial: `docs/01` Parte II. Se implementa una versión tolerante que también cumple `docs/05`: `GET /devices` devuelve `{ data, meta }`; `POST /pairing-codes` acepta body vacío; `lastSeenAt` es nulo solo si el dispositivo nunca se vio; los campos opcionales se devuelven como `null`; el email duplicado responde `409 EMAIL_TAKEN`; las rutas de variantes ajenas responden `404`; `embed-token` acepta `deviceIds`, `petId` y `ttlS` (900 s por defecto, máximo 3600).
- Las decisiones, riesgos y mitigaciones están en `docs/06-decisiones-arquitectura.md` y se respetan como ADR.

**Módulos del backend** (cada uno con responsabilidad única)
- **Config**: valida las variables de entorno al arrancar y falla rápido si falta alguna.
- **Infra HTTP**: prefijo `/api/v1`, CORS abierto, validación tolerante (descarta campos desconocidos sin error), filtro global que convierte todo error en RFC 9457 (`application/problem+json` con `type`, `title`, `status`, `detail`, `code` en UPPER_SNAKE_CASE y `errors` por campo cuando aplica), Swagger en `/api/docs` y `/api/docs-json`. Ningún error expone detalles internos.
- **Database**: un cliente de Supabase con la clave de servicio, usado solo por repositorios por agregado (usuarios, mascotas, sesiones de emparejamiento). Los servicios dependen de la interfaz del repositorio, no de Supabase; así se reemplaza por una implementación en memoria en los tests.
- **Auth**: registro, login y `me`. Contraseñas con bcrypt; JWT propio con vencimiento configurable (1 h por defecto). Guard global que protege todo salvo lo marcado como público (register, login, capabilities). Emails normalizados a minúsculas.
- **Pets**: CRUD paginado (`page`, `limit` 1..100) con aislamiento estricto: una mascota ajena se comporta como inexistente (`404 PET_NOT_FOUND`). Al borrar, se libera el vínculo antes.
- **Ovenbird**: envuelve `@ovenbird/node` (único acceso a la plataforma) y traduce sus errores: no encontrado → 404, validación → 422, rate limit → 429, autenticación/red/5xx → 502/503 sin filtrar secretos.
- **Devices**: crea códigos de emparejamiento y registra la ventana de 10 minutos por usuario; lista los dispositivos del tenant filtrando los vinculados al usuario más los libres aparecidos dentro de su ventana; vincula y desvincula con los `409 DEVICE_ALREADY_LINKED` / `PET_ALREADY_HAS_DEVICE` e idempotencia para el mismo par.
- **Embed**: calcula los dispositivos del usuario (o verifica pertenencia de los pedidos), responde `409 NO_LINKED_DEVICES` si no hay, y emite el token con el SDK. Nunca devuelve el `clientSecret`.
- **Capabilities**: público, `{ apiVersion: "1", variants: ["power-saving"] }`.
- **Power (variante)**: `GET` y `PUT /api/v1/pets/{petId}/power`, marcadas `x-variant: power-saving` en Swagger. El `PUT` recibe `{ mode: "normal" | "saving" }`, envía `report_interval_s` (15 o 150, configurables) con el SDK, guarda el modo pedido y el id del comando, y responde 202. El `GET` reconcilia el estado del comando con la plataforma si está pendiente. Las dos responden la misma forma: modo pedido, intervalo, estado del comando (`none` / `pending` / `confirmed` / `failed`, con id y fecha), batería actual o nulo, capacidad de batería usada, y para cada modo la corriente media estimada, las horas con carga completa y las horas restantes (nulo si no hay batería). Errores: `404 PET_NOT_FOUND`, `409 PET_HAS_NO_DEVICE`, 502/503.
- **Modelo de consumo**: función pura que, a partir de las corrientes de datasheet (ATmega328P activo/idle, SX1278 TX a 14 dBm/RX/sleep, NEO-6M adquisición/tracking/off), el tiempo en el aire de la trama con SF7/BW125, la ventana RX de 500 ms, el precalentamiento del GPS de 8 s y el intervalo, calcula la corriente media de cada modo. La autonomía es la capacidad de la batería sobre esa corriente. La capacidad es una configuración global, con un valor de ejemplo de 1000 mAh documentado como supuesto. Las fuentes de cada número se documentan.

**Base de datos** (Supabase/Postgres, migraciones SQL versionadas; local con la CLI de Supabase)
- `users`: id uuid, email único, nombre, teléfono opcional, hash de contraseña, fechas.
- `pets`: id uuid, dueño, nombre, especie, raza/fecha de nacimiento/foto opcionales, id de dispositivo único y opcional (la unicidad garantiza el 409 a nivel de base), modo de energía, id/estado/fecha del último comando de modo, fechas.
- `pairing_sessions`: id, usuario, código, vencimiento, fecha de creación.
- Row Level Security activado sin políticas: solo entra la clave de servicio del backend.

**Frontend**
- Next.js + Tailwind + shadcn/ui, responsive.
- BFF: el servidor de Next guarda el token del backend en una cookie `httpOnly` (`SameSite=Lax`, `Secure` en producción, duración tomada de `expiresIn` o 3600 s por defecto). Expone rutas propias de login, registro y logout, y un proxy genérico que reenvía al backend con `Authorization: Bearer`. Ante un 401 borra la cookie y redirige al login. Verifica el `Origin` en las rutas que modifican datos.
- La URL del backend se lee en el servidor en tiempo de ejecución (variable de servidor con fallback a `NEXT_PUBLIC_API_URL`), así que para cambiar de backend alcanza con cambiar la variable y reiniciar.
- Un contexto de capacidades carga `/capabilities` al iniciar sesión; si falla o da 404, usa `variants = []`.
- Mapa: `OvenbirdProvider` con `getToken` contra una ruta del propio Next que pide el `embed-token` al backend. Muestra `DeviceMap`, `OnlineBadge` y `BatteryIndicator` con `useDeviceStatus`. Las llamadas a Ovenbird salen solo del SDK de React.
- Errores: muestra `detail`, o `title`, o un mensaje genérico; nunca detalles internos.

**"Celular falso" (prueba con Wokwi)**
- Se agrega como un módulo nuevo del tooling Python del firmware y se activa con una opción del script del puente existente, porque el puerto serie de cada simulación solo se puede abrir una vez.
- Usa los endpoints de la app/puente de Ovenbird relevados del OpenAPI: emparejar con código + `productId` `ob.lora.unit` + UID de prueba (sin auth) para obtener el token del puente; subir reportes con `seq`, `ts` y DPs; recibir comandos con long-poll y confirmarlos con `ok`/`error`.
- Traduce entre el perfil BLE v1 que la unidad imprime por consola (LOCATION, STATUS, COMMAND_ACK, little-endian, lat/lon × 10⁷) y los DPs de Ovenbird (`location`, `battery_pct`, `collar_online`, `link_*`), y entre los comandos de la nube (`report_interval_s`, `find_me`) y el COMMAND BLE (opcodes 2 y 1). Reusa los codecs existentes del tooling.
- Reintenta con espera creciente ante errores de red o 5xx y respeta el 429.
- Primero se verifica si `wokwi-cli --interactive` deja pasar los bytes binarios de las tramas para correr las dos simulaciones desde el script. Si no, se usan las dos ventanas de VS Code con RFC2217, o la unidad en Wokwi con el collar virtual que el script ya implementa.

**Configuración** (sin valores en el repo; `.env.example` por componente)
- Backend: puerto, secreto y vencimiento del JWT, URL y clave de servicio de Supabase, URL/clientId/clientSecret de Ovenbird, TTL del embed token, capacidad de batería e intervalos de cada modo.
- Frontend: URL del backend (pública y de servidor) y URL de Ovenbird.
- Script: URL de Ovenbird; código de emparejamiento y UID por parámetro.
- Los SDK de Ovenbird (`.tgz`) se commitean para que Vercel pueda construir.

**Proceso**
- Todo se commitea directo a `main`, una parte terminada por commit. Al terminar cada fase se actualizan `docs/PLAN.md` y `docs/avances.md`.

## Testing Decisions

**Qué es un buen test acá:** prueba comportamiento observable desde afuera (respuestas HTTP, códigos de error, forma del JSON, líneas que salen por la consola), no detalles internos (qué método privado se llamó, cómo está armada una consulta). Cada test arma su propio estado y no depende de servicios externos reales: Ovenbird y la base se reemplazan por implementaciones falsas en memoria detrás de las mismas interfaces que usa el código.

**Costuras acordadas:**
1. **Backend por HTTP (costura principal):** Jest + supertest contra la app Nest completa, con el servicio de Ovenbird falso y los repositorios en memoria. Cubre las 14 rutas comunes y las de `power`: aislamiento entre usuarios (mascota ajena ⇒ 404), paginación, validación tolerante (campos extra aceptados, faltantes ⇒ 400 con `errors`), formato `problem+json`, los 409 de vínculo e idempotencia, `NO_LINKED_DEVICES`, filtrado de `GET /devices` por la ventana de 10 minutos, traducción de cada error del SDK, `capabilities` pública y que ninguna respuesta incluya secretos.
2. **Servicios clave del backend:** tests unitarios con Jest de auth, mascotas y vínculo con dispositivos, con el SDK simulado, porque la consigna lo pide explícitamente. Usan las mismas implementaciones falsas que la costura 1.
3. **Modelo de consumo:** tests de la función pura (el modo ahorro siempre dura más que el normal, la autonomía escala con la capacidad, las horas restantes escalan con el porcentaje de batería, valores dentro de rangos razonables).
4. **"Celular falso":** pytest por sus dos bordes (líneas de consola de la unidad que entran y salen, y un cliente HTTP falso de Ovenbird): emparejamiento, conversión de LOCATION/STATUS a DPs, comando de la nube → línea `>ble` → ACK de la unidad → confirmación, y reintentos ante errores.
5. **Frontend:** lint y build en CI, más un test chico del proxy del BFF (la cookie se convierte en `Bearer`, un 401 borra la cookie) por ser la parte sensible de seguridad. El resto se verifica con el guion manual de la demo.
6. **Firmware:** sin costuras nuevas; siguen los tests nativos existentes.

**Antecedentes en el repo:** los tests nativos Unity del firmware (vectores del acuerdo y del perfil BLE, idempotencia, deduplicación) y los pytest de las tramas en el tooling Python son el modelo a seguir: entradas reales del protocolo y salidas observables.

**Verificación de punta a punta:** la CI (GitHub Actions) corre los tests del firmware, los pytest del tooling, el lint y los tests del backend, y el lint y el build del frontend en cada push a `main`. El recorrido completo se verifica con el guion manual de la demo con Wokwi.

## Out of Scope

- Variantes de otros grupos (calidad GPS, zonas, buscar y guiar, historial, compartir, mascota perdida, notificaciones).
- Cambios al protocolo LoRa o al perfil BLE: el firmware se considera terminado salvo arreglos que surjan de la prueba E2E.
- Pruebas automatizadas del frontend más allá del proxy del BFF (sin tests de componentes ni de navegador).
- Refresh tokens, recuperación de contraseña, verificación de email y login con proveedores externos.
- Subida de archivos para fotos (solo URL).
- Notificaciones push o por email, y tareas en segundo plano en el backend.
- Medición real del consumo en la placa (opcional, fuera de esta spec).
- Publicación de los proyectos en wokwi.com y pruebas con la placa real (tareas del equipo en el plan, no de esta spec).

## Further Notes

- Entrega: jueves 2026-11-26. Orden de implementación: esqueletos + CI → backend → frontend → "celular falso" y demo → README.
- Tareas manuales del equipo, en paralelo (detalle en `docs/avances.md`): agregar los orígenes `http://localhost:3000`, `http://localhost:3001` y la URL de Vercel en Ovenbird; crear el dispositivo virtual; crear el proyecto de Supabase en la nube; importar el repo en Vercel dos veces y cargar las variables; regenerar el `clientSecret` de Ovenbird antes de la entrega.
- Riesgo abierto: que `wokwi-cli --interactive` no deje pasar bytes binarios; hay dos alternativas ya identificadas.
- Riesgo de interoperabilidad: el mapa con un backend de otro grupo requiere que ese grupo cargue nuestro origen en su proyecto de Ovenbird.
- Si aparece un conflicto entre esta spec y `docs/06-decisiones-arquitectura.md`, hay que señalarlo explícitamente.
