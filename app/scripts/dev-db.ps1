# Serveur PostgreSQL de développement dédié au projet (Lot 109) : dossier de données
# et port propres, indépendants d'une éventuelle installation PostgreSQL du poste
# (aucun droit administrateur, aucun mot de passe « postgres » nécessaires).
#
# Usage :  powershell -File scripts/dev-db.ps1 start | stop | status
#
# Création initiale (une seule fois) : voir README.md, section « Sans accès administrateur
# à PostgreSQL ».
param(
  [Parameter(Mandatory = $true)][ValidateSet("start", "stop", "status")][string]$Action,
  [string]$DataDir = (Join-Path $env:USERPROFILE "souq-auto-pgdata"),
  [int]$Port = 5433
)

$ErrorActionPreference = "Stop"

$pgCtl = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_ctl.exe" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgCtl) { throw "pg_ctl.exe introuvable dans C:\Program Files\PostgreSQL\*\bin" }
if (-not (Test-Path (Join-Path $DataDir "PG_VERSION"))) {
  throw "Aucun cluster PostgreSQL dans $DataDir. Créez-le d'abord (cf. README.md)."
}

function Invoke-PgCtl([string[]]$PgArgs) {
  Start-Process -FilePath $pgCtl.FullName -ArgumentList $PgArgs -Wait -NoNewWindow
}

switch ($Action) {
  "start" {
    # Sans -Wait : PowerShell attendrait aussi le serveur lui-même (un processus fils
    # qui ne se termine jamais). On lance en arrière-plan, puis on attend qu'il réponde.
    $log = Join-Path $DataDir "server.log"
    Start-Process -FilePath $pgCtl.FullName -WindowStyle Hidden -ArgumentList @(
      "-D", "`"$DataDir`"", "-o", "`"-p $Port -c listen_addresses=localhost`"", "-l", "`"$log`"", "start")
    $pgIsReady = Join-Path $pgCtl.DirectoryName "pg_isready.exe"
    for ($i = 0; $i -lt 30; $i++) {
      & $pgIsReady -h localhost -p $Port -q
      if ($LASTEXITCODE -eq 0) { "PostgreSQL prêt sur le port $Port"; return }
      Start-Sleep -Seconds 1
    }
    throw "Le serveur ne répond pas après 30 s : consultez $log"
  }
  "stop" { Invoke-PgCtl @("-D", "`"$DataDir`"", "-m", "fast", "-w", "stop") }
  "status" { Invoke-PgCtl @("-D", "`"$DataDir`"", "status") }
}
