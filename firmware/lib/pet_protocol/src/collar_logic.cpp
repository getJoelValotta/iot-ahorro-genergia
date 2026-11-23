#include "collar_logic.h"

#include <string.h>

namespace pet {

PowerProfile profileForInterval(uint16_t interval_s) {
  PowerProfile p;
  p.interval_s = interval_s;
  p.power_save = interval_s >= kPowerSaveThresholdS;
  p.continuous_rx = !p.power_save;
  return p;
}

Ack CollarCommandHandler::handle(const Command& cmd, CommandEffects& fx) {
  memset(&fx, 0, sizeof(fx));
  if (has_last_ && cmd.cmd_id == last_.cmd_id) {
    return last_;  // retransmisión: no re-ejecutar
  }

  Ack ack;
  ack.cmd_id = cmd.cmd_id;
  ack.code = cmd.code;
  ack.result = kAckOk;

  switch (cmd.code) {
    case kCmdSetInterval: {
      if (cmd.plen != 2) { ack.result = kAckInvalidParam; break; }
      const uint16_t s = getU16BE(cmd.params);
      if (s < kMinIntervalS || s > kMaxIntervalS) { ack.result = kAckInvalidParam; break; }
      fx.interval_changed = true;
      fx.interval_s = s;
      break;
    }
    case kCmdFindMe: {
      if (cmd.plen != 1 || cmd.params[0] > kMaxFindMeS) { ack.result = kAckInvalidParam; break; }
      fx.find_me = true;
      fx.find_me_s = cmd.params[0];
      break;
    }
    case kCmdRequestTelemetry:
      if (cmd.plen != 0) { ack.result = kAckInvalidParam; break; }
      fx.telemetry_now = true;
      break;
    default:
      ack.result = kAckUnsupported;  // incluye comandos 0xN0..0xNF de otros grupos
      break;
  }

  has_last_ = true;
  last_ = ack;
  return ack;
}

void FindMeTimer::start(uint8_t seconds, uint32_t now_ms) {
  if (seconds == 0) {
    active_ = false;
    return;
  }
  active_ = true;
  until_ms_ = now_ms + (uint32_t)seconds * 1000UL;
}

bool FindMeTimer::active(uint32_t now_ms) {
  if (active_ && (int32_t)(now_ms - until_ms_) >= 0) active_ = false;
  return active_;
}

}  // namespace pet
