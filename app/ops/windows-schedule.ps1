<#
Souq Auto — planification des sauvegardes et de la supervision sous Windows (Planificateur de tâches).

Par défaut, N'INSTALLE RIEN : affiche les trois tâches qui seraient créées.
  .\ops\windows-schedule.ps1            aperçu
  .\ops\windows-schedule.ps1 -Apply     crée (ou remplace) les tâches
  .\ops\windows-schedule.ps1 -Remove    supprime les tâches

Les tâches s'exécutent sous le compte qui lance ce script, seulement lorsqu'il est connecté. Sur un serveur, créer plutôt
les tâches avec un compte de service (option « Exécuter même si l'utilisateur n'est pas connecté » du Planificateur).
Le script a été vérifié en aperçu ; la création réelle des tâches n'a PAS été essayée sur cette machine.
#>
param(
  [switch]$Apply,
  [switch]$Remove,
  [string]$AppDir = (Split-Path -Parent $PSScriptRoot)
)

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$tasks = @(
  # Nom, commande npm, déclencheur
  @{ Name = 'SouqAuto-Sauvegarde'; Script = 'db:backup -- --with-uploads'; Log = 'backup.log'
     Trigger = { New-ScheduledTaskTrigger -Daily -At '02:15' } },
  @{ Name = 'SouqAuto-Veilleur'; Script = 'ops:check -- --notify'; Log = 'ops-check.log'
     Trigger = { New-ScheduledTaskTrigger -Once -At '00:05' -RepetitionInterval (New-TimeSpan -Hours 1) } },
  @{ Name = 'SouqAuto-TestRestauration'; Script = 'db:restore-check'; Log = 'restore-check.log'
     Trigger = { New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '03:30' } }
)

foreach ($t in $tasks) {
  $command = "cd /d `"$AppDir`" && `"$npm`" run $($t.Script) >> backups\$($t.Log) 2>&1"
  if ($Remove) {
    Unregister-ScheduledTask -TaskName $t.Name -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Supprimée (si elle existait) : $($t.Name)"
    continue
  }
  Write-Host "$($t.Name)"
  Write-Host "    cmd.exe /c $command"
  if ($Apply) {
    $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $command" -WorkingDirectory $AppDir
    Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger (& $t.Trigger) -Force | Out-Null
    Write-Host '    -> créée'
  }
}
if (-not $Apply -and -not $Remove) { Write-Host "`nAperçu seulement. Ajouter -Apply pour créer les tâches." }
