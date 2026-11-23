// Lógica pura del Collar (sin Arduino): manejo de comandos con idempotencia
// y política de energía de la variante Grupo 1 (power-saving).
#pragma once
#include <stdint.h>

#include "frame.h"

namespace pet {

const uint16_t kMinIntervalS = 5;
const uint16_t kMaxIntervalS = 3600;
const uint16_t kPowerSaveThresholdS = 100;  // SET_INTERVAL >= 100 s => modo ahorro
const uint8_t kMaxFindMeS = 60;

struct PowerProfile {
  uint16_t interval_s;
  bool power_save;        // FLAGS bit 3 MODO_AHORRO
  bool continuous_rx;     // FLAGS bit 2 ESCUCHA_CONTINUA
};

// Grupo 1: ahorro <=> intervalo >= 100 s. En ahorro la radio solo escucha
// en la ventana de 500 ms post-TX y el GPS se apaga entre fixes.
PowerProfile profileForInterval(uint16_t interval_s);

struct CommandEffects {
  bool interval_changed;
  uint16_t interval_s;
  bool find_me;          // iniciar (s>0) o apagar (s==0) buzzer/LED
  uint8_t find_me_s;
  bool telemetry_now;    // REQUEST_TELEMETRY => telemetría inmediata con FW_VERSION
};

class CollarCommandHandler {
 public:
  CollarCommandHandler() : has_last_(false), last_{0, 0, 0} {}

  // Procesa un comando ya validado (decodeFrame OK y DEV_ID propio).
  // Devuelve el ACK a enviar. Si el CMD_ID repite el anterior, no re-ejecuta
  // (effects vacío) y devuelve el mismo ACK.
  Ack handle(const Command& cmd, CommandEffects& fx);

 private:
  bool has_last_;
  Ack last_;
};

// Temporizador de FIND_ME con auto-apagado obligatorio.
class FindMeTimer {
 public:
  FindMeTimer() : active_(false), until_ms_(0) {}
  void start(uint8_t seconds, uint32_t now_ms);
  // Devuelve true mientras deba sonar. Se apaga solo al vencer.
  bool active(uint32_t now_ms);

 private:
  bool active_;
  uint32_t until_ms_;
};

}  // namespace pet
