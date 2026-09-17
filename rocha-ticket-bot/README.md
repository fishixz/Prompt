# Rocha Ticket Bot

Sistema de tickets feito do zero para o **Rocha Roleplay**, em **Node.js + discord.js v14**, sem dependências nativas de banco de dados. Foi projetado principalmente para **Termux**, mas também pode rodar em Linux/VPS.

Versão atual do projeto: **1.2.0**.

## Comandos

- `/config` — painel privado e persistente de configuração.
- `/painel` — publica ou atualiza o painel público de abertura de tickets. Só funciona quando a configuração obrigatória está válida.
- `/preview` — abre a central privada de prévias dos painéis e mensagens do sistema.
- `/diagnostico` — verifica configuração, permissões, canais, painel publicado, banco, contador, tickets órfãos, calls, backups e componentes do Discord.

## Configuração pelo Discord

O `/config` permite administrar visual, permissões, seletores, tipos de ticket, categorias, cargos responsáveis, questionário, logs, avaliação, templates, presets, regras, variáveis e backups.

Entre as opções disponíveis estão:

- cargos e usuários administradores;
- cargos globais de atendimento e cargos específicos por tipo;
- dono do servidor como administrador;
- canal, título, descrição, cor, emoji/logo e banner do painel;
- template do título do painel;
- criação, edição, ativação/desativação e exclusão de seletores;
- criação, edição, ativação/desativação e exclusão de tipos de ticket;
- categoria de criação de cada tipo;
- nome do canal por template;
- seletor em que cada tipo aparece, com paginação quando houver muitos seletores;
- questionário global, perguntas abertas ou de seleção, versão e obrigatoriedade;
- destino global de logs, destino por evento e override por tipo de ticket;
- avaliação por DM, no ticket ou nos dois;
- escala da avaliação, comentário e tempo para responder;
- mensagens/templates do sistema;
- presets de moderação e resultado;
- cooldown, limite de tickets, transcript, envio de transcript por DM e proteção contra bots;
- template do tópico e da call;
- backup JSON manual e backup local rotativo;
- sincronização manual das permissões dos tickets existentes.

Enquanto nenhum administrador estiver configurado, o comportamento padrão permite usar `/config` para fazer o primeiro setup. Depois disso, o acesso passa a respeitar as permissões configuradas. Essa regra também pode ser ajustada na área avançada.

## Central de prévias

A central pode ser aberta diretamente por `/preview` ou pelo botão **Prévia** dentro da configuração do painel. Ela é privada/efêmera e permite conferir o visual sem criar ticket real nem publicar mensagens.

É possível visualizar:

- painel público de abertura de tickets, incluindo banner e seletores;
- confirmação privada de ticket criado;
- painel completo de dentro do ticket, incluindo área do usuário e controles administrativos;
- questionário obrigatório, com navegação entre páginas sem salvar respostas;
- painel de avaliação;
- finalização do ticket e exemplo da DM enviada ao usuário;
- exemplos de logs;
- presets de moderação e resultados;
- prévia de ticket usando um tipo específico já configurado.

Nas prévias, botões de atendimento, respostas, avaliação e demais ações reais ficam desativados. Apenas a navegação segura do questionário de prévia continua ativa.

## Fluxo do usuário

1. O usuário escolhe um tipo no painel.
2. O bot valida cooldown, configuração e limite de tickets.
3. Se o questionário for obrigatório e a versão atual ainda não tiver sido respondida, ele abre o questionário privado.
4. As respostas são salvas e enviadas ao canal configurado.
5. O ticket é criado na categoria específica daquele tipo.
6. O usuário recebe a confirmação privada com link para o canal.
7. A equipe usa os controles administrativos dentro do ticket.
8. No fechamento, o bot gera transcript, registra log, tenta enviar cópia por DM e dispara a avaliação conforme a configuração.
9. O canal e a call são removidos no tempo configurado.

## Controles administrativos do ticket

- Chamar membro — também tenta enviar o link por DM.
- Adicionar membro.
- Remover membro, com proteção para dono, bot, administradores e cargos responsáveis.
- Preset de moderação, com paginação para listas grandes.
- Preset de resultados, com paginação para listas grandes.
- Mover ticket e acompanhar a call para a nova categoria.
- Trocar nome do canal.
- Adicionar observação interna.
- Criar call privada de atendimento.
- Assumir atendimento, registrando identidade do atendente.
- Saudar atendimento.
- Finalizar ticket.

Ao sair pelo botão do usuário, o comportamento do Rocha permanece: o usuário perde acesso, mas o ticket continua aberto até a equipe finalizar.

## Segurança e recuperação

O projeto possui proteções para problemas que ocorreram durante o desenvolvimento e para falhas comuns de produção:

- trava contra duas criações simultâneas do mesmo usuário;
- contador numérico não volta para IDs já utilizados;
- estado `creating` antes de criar o canal;
- recuperação de ticket preso em `closing` após reinício;
- canal apagado manualmente não deixa o usuário preso com ticket fantasma;
- tickets sem canal passam para estado `orphaned` e permanecem apenas no histórico;
- controles antigos são bloqueados ao finalizar;
- permissões da call acompanham usuário e membros adicionados/removidos;
- permissões dos cargos de staff são sincronizadas nos tickets existentes;
- sincronização periódica das permissões a cada 5 minutos;
- cooldown persistente para abertura;
- limpeza de cooldowns expirados e questionários abandonados;
- validação de limites e IDs de componentes do Discord;
- respostas privadas usam `MessageFlags.Ephemeral`.

## Banco e backups

O banco principal fica em `data/database.json` e usa escrita atômica por arquivo temporário.

O bot cria backups locais em `data/backups/` e mantém as últimas cópias configuradas pelo serviço. Por padrão, o processo automático mantém **7 backups**. Há backup na inicialização e depois a cada 24 horas.

Se `database.json` estiver corrompido, o bot:

1. preserva o arquivo corrompido com outro nome;
2. tenta recuperar um `database.json.tmp` válido;
3. tenta o backup local válido mais recente;
4. se não existir nenhuma cópia válida, interrompe em vez de zerar os dados silenciosamente.

O histórico de tickets, respostas e avaliações não é apagado automaticamente. Isso preserva auditoria; o `/diagnostico` mostra o tamanho atual do banco.

## Transcript

O transcript HTML inclui, quando disponíveis:

- mensagens em ordem cronológica;
- usuário e horário;
- marcação de mensagem editada;
- respostas/replies;
- anexos e imagens;
- conteúdo de embeds;
- campos de embeds;
- stickers e reações;
- tipo do ticket;
- usuário que abriu;
- atendente que assumiu;
- motivo do fechamento;
- quantidade de observações internas.

O exportador possui limite de segurança de até 5.000 mensagens por ticket.

## Variáveis

Entre as variáveis disponíveis estão:

`{guilda}`, `{guild_id}`, `{user_name}`, `{user_display}`, `{user_id}`, `{user_mention}`, `{ticket_id}`, `{ticket_uid}`, `{ticket_type}`, `{ticket_type_id}`, `{ticket_type_slug}`, `{ticket_name}`, `{channel_id}`, `{channel_mention}`, `{staff_name}`, `{staff_display}`, `{staff_id}`, `{staff_mention}`, `{reason}`, `{rating}`, `{rating_scale}`, `{rating_comment}`, `{created_at}`, `{closed_at}`, `{logo}`, `{panel_title}`.

Elas são usadas em templates e nomes compatíveis com o sistema. Os dados principais do usuário e do atendente também são persistidos no ticket para não depender somente do contexto da interação original.

## IDs iniciais do Rocha

- Canal do painel: `1545422212511694858`
- Canal das respostas do questionário: `1550050260586467378`
- Banner inicial: URL fornecida durante o desenvolvimento.

Esses destinos podem ser alterados pelo `/config`.

## Instalação limpa no Termux

```bash
pkg update -y && pkg install -y git && rm -rf ~/Prompt && git clone https://github.com/fishixz/Prompt.git ~/Prompt && cd ~/Prompt/rocha-ticket-bot && bash install-termux.sh
```

O instalador:

- instala Git e Node.js LTS;
- exige Node.js 20 ou superior;
- executa `npm install`;
- cria as pastas de dados/backup;
- executa `npm run check` antes de iniciar;
- pergunta o token se ainda não existir `.env`;
- inicia pelo `start-termux.sh`.

O `start-termux.sh` usa wake-lock quando o comando está disponível e possui watchdog: se o processo sair com erro, tenta reiniciar após alguns segundos. Um encerramento normal não entra em loop.

## Atualização no Termux

Se o bot estiver rodando, pare com `CTRL+C` e execute:

```bash
cd ~/Prompt && git pull && cd rocha-ticket-bot && npm install && npm run check && ./start-termux.sh
```

O `git pull` não substitui o seu `.env` nem o banco local porque arquivos de runtime estão no `.gitignore`.

## Discord Developer Portal

O bot usa os intents `Guilds`, `GuildMessages`, `DirectMessages` e `MessageContent`.

Ative **Message Content Intent** para que o transcript consiga ler o texto das mensagens. O bot também precisa de permissões como visualizar/enviar mensagens, incorporar links, anexar arquivos, ler histórico, gerenciar canais e gerenciar permissões dos canais.

## Testes automatizados

`npm run check` executa:

1. `node --check` em todos os arquivos JavaScript;
2. o self-test principal;
3. o self-test específico da central de prévias.

Os testes validam, entre outros pontos:

- limite de ActionRows/componentes;
- `custom_id` duplicado;
- limite de opções em select menus;
- tamanho de `custom_id`;
- telas principais do `/config`;
- painel público;
- paginação de tipos;
- paginação de seletores;
- paginação de presets;
- questionário;
- avaliação;
- payloads de abertura de ticket;
- central de prévias e seus painéis;
- segurança dos componentes desativados nas prévias;
- variáveis e nomes de canais.

O repositório possui GitHub Actions para executar essas verificações a cada alteração no projeto.

## Estrutura principal

```text
rocha-ticket-bot/
├── install-termux.sh
├── start-termux.sh
├── package.json
├── data/
└── src/
    ├── commands/
    ├── config/
    ├── database/
    ├── handlers/
    ├── panels/
    ├── services/
    ├── tests/
    └── utils/
```

## Limites conhecidos

- O self-test e o CI não substituem um teste real de todas as interações dentro de um servidor Discord.
- O histórico do banco é preservado em vez de ser automaticamente descartado.
- O fluxo do Rocha mantém o ticket aberto quando o usuário usa a opção de sair/cancelar; essa é uma regra do fluxo atual, não um modo alternativo de fechamento pelo usuário.

Nunca publique o token do bot ou o arquivo `.env`.
