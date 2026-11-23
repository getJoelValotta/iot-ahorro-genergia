# 08: Cambiar el modo de ahorro

**What to build:** desde la tarjeta "Batería y ahorro", el dueño cambia entre Normal y Ahorro con un interruptor y ve en qué estado está el cambio: "Enviando…", "Aplicado en el collar" o "El collar no respondió". El modo elegido se recuerda aunque cierre la sesión.

**Blocked by:** 07 (Autonomía estimada)

**Status:** ready-for-agent

- [ ] `PUT /api/v1/pets/{petId}/power { mode: "normal" | "saving" }` envía `report_interval_s` (15 / 150) con el SDK, guarda modo, id del comando y fecha, y responde `202` con la misma forma que el `GET`.
- [ ] El `GET` reconcilia a demanda: si el comando está `pending`, consulta su estado en Ovenbird y lo pasa a `confirmed` o `failed`.
- [ ] `mode` inválido → 400 con `errors`; ajena → 404; sin collar → 409; Ovenbird caído → 502/503 sin perder el modo anterior.
- [ ] Frontend: interruptor Normal/Ahorro; mientras está `pending` muestra "Enviando…" y vuelve a consultar cada pocos segundos; muestra "Aplicado en el collar" o "El collar no respondió".
- [ ] Verificado a mano con el dispositivo virtual de Ovenbird (confirma al instante).
- [ ] Tests: por HTTP con Ovenbird falso (envío del DP correcto por modo, transición pending→confirmed y pending→failed, errores).
