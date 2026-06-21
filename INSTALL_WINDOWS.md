Installation (Windows x64, service via NSSM)

Étapes :
1) Pousse le workflow .github/workflows/build-windows-exe.yml sur main.
2) Sur GitHub → Actions, lance le workflow "Build Windows executable" (ou fais un push).
3) Dans la page du workflow, télécharge l'artifact rl-data-engine-windows-x64.zip.
4) Sur la machine Windows (Admin) :
   - Télécharge rl-data-engine-windows-x64.zip
   - Place install-from-artifact.ps1 (dans le même dossier) ou récupère-le depuis le repo (scripts/install-from-artifact.ps1)
   - Exécute PowerShell en Administrateur :
     Set-ExecutionPolicy Bypass -Scope Process -Force
     .\install-from-artifact.ps1 -ArtifactZipPath "C:\chemin\vers\rl-data-engine-windows-x64.zip"
5) Vérifier :
   - Service Windows "RLDataEngine" démarré
   - Logs dans C:\Program Files\RLDataEngine\logs
   - DB : C:\Program Files\RLDataEngine\data\rl-data-engine.sqlite

Mise à jour :
- Télécharge la nouvelle version zip depuis Actions et relance install-from-artifact.ps1 (il écrasera les fichiers et redémarrera le service).
Désinstallation :
- Exécute scripts/uninstall.ps1 en Admin.
