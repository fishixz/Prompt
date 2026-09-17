#!/data/data/com.termux/files/usr/bin/bash
set -uo pipefail
cd "$(dirname "$0")"

STOP_REQUESTED=0

cleanup() {
  if command -v termux-wake-unlock >/dev/null 2>&1; then
    termux-wake-unlock >/dev/null 2>&1 || true
  fi
}

request_stop() {
  STOP_REQUESTED=1
}

trap request_stop INT TERM
trap cleanup EXIT

if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock >/dev/null 2>&1 || true
  echo '🔋 Wake lock ativado enquanto o Rocha Ticket estiver rodando.'
fi

while [ "$STOP_REQUESTED" -eq 0 ]; do
  echo '🚀 Iniciando Rocha Ticket...'
  npm start
  EXIT_CODE=$?

  if [ "$STOP_REQUESTED" -ne 0 ]; then
    break
  fi

  if [ "$EXIT_CODE" -eq 0 ]; then
    echo 'ℹ️ O bot foi encerrado normalmente.'
    break
  fi

  echo "⚠️ O bot encerrou com código $EXIT_CODE. Reiniciando em 5 segundos..."
  sleep 5

done

echo '🛑 Rocha Ticket parado.'
