#!/usr/bin/env bash
# Mesure de la mémoire pendant la suite e2e (CI) — INFORMATION seulement, aucun effet sur les tests.
#
# Écrit une ligne toutes les 30 s : heure UTC, mémoire du système (utilisée/totale) et les 5 processus qui en
# occupent le plus (taille résidente en Mo + début de la commande). Le journal du job la réaffiche à la fin ; l'heure
# permet de la rapprocher de « Server is approaching the used memory threshold, restarting… » dans le journal
# de Playwright, et de dire si la mémoire du serveur de test grimpe sans cesse (fuite) ou par à-coups.
#
#   scripts/ci-memory-sampler.sh <fichier-de-sortie> [intervalle-en-secondes]
set -u
out="${1:?fichier de sortie requis}"
interval="${2:-30}"
: > "$out"
while true; do
  system=$(free -m | awk '/^Mem:/ {print $3 "/" $2 "Mo"}')
  # La fin de la commande est la partie parlante (« … next dev --webpack -p 5185 »), le début n'est qu'un chemin.
  top=$(ps -eo rss=,args= --sort=-rss | head -5 | awk '{ r = $1 / 1024; $1 = ""; a = substr($0, 2); if (length(a) > 62) a = "…" substr(a, length(a) - 61); printf "%.0fMo[%s]  ", r, a }')
  echo "$(date -u +%H:%M:%S) système=${system} | ${top}" >> "$out"
  sleep "$interval"
done
