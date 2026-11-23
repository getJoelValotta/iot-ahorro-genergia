// Lógica pura de la Unidad (sin Arduino/BLE): deduplicación por SEQ,
// criterio collar_online, cola de comandos LoRa y traducción BLE <-> LoRa.
#pragma once
#include <stdint.h>

#include "ble_codec.h"
#include "frame.h"

namespace pet {

// §4.3: descarta SEQ igual a alguno de los últimos 4 válidos; REINICIO limpia historial.
class SeqDeduplicator {
 public:
  SeqDeduplicator() { reset(); }
  void reset();
  // true => aceptar la telemetría; false => duplicada.
  bool accept(uint16_t seq, bool reinicio);
  uint32_t duplicates() const { return duplicates_; }

 private:
  bool contains(uint16_t seq) const;
  uint16_t hist_[4];
  uint8_t count_;
  uint8_t next_;
  bool restart_window_;  // historial iniciado por una trama con REINICIO
  uint32_t duplicates_;
};

// §4.5: collar_online.
class OnlineTracker {
 public:
  OnlineTracker() : has_frame_(false), last_ms_(0), interval_s_(0), power_save_(false) {}
  void onValidFrame(uint32_t now_ms) { has_frame_ = true; last_ms_ = now_ms; }
  void setKnownInterval(uint16_t s) { interval_s_ = s; }
  void setPowerSaveHint(bool ps) { power_save_ = ps; }
  uint32_t offlineAfterMs() const;
  bool online(uint32_t now_ms) const;
  uint32_t lastFrameMs() const { return last_ms_; }

 private:
  bool has_frame_;
  uint32_t last_ms_;
  uint16_t interval_s_;  // 0 = desconocido
  bool power_save_;
};

// Traducción BLE -> LoRa. Devuelve false si el opcode no existe o el argumento
// está fuera de rango (=> COMMAND_ACK BLE result 2 "unsupported").
bool bleToLoraCommand(const ble::Command& in, uint8_t lora_cmd_id, Command& out);
// Traducción del RESULT LoRa al result BLE.
uint8_t loraResultToBle(uint8_t lora_result);

// §4.1: cola de comandos hacia el collar (>= 4 entradas).
class UnitCommandQueue {
 public:
  static const uint8_t kCapacity = 4;
  static const uint8_t kMaxAttemptsContinuous = 4;  // 1 envío + 3 reintentos cada 1 s
  static const uint16_t kRetryMs = 1000;
  static const uint16_t kWindowSendMs = 100;        // enviar dentro de 100 ms post-telemetría
  static const uint8_t kMaxWindows = 3;             // ventanas RX sin ACK => sin respuesta

  static const uint16_t kInternalId = 0xFFFF;  // comando originado en la unidad (sin ACK BLE)

  UnitCommandQueue() : count_(0) {}

  bool full() const { return count_ >= kCapacity; }
  uint8_t size() const { return count_; }

  // false si la cola está llena (=> BLE result 1 "busy").
  bool enqueue(const Command& cmd, uint16_t ble_cmd_id, uint32_t now_ms);

  // Devuelve el próximo comando a transmitir ahora o nullptr.
  // continuous_rx: FLAGS.ESCUCHA_CONTINUA de la última telemetría.
  // telemetry_ms / telemetry_count: instante y contador de la última telemetría válida.
  const Command* nextToSend(uint32_t now_ms, bool continuous_rx, uint32_t telemetry_ms,
                            uint32_t telemetry_count);

  // Empareja un ACK. true si correspondía a un comando pendiente.
  // Si acked != nullptr se copia el comando confirmado (p. ej. para conocer el
  // intervalo aplicado por SET_INTERVAL).
  bool onAck(const Ack& ack, uint16_t& ble_cmd_id, uint8_t& lora_result, Command* acked = 0);

  // Retira un comando vencido (sin respuesta). true si retiró uno.
  bool popExpired(uint32_t now_ms, bool continuous_rx, uint16_t& ble_cmd_id);

 private:
  struct Entry {
    Command cmd;
    uint16_t ble_cmd_id;
    uint8_t attempts;
    uint32_t last_tx_ms;
    uint32_t last_window;  // telemetry_count de la ventana en que se envió
    uint8_t windows;
  };
  void removeAt(uint8_t i);
  Entry q_[kCapacity];
  uint8_t count_;
};

}  // namespace pet
