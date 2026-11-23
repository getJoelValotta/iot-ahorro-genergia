# 07: Autonomía estimada (solo lectura)

**What to build:** en la ficha de cada mascota con collar aparece la tarjeta "Batería y ahorro" con la batería actual y cuánto dura la batería en modo Normal y en modo Ahorro, tanto con carga completa como con la carga actual. Solo se muestra si el backend conectado anuncia `power-saving`.

**Blocked by:** 05 (Vincular y desvincular el collar)

**Status:** ready-for-agent

- [ ] Modelo de consumo como función pura: corriente media por modo a partir de corrientes de datasheet (ATmega328P, SX1278, NEO-6M), tiempo en el aire SF7/BW125, ventana RX 500 ms, precalentamiento del GPS 8 s e intervalo (15 s normal / 150 s ahorro, configurables); autonomía = capacidad / corriente.
- [ ] Capacidad de batería configurable con valor de ejemplo 1000 mAh; fuentes y supuestos documentados en `docs/03`.
- [ ] `GET /api/v1/pets/{petId}/power` → modo pedido (por defecto normal), intervalo, estado del comando (`none` si nunca se cambió), `batteryPct` (de Ovenbird, o null), capacidad usada y, por modo, corriente media, horas con carga completa y horas restantes (null sin batería). Marcada `x-variant: power-saving` en Swagger.
- [ ] Mascota ajena → `404 PET_NOT_FOUND`; sin collar → `409 PET_HAS_NO_DEVICE`; Ovenbird caído → 502/503.
- [ ] Frontend: tarjeta "Batería y ahorro" en lenguaje simple (ej. "Normal: ~13 h · Ahorro: ~2 días"), oculta si `power-saving` no está en `variants`.
- [ ] Tests: de la función pura (ahorro dura más que normal, escala con capacidad y con porcentaje, valores en rango razonable) y por HTTP del `GET` con Ovenbird falso.
