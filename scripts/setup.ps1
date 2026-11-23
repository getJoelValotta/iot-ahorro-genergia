# Setup del entorno (Windows / PowerShell). Ejecutar desde la raíz del repo:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# Descarga SDKs y recursos de Ovenbird a vendor\ y verifica las herramientas. No toca secretos.
$ErrorActionPreference = "Stop"
$base = "https://iotplatform.ovenbirdconsulting.com.ar"
New-Item -ItemType Directory -Force -Path vendor | Out-Null

$files = @(
  "descargas/ovenbird-node-1.0.0.tgz",
  "descargas/ovenbird-react-1.0.0.tgz",
  "descargas/ble-test-vectors.json",
  "descargas/ble_profile.h",
  "openapi.json"
)
foreach ($f in $files) {
  $out = Join-Path "vendor" (Split-Path $f -Leaf)
  Write-Host "Descargando $f"
  Invoke-WebRequest -Uri "$base/$f" -OutFile $out
}

# Los vectores BLE de docs/vendor deben coincidir con los oficiales.
$a = (Get-Content vendor\ble-test-vectors.json -Raw | ConvertFrom-Json).cases | ConvertTo-Json -Depth 5 -Compress
$b = (Get-Content docs\vendor\ble-test-vectors.json -Raw | ConvertFrom-Json).cases | ConvertTo-Json -Depth 5 -Compress
if ($a -ne $b) { Write-Warning "ble-test-vectors.json cambió respecto de docs/vendor: revisar y actualizar." }

Write-Host "`nHerramientas:"
foreach ($t in @("git", "node", "npm", "python", "pio", "wokwi-cli")) {
  $c = Get-Command $t -ErrorAction SilentlyContinue
  if ($c) { Write-Host "  OK  $t" } else { Write-Host "  FALTA $t" -ForegroundColor Yellow }
}
if (-not $env:WOKWI_CLI_TOKEN) { Write-Host "  FALTA variable WOKWI_CLI_TOKEN (ver docs/04-wokwi.md)" -ForegroundColor Yellow }
Write-Host "`nPython deps de herramientas: pip install pyserial pytest"
Write-Host "Listo. Siguiente paso: docs/PLAN.md (Fase 0)."
