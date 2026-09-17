#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

REPO="fishixz/RochaSystem"
HTTPS_URL="https://github.com/${REPO}.git"
SSH_URL="git@github.com:${REPO}.git"
TARGET="$HOME/RochaSystem"
TEMP="$HOME/.rochasystem-installer"

RESET='\033[0m'; BOLD='\033[1m'; GRAY='\033[90m'; WHITE='\033[97m'; YELLOW='\033[38;5;220m'; ORANGE='\033[38;5;208m'; GREEN='\033[38;5;82m'; RED='\033[38;5;203m'; CYAN='\033[38;5;45m'
[[ -t 1 ]] || { RESET=''; BOLD=''; GRAY=''; WHITE=''; YELLOW=''; ORANGE=''; GREEN=''; RED=''; CYAN=''; }

say() { printf '%b\n' "$*"; }
line() { printf '%b\n' "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }
fail() {
  say "\n${RED}${BOLD}✕ Instalação encerrada${RESET}"
  say "${WHITE}${1:-Não foi possível acessar o RochaSystem.}${RESET}"
  say "${GRAY}Entre em contato pelo Discord com @raposomodz para resolver a autorização.${RESET}"
  exit 1
}

header() {
  clear 2>/dev/null || true
  printf '\n'
  say "${ORANGE}${BOLD}        ██████╗  ██████╗  ██████╗██╗  ██╗ █████╗${RESET}"
  say "${ORANGE}${BOLD}        ██╔══██╗██╔═══██╗██╔════╝██║  ██║██╔══██╗${RESET}"
  say "${YELLOW}${BOLD}        ██████╔╝██║   ██║██║     ███████║███████║${RESET}"
  say "${YELLOW}${BOLD}        ██╔══██╗██║   ██║██║     ██╔══██║██╔══██║${RESET}"
  say "${WHITE}${BOLD}        ██║  ██║╚██████╔╝╚██████╗██║  ██║██║  ██║${RESET}"
  say "${WHITE}${BOLD}        ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝${RESET}"
  printf '\n'
  say "${WHITE}${BOLD}                 R O C H A S Y S T E M${RESET}"
  say "${GRAY}              Instalador de acesso privado${RESET}"
  printf '\n'
  line
}

cleanup_temp() { rm -rf "$TEMP" 2>/dev/null || true; }
trap cleanup_temp EXIT

header

command -v pkg >/dev/null 2>&1 || fail 'Este instalador deve ser executado no Termux.'
say "${CYAN}◆ Preparando ferramentas necessárias...${RESET}"
pkg update -y >/dev/null 2>&1 || fail 'Falha ao atualizar os repositórios do Termux.'
pkg install -y git openssh nodejs-lts >/dev/null 2>&1 || fail 'Falha ao instalar Git, SSH ou Node.js.'

if [[ -d "$TARGET/.git" ]]; then
  say "${YELLOW}⚠ Já existe uma instalação em ${TARGET}.${RESET}"
  say "${GRAY}Nenhum arquivo será apagado. O instalador apenas vai validar a autorização existente.${RESET}"
  if [[ -f "$TARGET/scripts/github-auth.sh" ]]; then
    cd "$TARGET"
    exec bash install-termux.sh
  fi
  fail 'A pasta existente não parece ser uma instalação válida do RochaSystem.'
elif [[ -e "$TARGET" ]]; then
  fail "Já existe uma pasta em ${TARGET}. Renomeie ou remova essa pasta antes de uma instalação nova."
fi

printf '\n%b\n' "${CYAN}${BOLD}◆ Autorização necessária${RESET}"
say "O RochaSystem está em um repositório privado. Você precisa ter autorização de leitura para instalar e receber atualizações."
printf '\nVocê confirma que possui autorização para usar o RochaSystem? [s/N]: '
read -r confirm
case "${confirm,,}" in s|sim|y|yes) ;; *) fail 'A instalação exige autorização prévia.' ;; esac

rm -rf "$TEMP"
mkdir -p "$TEMP"
chmod 700 "$TEMP"

make_temp_askpass() {
  cat > "$TEMP/askpass.sh" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
case "\${1:-}" in
  *sername*) cat "$TEMP/username" ;;
  *assword*) cat "$TEMP/pat" ;;
  *) exit 1 ;;
esac
EOF
  chmod 700 "$TEMP/askpass.sh"
}

install_pat_credentials() {
  mkdir -p "$TARGET/data/github-access"
  chmod 700 "$TARGET/data/github-access"
  cp "$TEMP/username" "$TARGET/data/github-access/username"
  cp "$TEMP/pat" "$TARGET/data/github-access/pat"
  chmod 600 "$TARGET/data/github-access/username" "$TARGET/data/github-access/pat"
  ROCHASYSTEM_ROOT="$TARGET" bash "$TARGET/scripts/github-auth.sh" check >/dev/null 2>&1 || return 1
}

say "\n${CYAN}${BOLD}Opção 1 • Token clássico do GitHub${RESET}"
say "${WHITE}Tutorial rápido:${RESET} GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token."
say "Marque o escopo ${YELLOW}repo${RESET}. A conta do token precisa já ter acesso ao repositório ${REPO}."
printf 'Usuário do GitHub: '
read -r gh_user
printf 'Token clássico (não será exibido): '
read -rs gh_token
printf '\n'

PAT_OK=0
if [[ -n "$gh_user" && -n "$gh_token" ]]; then
  printf '%s' "$gh_user" > "$TEMP/username"
  printf '%s' "$gh_token" > "$TEMP/pat"
  chmod 600 "$TEMP/username" "$TEMP/pat"
  unset gh_token
  make_temp_askpass
  say "${GRAY}Validando a conta e o token...${RESET}"
  if ROCHASYSTEM_ROOT="$TEMP" GIT_ASKPASS="$TEMP/askpass.sh" GIT_TERMINAL_PROMPT=0 git ls-remote "$HTTPS_URL" HEAD >/dev/null 2>&1; then
    PAT_OK=1
    say "${GREEN}✓ Acesso ao repositório privado confirmado.${RESET}"
  fi
fi

if [[ "$PAT_OK" -eq 1 ]]; then
  say "${CYAN}◆ Baixando RochaSystem...${RESET}"
  if ! ROCHASYSTEM_ROOT="$TEMP" GIT_ASKPASS="$TEMP/askpass.sh" GIT_TERMINAL_PROMPT=0 git clone --quiet "$HTTPS_URL" "$TARGET"; then
    fail 'O acesso foi validado, mas o clone do repositório falhou.'
  fi
  install_pat_credentials || fail 'O clone terminou, mas as credenciais não puderam ser configuradas para futuras atualizações.'
  cd "$TARGET"
  exec bash install-termux.sh
fi

say "\n${YELLOW}⚠ O token informado não conseguiu acessar o RochaSystem.${RESET}"
say "Isso pode acontecer quando a conta não tem acesso ao repositório, o token não possui o escopo repo ou o token está incorreto."
say "${WHITE}O instalador vai automaticamente para a segunda alternativa.${RESET}"

say "\n${CYAN}${BOLD}Opção 2 • Chave SSH somente leitura${RESET}"
SSH_KEY="$TEMP/id_ed25519"
ssh-keygen -t ed25519 -N '' -C "rochasystem-$(whoami)@termux" -f "$SSH_KEY" >/dev/null 2>&1 || fail 'Não foi possível gerar a chave SSH.'
chmod 600 "$SSH_KEY"
chmod 644 "$SSH_KEY.pub"

say "Copie a chave pública abaixo e envie para ${YELLOW}@raposomodz${RESET}."
say "Ele deve cadastrá-la no repositório oficial em ${WHITE}Settings → Deploy keys${RESET}, sem habilitar ${WHITE}Write access${RESET}."
line
cat "$SSH_KEY.pub"
line
say "${GRAY}Nunca envie o arquivo da chave privada. Somente a linha pública acima.${RESET}"
printf '\nDepois que @raposomodz confirmar que cadastrou a chave, digite OK: '
read -r ready
[[ "${ready,,}" == 'ok' ]] || fail 'A autorização SSH não foi confirmada.'

SSH_CMD="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
say "${GRAY}Testando novamente o acesso ao repositório...${RESET}"
if ! GIT_SSH_COMMAND="$SSH_CMD" git ls-remote "$SSH_URL" HEAD >/dev/null 2>&1; then
  fail 'A chave ainda não tem acesso ao repositório privado. Confira o cadastro da Deploy Key.'
fi

say "${GREEN}✓ Chave autorizada.${RESET}"
say "${CYAN}◆ Baixando RochaSystem...${RESET}"
if ! GIT_SSH_COMMAND="$SSH_CMD" git clone --quiet "$SSH_URL" "$TARGET"; then
  fail 'A chave foi reconhecida, mas o clone do repositório falhou.'
fi

mkdir -p "$TARGET/data/github-access/ssh"
chmod 700 "$TARGET/data/github-access" "$TARGET/data/github-access/ssh"
cp "$SSH_KEY" "$TARGET/data/github-access/ssh/id_ed25519"
cp "$SSH_KEY.pub" "$TARGET/data/github-access/ssh/id_ed25519.pub"
chmod 600 "$TARGET/data/github-access/ssh/id_ed25519"
chmod 644 "$TARGET/data/github-access/ssh/id_ed25519.pub"
TARGET_SSH_KEY="$TARGET/data/github-access/ssh/id_ed25519"
git -C "$TARGET" config core.sshCommand "ssh -i $TARGET_SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
git -C "$TARGET" remote set-url origin "$SSH_URL"

cd "$TARGET"
exec bash install-termux.sh
