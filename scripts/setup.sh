#!/usr/bin/env bash
# Setup del entorno (Linux/macOS/Git Bash). Ejecutar desde la raíz del repo: bash scripts/setup.sh
set -euo pipefail
BASE=https://iotplatform.ovenbirdconsulting.com.ar
mkdir -p vendor
for f in descargas/ovenbird-node-1.0.0.tgz descargas/ovenbird-react-1.0.0.tgz \
         descargas/ble-test-vectors.json descargas/ble_profile.h openapi.json; do
  echo "Descargando $f"
  curl -fsSL "$BASE/$f" -o "vendor/$(basename "$f")"
done
python3 - <<'EOF' || echo "AVISO: ble-test-vectors.json difiere de docs/vendor: revisar."
import json
a = json.load(open("vendor/ble-test-vectors.json"))["cases"]
b = json.load(open("docs/vendor/ble-test-vectors.json"))["cases"]
assert a == b
EOF
echo; echo "Herramientas:"
for t in git node npm python3 pio wokwi-cli; do
  if command -v "$t" >/dev/null; then echo "  OK  $t"; else echo "  FALTA $t"; fi
done
[ -n "${WOKWI_CLI_TOKEN:-}" ] || echo "  FALTA variable WOKWI_CLI_TOKEN (ver docs/04-wokwi.md)"
echo "Python deps de herramientas: pip install pyserial pytest"
