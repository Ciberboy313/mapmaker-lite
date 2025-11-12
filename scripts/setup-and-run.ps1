<#
.SYNOPSIS
  Setup Node (via nvm-windows), install deps (pnpm/npm) and start dev.

.USAGE
  Right-click > Run with PowerShell, or:
    pwsh -File scripts/setup-and-run.ps1

.NOTES
  - Requires internet access.
  - Non-destructive: does not change system PATH manually; uses nvm.
#>

param(
  [string]$NodeVersion = "20.17.0",
  [switch]$UseNpm
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR ] $msg" -ForegroundColor Red }

function Ensure-Nvm {
  if (Get-Command nvm -ErrorAction SilentlyContinue) { return $true }
  Write-Warn "nvm non trovato. Apri e installa: https://github.com/coreybutler/nvm-windows/releases (nvm-setup.exe)"
  Write-Warn "Dopo l'installazione, riavvia PowerShell e riesegui questo script."
  return $false
}

function Ensure-Node($version) {
  if (Get-Command node -ErrorAction SilentlyContinue) { return }
  Write-Info "Installo Node $version con nvm"
  nvm install $version | Out-Null
  nvm use $version | Out-Null
  Write-Ok "Node attivo: $(node -v)"
}

function Ensure-Pnpm {
  if ($UseNpm) { return $false }
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) { return $true }
  Write-Info "Installo pnpm globalmente"
  npm i -g pnpm | Out-Null
  if (Get-Command pnpm -ErrorAction SilentlyContinue) { return $true }
  Write-Warn "Impossibile installare pnpm, userò npm"
  return $false
}

function Install-Dependencies($usePnpm) {
  if ($usePnpm) {
    Write-Info "Eseguo pnpm install"
    pnpm install
  }
  else {
    Write-Info "Eseguo npm install"
    npm install
  }
}

function Start-Dev($usePnpm) {
  if ($usePnpm) { pnpm dev }
  else { npm run dev }
}

# --- Main ---
Write-Info "Verifico nvm"
if (-not (Ensure-Nvm)) { exit 1 }

Write-Info "Verifico Node $NodeVersion"
Ensure-Node -version $NodeVersion

$usePnpm = Ensure-Pnpm

Write-Info "Installazione dipendenze"
Install-Dependencies -usePnpm:$usePnpm
Write-Ok "Dipendenze installate"

Write-Info "Avvio ambiente di sviluppo"
Start-Dev -usePnpm:$usePnpm

