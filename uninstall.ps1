param(
  [string]$InstallDir = "C:\Program Files\RLDataEngine",
  [string]$ServiceName = "RLDataEngine"
)

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Lance PowerShell en tant qu'administrateur pour désinstaller."
  exit 1
}

# stop and remove service (nssm or sc)
Write-Host "Stopping service (if running)..."
try {
  nssm stop $ServiceName 2>$null
} catch {}
try {
  nssm remove $ServiceName confirm 2>$null
} catch {
  sc.exe stop $ServiceName 2>$null
  sc.exe delete $ServiceName 2>$null
}

Write-Host "Service removed (if it existed)."

if (Test-Path $InstallDir) {
  $a = Read-Host "Supprimer le dossier d'installation $InstallDir ? (O/N)"
  if ($a -match '^[Oo]') {
    Remove-Item -Recurse -Force $InstallDir
    Write-Host "Dossier supprimé."
  } else {
    Write-Host "Dossier conservé."
  }
} else {
  Write-Host "Dossier d'installation introuvable."
}
