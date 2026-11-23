// Puente hacia la app Ovenbird Smart. Dos implementaciones:
//  - BleOvenbird (ENABLE_BLE=1): GATT real del perfil BLE v1 con NimBLE (placa real).
//  - BleConsole  (ENABLE_BLE=0): Wokwi no simula Bluetooth; imprime cada
//    característica en hex por el log y acepta escrituras de COMMAND desde la
//    consola con líneas ">ble <hex de 5 bytes>" (p.ej. ">ble 0700010a00").
#pragma once
#include <Arduino.h>
#include <ble_codec.h>

class BleGateway {
 public:
  virtual ~BleGateway() {}
  virtual void begin(const char* fwVersion) = 0;
  virtual void setFwVersion(const char* fw) = 0;
  virtual void publishLocation(const uint8_t (&v)[pet::ble::kLocationLen]) = 0;
  virtual void publishStatus(const uint8_t (&v)[pet::ble::kStatusLen]) = 0;
  virtual void publishAck(const uint8_t (&v)[pet::ble::kAckLen]) = 0;
  // Devuelve true si hay un COMMAND escrito por la app pendiente de procesar.
  virtual bool pollCommand(pet::ble::Command& out) = 0;
  virtual bool connected() const = 0;
};

// Cola mínima de comandos BLE (los callbacks de NimBLE corren en otra tarea).
class BleCommandInbox {
 public:
  void push(const pet::ble::Command& c);
  bool pop(pet::ble::Command& out);

 private:
  static const uint8_t kSize = 4;
  pet::ble::Command q_[kSize];
  volatile uint8_t head_ = 0, tail_ = 0;
  portMUX_TYPE mux_ = portMUX_INITIALIZER_UNLOCKED;
};

BleGateway& createBleGateway();
// Inyecta un COMMAND como si lo hubiera escrito la app (botones de demo en la unidad).
void bleInject(const pet::ble::Command& c);
// Solo BleConsole: procesa una línea ">ble ..." recibida por consola.
void bleConsoleLine(const char* line);
