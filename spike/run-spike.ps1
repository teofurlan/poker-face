# PROTOTYPE helper: runs phase A (face) then, after Enter, phase B (full). Logs to run8-face.log / run9-full.log.
Set-Location $PSScriptRoot
if (-not $env:PRESAGE_API_KEY) { $env:PRESAGE_API_KEY = [Environment]::GetEnvironmentVariable('PRESAGE_API_KEY','User') }
$cam = if ($env:CAM) { $env:CAM } else { 'ACER' }; Write-Host "Cámara: $cam (cambia con CAM=<parte del nombre>)"
Write-Host "FASE A (60 s, solo cara). Encuadra la cara, buena luz, nadie más en cuadro." -ForegroundColor Yellow
$env:PHASE='face'; node latency.mjs $cam 2>&1 | Tee-Object -FilePath run8-face.log
Write-Host "`nFASE B (90 s, cara + pulso + respiración). Aleja la cámara (o usa una externa): cara Y pecho en cuadro. Tienes 20 s; mira los avisos de validación." -ForegroundColor Yellow
Read-Host "Pulsa Enter cuando estés listo para la fase B"
$env:PHASE='full'; node latency.mjs $cam 2>&1 | Tee-Object -FilePath run9-full.log
Write-Host "`nListo. Puedes cerrar esta ventana." -ForegroundColor Green
