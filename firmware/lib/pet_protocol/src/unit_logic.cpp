#include "unit_logic.h"

#include <string.h>

#include "collar_logic.h"

namespace pet {

// ---- SeqDeduplicator ---------------------------------------------------------
void SeqDeduplicator::reset() {
  count_ = 0;
  next_ = 0;
  restart_window_ = false;
  duplicates_ = 0;
}

bool SeqDeduplicator::contains(uint16_t seq) const {
  for (uint8_t i = 0; i < count_; ++i)
    if (hist_[i] == seq) return true;
  return false;
}

bool SeqDeduplicator::accept(uint16_t seq, bool reinicio) {
  if (reinicio) {
    // Retransmisión de una trama de reinicio ya vista => duplicada.
    if (restart_window_ && contains(seq)) { ++duplicates_; return false; }
    if (!restart_window_) {  // primer aviso de reinicio: limpiar historial
      count_ = 0;
      next_ = 0;
      restart_window_ = true;
    }
  } else {
    if (contains(seq)) { ++duplicates_; return false; }
    restart_window_ = false;
  }
  hist_[next_] = seq;
  next_ = (next_ + 1) % 4;
  if (count_ < 4) ++count_;
  return true;
}

// ---- OnlineTracker -----------------------------------------------------------
uint32_t OnlineTracker::offlineAfterMs() const {
  if (interval_s_ == 0) return power_save_ ? 360000UL : 60000UL;
  uint32_t t = (2UL * interval_s_ + 30UL) * 1000UL;
  return t < 60000UL ? 60000UL : t;
}

bool OnlineTracker::online(uint32_t now_ms) const {
  if (!has_frame_) return false;
  return (now_ms - last_ms_) < offlineAfterMs();
}

// ---- Traducción BLE <-> LoRa -------------------------------------------------
bool bleToLoraCommand(const ble::Command& in, uint8_t lora_cmd_id, Command& out) {
  memset(&out, 0, sizeof(out));
  out.cmd_id = lora_cmd_id;
  switch (in.opcode) {
    case ble::kOpFindMe:
      if (in.arg > kMaxFindMeS) return false;
      out.code = kCmdFindMe;
      out.plen = 1;
      out.params[0] = (uint8_t)in.arg;
      return true;
    case ble::kOpSetInterval:
      if (in.arg < kMinIntervalS || in.arg > kMaxIntervalS) return false;
      out.code = kCmdSetInterval;
      out.plen = 2;
      putU16BE(out.params, in.arg);
      return true;
    default:
      return false;
  }
}

uint8_t loraResultToBle(uint8_t r) {
  switch (r) {
    case kAckOk: return ble::kAckOk;
    case kAckUnsupported: return ble::kAckUnsupported;
    case kAckInvalidParam: return ble::kAckUnsupported;  // BLE v1 no tiene "invalid"
    default: return ble::kAckNoResponse;                 // FAILED
  }
}

// ---- UnitCommandQueue --------------------------------------------------------
bool UnitCommandQueue::enqueue(const Command& cmd, uint16_t ble_cmd_id, uint32_t now_ms) {
  (void)now_ms;
  if (full()) return false;
  Entry& e = q_[count_++];
  e.cmd = cmd;
  e.ble_cmd_id = ble_cmd_id;
  e.attempts = 0;
  e.last_tx_ms = 0;
  e.last_window = 0;
  e.windows = 0;
  return true;
}

const Command* UnitCommandQueue::nextToSend(uint32_t now_ms, bool continuous_rx,
                                            uint32_t telemetry_ms, uint32_t telemetry_count) {
  for (uint8_t i = 0; i < count_; ++i) {
    Entry& e = q_[i];
    if (continuous_rx) {
      if (e.attempts >= kMaxAttemptsContinuous) continue;
      if (e.attempts == 0 || now_ms - e.last_tx_ms >= kRetryMs) {
        ++e.attempts;
        e.last_tx_ms = now_ms;
        return &e.cmd;
      }
    } else {
      // Ventana RX: solo tras una telemetría nueva y dentro de los 100 ms.
      if (telemetry_count == 0 || e.last_window == telemetry_count) continue;
      if (now_ms - telemetry_ms > kWindowSendMs) continue;
      e.last_window = telemetry_count;
      ++e.windows;
      ++e.attempts;
      e.last_tx_ms = now_ms;
      return &e.cmd;
    }
  }
  return 0;
}

bool UnitCommandQueue::onAck(const Ack& ack, uint16_t& ble_cmd_id, uint8_t& lora_result,
                             Command* acked) {
  for (uint8_t i = 0; i < count_; ++i) {
    if (q_[i].cmd.cmd_id == ack.cmd_id && q_[i].cmd.code == ack.code) {
      ble_cmd_id = q_[i].ble_cmd_id;
      lora_result = ack.result;
      if (acked) *acked = q_[i].cmd;
      removeAt(i);
      return true;
    }
  }
  return false;
}

bool UnitCommandQueue::popExpired(uint32_t now_ms, bool continuous_rx, uint16_t& ble_cmd_id) {
  for (uint8_t i = 0; i < count_; ++i) {
    const Entry& e = q_[i];
    bool expired;
    if (continuous_rx) {
      expired = e.attempts >= kMaxAttemptsContinuous && now_ms - e.last_tx_ms >= kRetryMs;
    } else {
      // Esperamos el ACK hasta 1 s después de la última ventana usada.
      expired = e.windows >= kMaxWindows && now_ms - e.last_tx_ms >= kRetryMs;
    }
    if (expired) {
      ble_cmd_id = e.ble_cmd_id;
      removeAt(i);
      return true;
    }
  }
  return false;
}

void UnitCommandQueue::removeAt(uint8_t i) {
  for (uint8_t j = i; j + 1 < count_; ++j) q_[j] = q_[j + 1];
  --count_;
}

}  // namespace pet
