# RochaSystem

**Sistema Oficial de Bots do RochaSystem.**

Developed with ♥️ by raposomodz

O RochaSystem é o bot multifunções oficial do Rocha Roleplay. Ele reúne tickets, administração, moderação, suporte, AutoMod, níveis/XP, utilidades, pesquisa, jogos, backup e gerenciamento do próprio bot em um único projeto Node.js + discord.js v14.

Versão atual: **2.0.0-beta.6**.

## Principais módulos

- **Tickets** — painel configurável, questionário, categorias, atendimento, call, transcript, logs, avaliação e prévias.
- **Administração** — cargos, canais, limpeza de mensagens, embeds e outras ferramentas administrativas.
- **Moderação** — banimento, expulsão, timeout, advertências e histórico disciplinar.
- **Dono** — identidade do bot, nome, Bio, avatar, banner, presença e controles exclusivos.
- **Suporte** — tickets abertos, atendimentos do staff, histórico de usuários e estatísticas.
- **AutoMod** — filtro configurável de palavras/expressões.
- **Níveis** — XP por mensagens, perfil e ranking.
- **Pesquisa / Utilidades / Diversão / Jogos** — ferramentas gerais e interações.
- **Backup** — criação, listagem, exportação e restauração controlada.
- **Auto-update** — verificação pública de versão e atualização automática com rollback.

## Cargos e controle de acesso

O RochaSystem possui cinco níveis configuráveis:

- 👑 Dono
- 🛡️ Moderador
- 🎧 Suporte
- 🏙️ Cidadão
- 👤 Visitante

No `/config`, cada nível pode receber cargos do Discord e permissões por categoria ou comando individual. Cargos que não estiverem configurados não recebem acesso aos comandos internos do bot. Usuários continuam podendo interagir com os painéis públicos de ticket quando aplicável.

Comandos críticos como `/config`, alterações de identidade e `/update` permanecem exclusivos do Dono.

## Comandos principais

- `/config` — configuração privada do RochaSystem.
- `/painel` — publica/atualiza o painel de tickets.
- `/preview` — mostra prévias privadas dos painéis e mensagens.
- `/diagnostico` — verifica configuração e integridade do sistema.
- `/ajuda` — mostra somente comandos liberados para os cargos do usuário.
- `/bot` — identidade e presença do bot.
- `/dono` — ferramentas exclusivas do Dono.
- `/admin` — administração.
- `/moderacao` — moderação.
- `/suporte` — ferramentas de atendimento.
- `/automod` — automoderação.
- `/nivel` — níveis e XP.
- `/pesquisa`, `/utilidade`, `/diversao`, `/jogo` — ferramentas gerais.
- `/backup` — backups do sistema.
- `/update` — procura e instala uma versão nova manualmente; exclusivo do Dono.

## Atualização automática

A fonte oficial planejada é o repositório público:

```text
fishixz/RochaSystem
```

O arquivo `version.txt`, na raiz, contém somente o número da versão publicada. O bot consulta publicamente esse arquivo sem token do GitHub.

Depois de iniciar, ele faz uma verificação e continua verificando **a cada 3 horas**. Se a versão do GitHub for maior que a instalada, ele:

1. valida o repositório e o remote `origin`;
2. recusa sobrescrever alterações locais controladas pelo Git;
3. salva o commit atual para rollback;
4. executa `git fetch` e aplica `origin/main`;
5. executa `npm install`;
6. executa `npm run check`;
7. restaura automaticamente a versão anterior caso a validação falhe;
8. reinicia pelo watchdog apenas quando a atualização passou nos testes.

Se a versão publicada for igual ou menor, nada é alterado. Não existe downgrade automático.

A atualização pode ser desativada com:

```env
ROCHASYSTEM_AUTO_UPDATE=false
```

Para ambiente de teste, também existem:

```env
ROCHASYSTEM_UPDATE_REPO=fishixz/RochaSystem
ROCHASYSTEM_UPDATE_BRANCH=main
```

Mais detalhes em `docs/UPDATE_SYSTEM.md`.

## Arquivos preservados

O repositório não deve publicar dados de runtime ou segredos. O `.gitignore` preserva, entre outros:

- `.env`
- `node_modules/`
- `data/database.json`
- `data/backups/`
- arquivos de banco corrompidos preservados
- logs locais

Por isso uma atualização do código não deve substituir o token do Discord nem o banco do servidor.

## Instalação no Termux

Quando o repositório público dedicado estiver publicado, a instalação limpa será:

```bash
pkg update -y && pkg install -y git && rm -rf ~/RochaSystem && git clone https://github.com/fishixz/RochaSystem.git ~/RochaSystem && cd ~/RochaSystem && bash install-termux.sh
```

O instalador baixa Node.js/Git, instala dependências, executa os testes, cria a estrutura de dados, solicita o token apenas se `.env` ainda não existir e inicia o watchdog.

O `start-termux.sh` usa wake-lock quando disponível. Saídas inesperadas reiniciam o processo e o código de saída reservado `75` indica que uma atualização foi aplicada e deve ser carregada.

## Publicando uma atualização

Antes de liberar uma nova versão:

1. termine todos os arquivos da atualização;
2. atualize o campo `version` de `package.json`;
3. coloque exatamente o mesmo valor em `version.txt`;
4. execute `npm run check`;
5. só então publique a versão completa na `main`.

Nunca publique primeiro um `version.txt` maior e depois envie os demais arquivos, porque bots em produção podem detectar a nova versão imediatamente.

## Testes

```bash
npm run check
```

Esse comando executa `node --check` em todos os arquivos JavaScript e a suíte de self-tests do RochaSystem, incluindo tickets, componentes do Discord, prévias, controle de acesso, administração, moderação, módulos multifunções e comparação de versões do atualizador.

O GitHub Actions também executa essas verificações em alterações do projeto.

## Estrutura

```text
RochaSystem/
├── version.txt
├── package.json
├── install-termux.sh
├── start-termux.sh
├── docs/
├── data/
└── src/
    ├── commands/
    ├── config/
    ├── database/
    ├── handlers/
    ├── panels/
    ├── services/
    ├── system/
    ├── tests/
    └── utils/
```

## Segurança

Nunca publique o token do bot, `.env`, banco de dados real, transcripts privados ou backups de produção no repositório público.
