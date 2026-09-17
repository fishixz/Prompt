#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

printf '\n🦊 RochaSystem • Instalador para Termux\n\n'

if ! command -v pkg >/dev/null 2>&1; then
  echo '❌ Este instalador foi feito para Termux.'
  exit 1
fi

pkg update -y
pkg install -y git nodejs-lts

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo '❌ Node.js 20+ é obrigatório.'
  exit 1
fi

printf '\n📦 Instalando dependências JavaScript...\n'
npm install --no-audit --no-fund
mkdir -p data data/backups
chmod +x start-termux.sh

printf '\n🧪 Validando arquivos do projeto...\n'
npm run check

if [ ! -f .env ]; then
  printf '\n'
  read -rsp '🔐 Cole o token do bot do Discord: ' DISCORD_TOKEN
  printf '\n'
  if [ -z "$DISCORD_TOKEN" ]; then
    echo '❌ Token vazio.'
    exit 1
  fi
  printf 'DISCORD_TOKEN=%s\n' "$DISCORD_TOKEN" > .env
  chmod 600 .env
else
  echo 'ℹ️ Arquivo .env já existe; token atual foi mantido.'
fi

printf '\n✅ Instalação concluída. Iniciando o RochaSystem com watchdog e auto-update...\n\n'
exec ./start-termux.sh
