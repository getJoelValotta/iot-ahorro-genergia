// Configuración del firmware. Todo valor es sobreescribible con build_flags
// en platformio.ini (nunca hardcodear DEV_ID en la lógica).
// Proyectos Wokwi gratuitos son PÚBLICOS: acá solo van valores de prueba.
#pragma once

// ---- Identidad ---------------------------------------------------------------
// DEV_ID = (numero_grupo << 8) | numero_collar. Grupo 1, collar 1 => 0x0101.
#ifndef DEV_ID
#define DEV_ID 0x0101
#endif

#ifndef FW_MAJOR
#define FW_MAJOR 1
#endif
#ifndef FW_MINOR
#define FW_MINOR 0
#endif
#ifndef FW_PATCH
#define FW_PATCH 0
#endif

// ---- Collar -------------------------------------------------------------------
#ifndef DEFAULT_INTERVAL_S
#define DEFAULT_INTERVAL_S 15
#endif
#define RX_WINDOW_MS 500UL          // ventana RX post-TX en modo ahorro (§4.1)
#define GPS_WARMUP_MS 8000UL        // en ahorro el GPS se enciende solo antes de cada TX
#define REBOOT_FRAMES 3             // tramas con FLAGS.REINICIO tras reset

// Pines collar (Arduino Nano + Ra-01 + NEO-6M)
#define COLLAR_PIN_LORA_SS 10
#define COLLAR_PIN_LORA_RST 9
#define COLLAR_PIN_LORA_DIO0 2
#define COLLAR_PIN_GPS_RX 4         // NEO-6M TX -> D4
#define COLLAR_PIN_GPS_TX 3         // NEO-6M RX <- D3
#define COLLAR_PIN_BUZZER 5
#define COLLAR_PIN_LED 6
#define COLLAR_PIN_GPS_EN 7         // habilita la alimentación del GPS (transistor)
#define COLLAR_PIN_BATTERY A0

// ---- Unidad -------------------------------------------------------------------
// DEV_ID del collar vinculado (la unidad solo acepta tramas de este collar).
#ifndef PAIRED_DEV_ID
#define PAIRED_DEV_ID DEV_ID
#endif
#define STATUS_REFRESH_MS 5000UL    // refresco periódico de STATUS por BLE

// Pines unidad (Wemos D1 R32 / ESP32 + Ra-01)
#define UNIT_PIN_LORA_SS 5
#define UNIT_PIN_LORA_RST 14
#define UNIT_PIN_LORA_DIO0 26
#define UNIT_PIN_BUZZER 25
#define UNIT_PIN_LED 2
#define UNIT_PIN_BTN_FIND 4         // demo local: FIND_ME 10 s
#define UNIT_PIN_BTN_MODE 15        // demo local: alterna ahorro (150 s) / normal (15 s)

// ---- Logs ---------------------------------------------------------------------
// En simulación los logs comparten el puerto con RadioSim: son líneas ASCII que
// empiezan con "# " (nunca contienen 0xAA, así que el receptor las descarta al
// re-sincronizar). Para pruebas cruzadas con otros grupos usar LOG_ENABLED=0.
#ifndef LOG_ENABLED
#define LOG_ENABLED 1
#endif
