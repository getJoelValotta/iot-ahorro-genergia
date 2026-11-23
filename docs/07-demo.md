# Guion de la demo de punta a punta

Recorrido completo: **registrarse → crear mascota → generar código → emparejar la unidad →
vincular el collar → verla en el mapa → activar el ahorro → "Aplicado en el collar"**, más la
demo de robustez (pérdida, duplicados, corrupción) y el caso "el collar no respondió".

Hay dos versiones de cada paso: **simulación** (Wokwi + "celular falso") y **hardware real**
(placas + app Ovenbird Smart, para el jueves). El back, el front y Supabase son los mismos en las dos.

> Verificado el 2026-11-23 en simulación, con back, front y Supabase locales y Ovenbird real.
> Ver resultados en [avances.md](avances.md) (sesiones 4 y 5).

---

## 0. Preparación (una sola vez por PC)

| Qué | Cómo |
|---|---|
| Docker Desktop abierto | Lo necesita Supabase local. |
| Supabase CLI | `supabase start` desde la raíz del repo (primera vez: baja imágenes, tarda). |
| Dependencias | `cd backend && npm ci` · `cd frontend && npm ci` · `pip install pyserial pytest` |
| `backend/.env` | Copiar `backend/.env.example` y completar. `SUPABASE_SERVICE_ROLE_KEY` sale de `supabase status`; las credenciales de Ovenbird, del proyecto en la plataforma. **No pegar secretos en chats.** |
| `frontend/.env.local` | Copiar `frontend/.env.example` (no lleva secretos). |
| Firmware simulado | `cd firmware && pio run -e collar_sim -e unit_sim` |
| Wokwi CLI | `WOKWI_CLI_TOKEN` como variable de entorno del usuario (ver [04-wokwi.md](04-wokwi.md)). |
| Ovenbird | El proyecto debe tener cargado el origen `http://localhost:3000` (si no, el mapa no carga). |

Supabase local en esta configuración usa los puertos **54331** (API) y **54332** (Postgres)
(`supabase/config.toml`), para no chocar con otros proyectos de Supabase en la misma PC.

## 1. Levantar todo (tres terminales)

```bash
supabase start                          # raíz del repo
cd backend  && npm run start:dev        # http://localhost:3001/api/v1  (Swagger: /api/docs)
cd frontend && npm run dev              # http://localhost:3000
```

Comprobación rápida: `http://localhost:3001/api/v1/capabilities` devuelve
`{"apiVersion":"1","variants":["power-saving"]}`.

## 2. Recorrido

| # | Qué se hace | Qué se tiene que ver | Hardware real (jueves) |
|---|---|---|---|
| 1 | Abrir `http://localhost:3000` → **Crear cuenta**. | Entra a "Mis mascotas", vacío. | Igual. |
| 2 | **Nueva mascota** (nombre, especie). | Aparece la tarjeta con "Sin collar". | Igual. |
| 3 | Menú **Emparejar** → **Generar código**. | Código tipo `ABC-123` con cuenta regresiva de 10 min. | Igual. |
| 4 | Encender las dos placas simuladas y el puente con el código (ver §3). | En la consola del puente: `unidad emparejada en Ovenbird: deviceId=...` y luego los reportes. | Encender collar y unidad; en la app **Ovenbird Smart** → *Agregar dispositivo* → elegir `OB-xxxx` → ingresar el código. |
| 5 | En **Emparejar** (o en la ficha de la mascota) aparece la unidad. Entrar a la ficha → elegir la unidad → **Vincular**. | "En línea", "Visto recién", y aparece la tarjeta **Batería y ahorro** con la batería y la autonomía de cada modo. | Igual. |
| 6 | Menú **Mapa**. | La mascota en el mapa (ruta pregrabada de Mar del Plata) con estado y batería. Tocarla la centra. | Posición real del GPS (puede tardar en tener fix bajo techo). |
| 7 | En la ficha, interruptor **Normal → Ahorro**. | "Enviando…" y, unos segundos después, **"Aplicado en el collar"**. El collar pasa a reportar cada 150 s con `ahorro=1`. | Igual; el celular tiene que estar cerca de la unidad (BLE). |
| 8 | Interruptor **Ahorro → Normal**. | "Enviando…" hasta la próxima ventana del collar (**hasta ~150 s**, porque en ahorro el collar solo escucha después de cada reporte) y luego "Aplicado en el collar". | Igual. |

Qué decir en el paso 7–8: en ahorro el collar apaga el GPS entre reportes y duerme la radio, pero
**sigue atendiendo órdenes**: la unidad las guarda y las manda justo después de cada reporte,
cuando el collar abre su ventana de escucha. Por eso volver a Normal puede tardar hasta un intervalo.

## 3. Simulación: placas de Wokwi + "celular falso"

Wokwi no simula LoRa ni Bluetooth. El script `firmware/tools/radiosim_bridge.py` hace de "aire"
entre las dos placas y, con `--cloud`, de celular con la app (empareja la unidad en Ovenbird, sube
lo que la unidad publica por BLE y le pasa los comandos de la nube).

```bash
cd firmware
wokwi-cli wokwi/unit   --timeout 300000 &     # unidad: RFC2217 en localhost:4001
wokwi-cli wokwi/collar --timeout 300000 &     # collar: RFC2217 en localhost:4000
python tools/radiosim_bridge.py \
  --collar rfc2217://localhost:4000 --unit rfc2217://localhost:4001 \
  --cloud --pair-code ABC-123 --uid 02:47:31:00:00:01 --name "OB-0001 (Wokwi)"
```

- El UID es **de prueba** (nunca la MAC de una placa real). Re-emparejar el mismo UID con un
  código nuevo conserva el mismo `deviceId` en Ovenbird, así que la mascota queda vinculada.
- Alternativa visual (y si se agotó la cuota de la CLI): la extensión de VS Code, una ventana por
  placa, con el mismo comando del puente ([04-wokwi.md](04-wokwi.md), opción B).
- Límites del plan gratis de Wokwi: cada simulación por CLI se corta a los **5 minutos** y hay una
  **cuota mensual de minutos de CI**. El puente termina solo y sin error cuando una placa se corta.
- El collar simulado (`collar_sim`) usa una ventana de escucha de **3 s** en vez de 500 ms: las dos
  simulaciones se comunican por internet y la latencia ida y vuelta supera los 500 ms. En las placas
  reales (`collar_lora`) es 500 ms, como pide el acuerdo.

Consola del puente (útil en la demo): `find 10` (hace sonar el collar), `ahorro` / `normal`
(simulan el cambio desde la app), `chaos ...` (fallas, ver §4), `quit`.

## 4. Robustez

| Caso | Cómo provocarlo | Qué se ve | Resultado 2026-11-23 |
|---|---|---|---|
| **El collar no respondió** | En el puente: `chaos loss=1` (se pierde todo lo que va por el aire). Cambiar el modo en la UI. | La unidad reintenta 3 veces y avisa por BLE "sin respuesta del collar"; la UI muestra **"El collar no respondió. Probá de nuevo."** (el interruptor queda en el modo pedido; se puede volver a intentar). | ✅ en ~8 s (en modo normal). |
| **Pérdida** | `chaos loss=0.3` | El puente muestra `~ chaos: trama perdida`; los reportes siguientes llegan y el mapa se actualiza. El contador `seq` de la unidad deja ver los huecos. | ✅ |
| **Duplicados** | `chaos dup=0.5` | La unidad registra `tel duplicada seq=N` y **no** la reenvía a Ovenbird. | ✅ |
| **Corrupción** | `chaos corrupt=0.3` | El puente muestra `~ chaos: trama corrompida`; la unidad registra `rx descartada ...` (CRC inválido) y se resincroniza con la trama siguiente. | ⚠️ Sin muestra en vivo (se agotó la cuota de Wokwi). Cubierto por los tests nativos `test_validation_order_and_rejections` y `test_stream_parser_resync_with_noise_and_fake_sync`. Repetir en vivo cuando haya cuota o con VS Code. |
| **Ovenbird caído** | Cortar la red del puente unos segundos. | El puente reintenta con espera creciente y **no pierde** los reportes: los sube juntos al volver. | Cubierto por pytest (`test_si_ovenbird_sigue_caido...`). |
| **Volver a la normalidad** | `chaos loss=0 dup=0 corrupt=0` | Todo sigue funcionando sin reiniciar nada. | ✅ |

Hardware real: los mismos casos se ven alejando el collar de la unidad (pérdida / "no respondió")
o apagando el collar.

## 5. Problemas conocidos

| Síntoma | Causa / solución |
|---|---|
| El mapa no carga ("No pudimos conectar con el mapa") | Falta el origen del front en el proyecto de Ovenbird. |
| La unidad no aparece para vincular | El código venció (10 min) o se usó otra cuenta. Generar otro código y re-emparejar. |
| `API Error: ... monthly CI minute quota` | Cuota de Wokwi agotada: usar la extensión de VS Code. |
| La simulación se corta a los 5 min | Límite del plan gratis; volver a lanzar las dos placas y el puente (con un código nuevo). |
| El back no arranca: `Configuración inválida del backend ...` | Completar `backend/.env` (el mensaje nombra las variables que faltan, nunca muestra valores). |
| Supabase: `permission denied` | Correr `supabase db reset` para reaplicar la migración. |
