<#
 install-from-artifact.ps1
 Usage: exécute en admin. Paramètre -ArtifactZipPath facultatif (chemin local du zip téléchargé depuis Actions).
#>

param(
  [string]$ArtifactZipPath,
  [string]$InstallDir = "C:\Program Files\RLDataEngine",
  [string]$ServiceName = "RLDataEngine"
)

function Write-Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

# require admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Err "Ce script doit être exécuté en tant qu'administrateur. Ouvre PowerShell (Admin) et relance."
  exit 1
}

if (-not $ArtifactZipPath) {
  $ArtifactZipPath = Read-Host "Chemin local vers rl-data-engine-windows-x64.zip (téléchargé depuis Actions). Entrez le chemin complet"
}

if (-not (Test-Path $ArtifactZipPath)) {
  Write-Err "Fichier zip introuvable : $ArtifactZipPath"
  exit 1
}

# prepare install dir
if (-not (Test-Path $InstallDir)) {
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# extract
Write-Host "Extraction de l'artefact dans $InstallDir..."
Expand-Archive -Path $ArtifactZipPath -DestinationPath $InstallDir -Force

# locate exe
$exe = Get-ChildItem -Path $InstallDir -Filter "*.exe" -Recurse | Select-Object -First 1
if (-not $exe) {
  Write-Err "Aucun .exe trouvé dans $InstallDir après extraction."
  exit 1
}
$exePath = $exe.FullName
Write-Ok "Found exe: $exePath"

# check nssm
function Get-NssmPath {
  $paths = @(
    "$InstallDir\nssm\nwin64\nnssm.exe",
    "$InstallDir\nssm\nnssm.exe",
    "$env:ProgramFiles\nssm\nnssm.exe",
    "$env:ProgramFiles(x86)\nssm\nnssm.exe",
    (Get-Command nssm -ErrorAction SilentlyContinue)?.Source
  )
  foreach ($p in $paths) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

$nssmPath = Get-NssmPath
if (-not $nssmPath) {
  Write-Host "nssm introuvable. Téléchargement et installation locale de nssm..."
  $tmp = Join-Path $env:TEMP "nssm.zip"
  $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
  Invoke-WebRequest -Uri $nssmUrl -OutFile $tmp
  Expand-Archive -Path $tmp -DestinationPath "$InstallDir\nssm" -Force
  # attempt find exe
  $nssmPath = Get-NssmPath
  if (-not $nssmPath) {
    Write-Warn "Impossible de trouver nssm.exe après extraction. Tu peux installer nssm manuellement et relancer."
  } else {
    Write-Ok "nssm installé localement: $nssmPath"
  }
} else {
  Write-Ok "nssm trouvé: $nssmPath"
}

# install service using nssm
if (-not $nssmPath) {
  Write-Err "nssm requis pour créer le service automatiquement. Installe nssm manuellement et relance."
  exit 1
}

# delete existing service if present
Write-Host "Suppression du service existant si présent..."
& $nssmPath remove $ServiceName confirm | Out-Null 2>$null

Write-Host "Création du service Windows via nssm..."
& $nssmPath install $ServiceName $exePath

# set working dir
& $nssmPath set $ServiceName AppDirectory $InstallDir

# optional: set stdout/stderr file under InstallDir\logs
$logDir = Join-Path $InstallDir "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
& $nssmPath set $ServiceName AppStdout (Join-Path $logDir "stdout.log")
& $nssmPath set $ServiceName AppStderr (Join-Path $logDir "stderr.log")
& $nssmPath set $ServiceName AppRotateFiles 1

# start service
Write-Host "Démarrage du service..."
& $nssmPath start $ServiceName

Start-Sleep -Seconds 2
# status
sc.exe query $ServiceName | Write-Host

Write-Ok "Installation terminée. Vérifie les logs dans $logDir et la présence de la DB dans le dossier d'installation (data/rl-data-engine.sqlite)."
