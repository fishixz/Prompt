# Rocha Ticket Bot

Sistema de tickets feito do zero para o **Rocha Roleplay**, em **Node.js + discord.js**, sem dependências nativas de banco de dados. Foi projetado para rodar no **Termux** e também em Linux/VPS.

## O que já está implementado

- `/config` privado/efêmero e persistente.
- Enquanto a configuração inicial não estiver válida, qualquer membro pode abrir `/config`, conforme o requisito do projeto.
- Depois que cargos/usuários administrativos forem configurados e o setup estiver válido, o painel de configuração fica restrito aos autorizados.
- `/painel` só publica quando todos os requisitos obrigatórios estão válidos. Caso contrário, ele abre a mesma configuração privada e mostra o que falta.
- Painel visual Rocha Roleplay, cor amarelo/laranja, banner configurável, título/logo/descrição configuráveis.
- Vários seletores e tipos de tickets criados/editados/excluídos pelo Discord.
- Cada tipo de ticket possui categoria de criação, nome de canal por template, cargos responsáveis, seletor, regra de questionário e logs próprios por evento.
- Questionário obrigatório salvo por usuário e por versão; perguntas de seleção e texto aberto; respostas enviadas para canal configurável.
- Fluxo completo do ticket: assumir, chamar/adicionar/remover membro, presets, mover, renomear, observação interna, criar call, saudar, usuário sair e finalizar.
- Transcript HTML.
- Avaliação 1–5 estrelas por DM, no ticket ou nos dois; canal de log configurável; comentário opcional ou obrigatório.
- Banco JSON com escrita atômica em `data/database.json`.
- Backup JSON baixável diretamente pelo `/config`.
- Variáveis em templates e nomes de canais.

## Variáveis principais

`{guilda}`, `{guild_id}`, `{user_name}`, `{user_display}`, `{user_id}`, `{user_mention}`, `{ticket_id}`, `{ticket_uid}`, `{ticket_type}`, `{ticket_type_id}`, `{ticket_type_slug}`, `{ticket_name}`, `{channel_id}`, `{channel_mention}`, `{staff_name}`, `{staff_id}`, `{staff_mention}`, `{reason}`, `{rating}`, `{rating_comment}`, `{created_at}`, `{closed_at}`, `{logo}`, `{panel_title}`.

## IDs Rocha já colocados como padrão

- Canal do painel: `1545422212511694858`
- Canal das respostas do questionário: `1550050260586467378`
- Banner inicial: o URL fornecido durante o desenvolvimento.

Todos podem ser alterados pelo `/config`.

## Instalação no Termux

Como este projeto está publicado dentro do repositório `fishixz/Prompt`, use:

```bash
pkg update -y && pkg install -y git && rm -rf ~/Prompt && git clone https://github.com/fishixz/Prompt.git ~/Prompt && cd ~/Prompt/rocha-ticket-bot && bash install-termux.sh
```

O instalador atualiza os pacotes, instala `git` e `nodejs-lts`, instala as dependências do projeto e **por último pergunta o token do bot**. O token fica somente no arquivo local `.env`, que está no `.gitignore`.

## Configuração no Discord Developer Portal

O bot usa os intents `Guilds`, `GuildMessages`, `DirectMessages` e `MessageContent`. Para o transcript conter o texto das mensagens, ative **Message Content Intent** na página do bot no Developer Portal.

Dê ao bot permissões suficientes para: visualizar/enviar mensagens, incorporar links, anexar arquivos, ler histórico, gerenciar canais e gerenciar permissões dos canais. Para simplificar a instalação inicial em um servidor próprio, `Administrador` também funciona, mas não é obrigatório se você conceder as permissões necessárias individualmente.

## Primeiro uso

1. Inicie o bot.
2. No servidor, execute `/config`.
3. Defina primeiro os cargos/usuários administradores e os cargos globais de atendimento.
4. Configure o canal do painel.
5. Crie/edite os seletores.
6. Crie pelo menos um tipo de ticket e defina sua categoria do Discord.
7. Configure o questionário ou desative sua obrigatoriedade.
8. Configure logs e avaliação.
9. Quando o painel mostrar configuração válida, execute `/painel`.

## Estrutura

```text
src/
├── commands/
│   └── registerCommands.js
├── config/
│   └── defaultConfig.js
├── database/
│   └── store.js
├── handlers/
│   ├── configHandlers.js
│   ├── interactionCreate.js
│   ├── questionnaireHandlers.js
│   ├── ratingHandlers.js
│   └── ticketHandlers.js
├── panels/
│   ├── configPanel.js
│   └── ticketPanel.js
├── services/
│   ├── configService.js
│   ├── logService.js
│   ├── questionnaireService.js
│   ├── ratingService.js
│   └── ticketService.js
└── utils/
    ├── discord.js
    ├── ids.js
    ├── permissions.js
    ├── transcript.js
    └── variables.js
```

## Observações

- O bot registra os slash commands diretamente em cada servidor em que ele está, então `/config` e `/painel` aparecem rapidamente após iniciar.
- Se um canal/categoria essencial for apagado, a validação bloqueia novamente o `/painel` até a configuração ser corrigida.
- Nunca envie ou publique o arquivo `.env`.
