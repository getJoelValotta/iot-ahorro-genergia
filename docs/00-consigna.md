# Consigna TP Final (texto extraído de TP_FINAL_CONSIGNA_v1.4.pdf)

```text
TP Final — Sistema IoT de seguimiento de mascotas

1. Contexto y objetivo
Cada grupo construirá, en dos semanas, un sistema IoT completo de seguimiento de mascotas cubriendo
todos los componentes de arquitectura: los microcontroladores, un backend y una aplicación web.

Los alumnos deberán interactuar con una plataforma llamada Ovenbird IoT Cloud, una nube IoT similar
a Tuya provista por la cátedra que sigue el modelo “IoT Platform as a Service”. Los dispositivos se
conectan a una nube compartida y los integradores consumen sus datos mediante una API y un SDK.
Cada grupo cumple así dos roles a la vez: fabricante del dispositivo e integrador de la plataforma.

2. Arquitectura y alcance
La cátedra provee la plataforma, el SDK y la aplicación móvil (similar a Tuya Smart); cada grupo desarrolla
el dispositivo, el backend y el frontend, y los conecta a través de Ovenbird IoT Cloud.

Componente                       Responsable      Descripción

Ovenbird IoT Cloud               Cátedra          API REST, eventos en tiempo real, tokens y otros
                                                  servicios

SDK @ovenbird/node y             Cátedra          Cliente para el backend y componentes de mapa y
@ovenbird/react                                   estado para el frontend

App móvil Ovenbird Smart         Cátedra          Vincula unidades BLE, envía sus datos a la nube y
                                                  muestra los dispositivos en un mapa

Simulador de dispositivos        Cátedra          Permite probar el backend y el frontend sin
                                                  hardware

Firmware del dispositivo         Grupo            Collar y unidad del usuario

Backend NestJS                   Grupo            Dominio de mascotas, vínculo con dispositivos,
                                                  zonas y emisión de tokens

Frontend Next.js                 Grupo            Portal del cliente con el mapa embebido mediante el
                                                  SDK



Nota: Cada grupo trabaja en su propio tenant: no puede ver los dispositivos ni los datos de otro grupo.

3. Producto, variantes y hardware
Todos los grupos desarrollan el mismo producto, un collar LoRa de dos partes con su unidad del usuario,
y cada grupo recibe de la cátedra una variante que lo diferencia (sección 5).
Solución             Dispositivo             Cómo llega a Ovenbird IoT Cloud      Producto en la
                                                                                  plataforma

Collar LoRa de       Arduino Nano            LoRa hasta la unidad, BLE hasta la   ob.lora.unit
dos partes           (collar) y ESP32        app móvil y HTTPS hasta la nube
                     (unidad del usuario)



Asignación de variantes (la cátedra puede ajustarla):

Grupo            Variante (ver sección 5)

1                Ahorro de energía

2                Calidad de GPS

3                Pérdida de enlace y zonas

4                Buscar y guiar

5                Historial y recorridos

6                Compartir mascota y roles

7                Mascota perdida

8                Notificaciones configurables


Hardware y simulación
El producto emplea el siguiente hardware. El desarrollo puede realizarse en simulación, y el hardware
real se usa para validar.

    •​ Unidad del usuario: placa Wemos D1 R32 (ESP32) con módulo LoRa SX1278 Ra-01 (433 MHz) y
       Bluetooth integrado.
    •​ Collar: Arduino Nano v3 con módulo LoRa SX1278 Ra-01 (433 MHz) y módulo GPS u-blox
       NEO-6M.
    •​ Avisos locales: buzzer y LED en el collar y en la unidad, y pantalla OLED opcional en la unidad.
    •​ Wokwi simula ESP32 y Arduino Nano. No simula Bluetooth: las partes BLE se prueban en placa
       real.
    •​ LoRa se desarrolla detrás de una capa Radio con dos implementaciones: RadioLoRa (módulo
       real) y RadioSim (tramas por puerto serie).
    •​ GPS: el collar genera sentencias NMEA a partir de una ruta pregrabada y las procesa con la
       misma librería que usaría con el módulo real. Usar el módulo real es opcional.
    •​ Los proyectos gratuitos de Wokwi son públicos. Nunca deben contener claves ni identificadores
       reales: para la simulación se usan valores de prueba, que se consideran públicos.
4. Requisitos no funcionales
El sistema completo (dispositivo, backend y frontend) debe cumplir los requisitos no funcionales de esta
sección. Cada grupo decide qué técnicas aplicar en cada caso particular: puede emplear las vistas en
clase u otras que no lo hayan sido, si las considera más adecuadas, y debe justificar su elección en el
README. Los requisitos se verifican en el código y en la demostración.

Robustez y disponibilidad
    •​ Recuperación: el sistema debe recuperarse por sí solo de fallas del dispositivo, de interrupciones
       de los enlaces y de la indisponibilidad temporal de la plataforma.
    •​ Estado seguro: ante condiciones anómalas, el dispositivo debe quedar en un estado seguro y
       predecible, sin conductas no deseadas que se prolonguen en el tiempo.
    •​ Estabilidad: el dispositivo debe mantener un funcionamiento estable durante una operación
       prolongada, con un uso acotado de sus recursos.

Confiabilidad de los datos
    •​ Integridad: los datos inválidos, duplicados o corruptos deben ser detectados y descartados sin
       afectar el funcionamiento del sistema.
    •​ Trazabilidad: cada dato debe poder identificarse y ordenarse, de modo que se reconozcan las
       pérdidas y las repeticiones.
    •​ Tolerancia a fallas de enlace: la pérdida o la demora de datos debe ser tolerada y, cuando
       corresponda, visible para el usuario.

Seguridad
    •​ Secretos: las credenciales y claves no deben estar expuestas en el código, en el repositorio, en
       los registros ni en el frontend.
    •​ Entradas no confiables: toda entrada proveniente de usuarios, de la red o de los enlaces
       inalámbricos debe tratarse como no confiable y validarse.
    •​ Acceso: cada usuario debe acceder únicamente a sus propios datos y operaciones, con
       autenticación y autorización verificadas en el servidor. La autenticación puede resolverse con un
       mecanismo propio o con una plataforma externa, como Auth0.
    •​ Identidad de los dispositivos: cada dispositivo debe tener identidad y claves propias, que no se
       compartan entre dispositivos ni entre grupos.
    •​ Protección de la información: los datos de los usuarios, incluidas sus contraseñas, deben
       protegerse tanto en su almacenamiento como en su transmisión, en la medida adecuada a cada
       caso.

Mantenibilidad y calidad
    •​ Modularidad: el código debe estar organizado en módulos con responsabilidades claras, con
       nombres descriptivos y sin duplicación innecesaria.
    •​ Independencia: las dependencias de hardware, de red y de plataforma deben estar aisladas, de
       modo que puedan reemplazarse y simularse.
    •​ Configurabilidad: la configuración debe estar separada del código y documentada.
    •​ Verificabilidad: las funciones críticas deben contar con pruebas automatizadas y debe existir un
       modo de verificar el sistema de punta a punta.
    •​ Manejo de errores: los errores deben tratarse y comunicarse al usuario con claridad, sin exponer
       detalles internos.

Interoperabilidad entre grupos
    •​ Intercambiabilidad: los componentes de cada grupo deben poder combinarse con los de otros
       grupos, de modo que cualquier collar funcione con cualquier unidad y cualquier frontend con
       cualquier backend, con cambios mínimos o nulos.
    •​ Contratos acordados: los grupos deben acordar entre sí, antes de comenzar la implementación,
       las interfaces entre componentes (formato de la trama entre collar y unidad, y API entre backend
       y frontend), y documentarlas en un acuerdo común y vigente para todos.
    •​ Compatibilidad de las variantes: las funciones propias de cada variante no deben romper la
       compatibilidad con los demás grupos; toda extensión de una interfaz debe poder ser ignorada
       por quien no la conozca.
    •​ Comprobación: la interoperabilidad debe poder comprobarse combinando componentes de
       distintos grupos.

Eficiencia, observabilidad y documentación
    •​ Eficiencia: el consumo de energía del collar y el uso del canal de radio deben ser razonables para
       la finalidad del producto.
    •​ Diagnóstico: el sistema debe permitir diagnosticar fallas a partir de registros útiles que no
       incluyan datos sensibles.
    •​ Reproducibilidad: cualquier persona debe poder construir, configurar y ejecutar cada
       componente siguiendo la documentación, que además debe describir la arquitectura y las
       decisiones de diseño.

5. Requisitos del producto y variantes
Todos los grupos cumplen lo mínimo obligatorio del producto; además, cada grupo desarrolla la variante
que se le asignó (sección 3). Los datos que se envían a Ovenbird IoT Cloud están definidos en la
especificación de la plataforma (sección 9).

Producto · Collar LoRa de dos partes (Arduino Nano y ESP32)
El producto se compone de un collar (Arduino Nano, GPS y módulo LoRa) y de una unidad del usuario
(ESP32 con módulo LoRa y Bluetooth). La unidad se vincula con la app Ovenbird Smart, que envía los
datos a la nube y muestra el mapa.

Obligatorio:

    •​ Protocolo entre collar y unidad: acordado entre todos los grupos y documentado.
    •​ Independencia del radio: el código no debe depender del módulo LoRa concreto, de modo que pueda
        probarse en simulación.
    •​ Collar: obtiene su posición (real o simulada), la transmite periódicamente a la unidad y atiende
       los comandos de ésta, como hacer sonar el aviso o cambiar el intervalo de reporte.
      •​ Unidad: recibe los datos del collar, descarta los inválidos y los expone a la app móvil según el
         perfil BLE de Ovenbird IoT Cloud (documento provisto), incluidos los comandos y sus
         confirmaciones.
      •​ Debe superar los vectores de prueba del perfil BLE.

Variantes
La variante asignada se suma a lo obligatorio y puede abarcar el dispositivo, el backend y el frontend.

N.º      Variante                   Descripción

1        Ahorro de energía          El collar debe contar con un modo de bajo consumo, configurable
         (Valotta)                  por el usuario, que prolongue la duración de su batería sin dejar de
                                    atender sus órdenes. Cada grupo decide qué funciones reduce o
                                    suspende en ese modo. La solución debe estimar el consumo en el
                                    modo normal y en el modo de ahorro, y mostrar al usuario la
                                    autonomía esperada en cada uno.

2        Calidad de GPS (La         La posición mostrada debe ser confiable. El sistema debe reconocer
         Grasta)                    las lecturas imprecisas o incoherentes, evitar que distorsionen el
                                    recorrido e indicar al usuario qué tan exacta es la ubicación.

3        Pérdida de enlace y        El usuario debe ser advertido cuando el collar se aleja de su unidad o
         zonas (Agurto)             sale de las zonas definidas para la mascota, sin falsas alarmas ante
                                    interrupciones breves. Las zonas deben poder definirse y verse en el
                                    mapa.

4        Buscar y guiar (Verdi)     El usuario debe poder hacer sonar el collar para ubicar a su mascota
                                    y saber si la orden fue recibida. La unidad debe mostrar con claridad
                                    el estado del collar y qué tan reciente es su última posición.

5        Historial y recorridos     El usuario debe poder consultar los recorridos de su mascota más
         (Rios)                     allá del período que conserva la plataforma. Cada recorrido se
                                    presenta trazado en el mapa, con los kilómetros realizados, y se
                                    ofrecen totales por día y por semana.

6        Compartir mascota y        El dueño de una mascota debe poder compartir su seguimiento con
         roles (Rodriguez)          otras personas, como familiares o un paseador, otorgando a cada
                                    una permisos distintos y, si lo desea, por un tiempo limitado. Nadie
                                    debe acceder a información que no se le haya otorgado.

7        Mascota perdida            El usuario debe poder declarar perdida a su mascota. Mientras dure
         (Frickmann)                ese estado, el seguimiento se intensifica y se habilita un enlace
                                    público y temporal para que terceros vean su ubicación sin
                                    necesidad de cuenta. Al encontrarla, el enlace deja de funcionar y el
                                    sistema retoma su operación normal.
N.º      Variante                  Descripción

8        Notificaciones            El usuario debe poder definir de qué situaciones desea ser
         configurables (Dario      notificado, como batería baja o pérdida de conexión del collar, y por
         Mayor)                    qué medios. Los avisos no deben repetirse innecesariamente y
                                   deben respetar un horario de silencio elegido por el usuario.



6. Backend NestJS
El backend es el integrador: administra usuarios, mascotas y vínculos con dispositivos, se comunica con
Ovenbird IoT Cloud solo mediante @ovenbird/node y emite los tokens que usa el frontend.

Obligatorio:

      •​ Estructura: módulos NestJS por dominio (autenticación, mascotas, dispositivos e integración con
         Ovenbird IoT Cloud), con DTOs validados.
      •​ Usuarios: registro e inicio de sesión y rutas protegidas. La autenticación puede resolverse con un
         mecanismo propio o con una plataforma externa, como Auth0. Cada usuario accede solo a sus
         propios datos.
      •​ Mascotas: CRUD completo con validación y paginación.
      •​ Vínculo mascota–dispositivo:
             o​ El backend genera un código con ob.pairing.createCode, que el usuario ingresa en la
                  app móvil; luego el backend lista los dispositivos del tenant y asocia uno a la mascota.
             o​ Debe poder desvincularse.
      •​ Token de embebido: un endpoint autenticado que calcula qué dispositivos pertenecen al usuario
         y devuelve un token de corta duración creado con ob.embed.createToken. Nunca devuelve el
         clientSecret.
      •​ Traducción de errores: los errores del SDK se convierten en respuestas HTTP coherentes (por
         ejemplo, un dispositivo inexistente produce un 404).
      •​ Persistencia en una base de datos a elección del grupo, con las instrucciones para crearla.
      •​ Configuración por variables de entorno, con un .env.example y sin secretos en el repositorio.
      •​ Documentación de la API con Swagger, conforme al contrato acordado entre los grupos.
      •​ Pruebas unitarias con Jest de los servicios clave (autenticación, mascotas y vínculo con
         dispositivos), con el SDK simulado.

7. Frontend Next.js
El frontend es el portal del cliente: administra las mascotas y muestra su estado y su posición con los
componentes de @ovenbird/react, sin conocer ningún secreto de la plataforma.

Obligatorio:

      •​ Autenticación: registro e inicio de sesión según el mecanismo de autenticación elegido, con
         rutas protegidas.
      •​ Mascotas: listado, alta, edición y baja.
   •​ Vinculación de dispositivo: muestra el código de emparejamiento con su vencimiento y las
      instrucciones para ingresarlo en la app móvil.
   •​ Mapa embebido: OvenbirdProvider y DeviceMap, con getToken implementado contra el
      endpoint del backend. Las mascotas con dispositivo se muestran en el mapa y al seleccionar una
      se la centra.
   •​ Estado del dispositivo en vivo con useDeviceStatus: conexión, batería y última vez visto
      (OnlineBadge y BatteryIndicator).
   •​ Estados de carga y error visibles, y diseño utilizable en pantallas de celular y de escritorio.

   •​ Las llamadas a Ovenbird IoT Cloud salen únicamente del SDK.

8. Entregables
Entregables: un único repositorio por grupo, con todos los componentes y un único README.

   •​ Código del firmware (incluido el enlace al proyecto de Wokwi), del backend y del frontend.
   •​ README único del grupo, con: descripción de la variante asignada, arquitectura (diagrama),
      cómo ejecutar cada componente, variables de entorno (sin valores reales), decisiones de diseño
      y justificación de las técnicas empleadas para cumplir los requisitos no funcionales.
   •​ Frontend y, si lo hicieron, backend desplegados; de lo contrario, instrucciones para ejecutarlos en
      local.
   •​ Credenciales entregadas al docente por el canal que éste indique, nunca en el repositorio.

9. Recursos que provee la cátedra
   •​ Plataforma Ovenbird IoT Cloud desplegada, con documentación de la API (/docs) y el contrato
      en openapi.json.
   •​ Credenciales por grupo: clientId y clientSecret de integrador para el backend.
   •​ SDK @ovenbird/node (con módulo para NestJS) y @ovenbird/react, con README y ejemplos
      nest-backend y next-frontend.
   •​ Simulador de dispositivos (lora-unit, con --chaos) y una ruta GPX de ejemplo.
   •​ Perfil BLE v1 (documento y vectores de prueba) y la app móvil Ovenbird Smart (APK para
      Android, con modo simulado).
   •​ Especificación de la plataforma: productos, puntos de datos (DP) y API REST.
```
