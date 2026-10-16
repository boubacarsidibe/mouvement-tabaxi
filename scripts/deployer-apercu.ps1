<#
.SYNOPSIS
  Met en ligne l'aperçu protégé de TABAXI sur Vercel et le rattache au lien fixe.

.DESCRIPTION
  À lancer depuis la racine du dépôt, sur la branche à mettre en ligne :
      .\scripts\deployer-apercu.ps1

  1. Exporte le code commité (git archive) dans un dossier temporaire, sans historique Git : Vercel ne se
     relie pas au dépôt et ne déploie rien automatiquement.
  2. Déploie sur le projet Vercel « tabaxi-apercu ».
  3. Fait pointer le lien fixe vers ce déploiement, puis vérifie qu'un visiteur anonyme est bien redirigé
     vers la connexion Vercel (aperçu protégé).

  Prérequis : CLI Vercel connectée (vercel whoami), Git, Node.
#>
param(
  [string]$Projet = 'tabaxi-apercu',
  [string]$LienFixe = 'tabaxi-prive-boubacar.vercel.app'
)

$ErrorActionPreference = 'Stop'
$racine = (git rev-parse --show-toplevel).Trim()
$dossier = Join-Path $env:LOCALAPPDATA 'tabaxi-deploiement'

if (git -C $racine status --porcelain) {
  Write-Warning 'Des changements ne sont pas commités : seul le code commité est mis en ligne.'
}

# Dossier propre à chaque fois, mais on garde le lien vers le projet Vercel (.vercel)
if (Test-Path $dossier) {
  Get-ChildItem $dossier -Force | Where-Object { $_.Name -ne '.vercel' } | Remove-Item -Recurse -Force
} else {
  New-Item -ItemType Directory -Path $dossier | Out-Null
}
$archive = Join-Path $env:TEMP 'tabaxi-export.zip'
git -C $racine archive --format=zip -o $archive HEAD
Expand-Archive $archive -DestinationPath $dossier -Force
Remove-Item $archive

Push-Location $dossier
try {
  if (-not (Test-Path '.vercel/project.json')) {
    vercel link --yes --project $Projet | Out-Null
  }
  Write-Host 'Déploiement en cours…'
  $sortie = vercel deploy --yes --non-interactive 2>&1 | Out-String
  $url = [regex]::Match($sortie, 'https://[a-z0-9-]+\.vercel\.app').Value
  if (-not $url) { throw "Déploiement échoué :`n$sortie" }

  vercel alias set $url.Replace('https://', '') $LienFixe | Out-Null
  Write-Host "Déployé : $url"
  Write-Host "Lien fixe : https://$LienFixe"

  $code = (curl.exe -s -o NUL -w '%{http_code}' "https://$LienFixe/")
  if ($code -eq '302' -or $code -eq '401') {
    Write-Host "Protection : OK (visiteur anonyme refusé, code $code)"
  } else {
    Write-Warning "ATTENTION : le lien fixe répond $code à un visiteur anonyme. Il est peut-être public ; retirez-le : vercel alias rm $LienFixe"
  }
} finally {
  Pop-Location
}
