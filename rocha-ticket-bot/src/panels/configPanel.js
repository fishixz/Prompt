const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder
} = require('discord.js');
const { colorInt, truncate, navButtons } = require('../utils/discord');
const { VARIABLE_DOCS } = require('../utils/variables');

function baseEmbed(config, title, description) {
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
  if (config.branding.footer) embed.setFooter({ text: config.branding.footer });
  return embed;
}

function configHome(config, validation) {
  const status = validation.ok
    ? '✅ **Configuração válida.** O `/painel` está liberado.'
    : '⚠️ **Configuração incompleta.** O `/painel` continuará abrindo esta configuração até tudo obrigatório estar pronto.';
  const missing = validation.missing.length ? `\n\n**Falta configurar:**\n${validation.missing.map(x => `• ${x}`).join('\n')}` : '';
  const warnings = validation.warnings.length ? `\n\n**Avisos:**\n${validation.warnings.map(x => `• ${x}`).join('\n')}` : '';
  const embed = baseEmbed(config, '⚙️ Configuração • Rocha Ticket', `${status}${missing}${warnings}\n\nTodas as alterações são salvas automaticamente no banco local do bot.`);

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('config:permissions').setLabel('Permissões').setEmoji('👮').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('config:panel').setLabel('Painel').setEmoji('🎨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('config:selectors').setLabel('Seletores').setEmoji('📋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('config:types').setLabel('Tipos de Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('config:questionnaire').setLabel('Questionário').setEmoji('🧠').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('config:logs').setLabel('Logs').setEmoji('📚').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('config:rating').setLabel('Avaliação').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('config:templates').setLabel('Templates').setEmoji('🧩').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('config:security').setLabel('Regras').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('config:variables').setLabel('Variáveis').setEmoji('🔤').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('config:backup').setLabel('Backup/Status').setEmoji('💾').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('config:refresh').setLabel('Atualizar').setEmoji('🔄').setStyle(ButtonStyle.Success)
    )
  ];
  return { embeds: [embed], components: rows, ephemeral: true };
}

function permissionsPanel(config) {
  const embed = baseEmbed(config, '👮 Permissões administrativas', [
    `**Cargos administradores:** ${config.permissions.adminRoleIds.length ? config.permissions.adminRoleIds.map(id => `<@&${id}>`).join(', ') : '`não definido`'}`,
    `**Usuários administradores:** ${config.permissions.adminUserIds.length ? config.permissions.adminUserIds.map(id => `<@${id}>`).join(', ') : '`nenhum`'}`,
    `**Cargos de atendimento globais:** ${config.permissions.staffRoleIds.length ? config.permissions.staffRoleIds.map(id => `<@&${id}>`).join(', ') : '`não definido`'}`,
    `**Dono do servidor sempre administra:** ${config.permissions.allowGuildOwner ? '✅ sim' : '⛔ não'}`,
    '',
    'Enquanto nenhum cargo/usuário administrador estiver definido, qualquer membro pode executar `/config`. Assim que o primeiro administrador for salvo, o painel fica restrito imediatamente.'
  ].join('\n'));

  const adminRoles = new RoleSelectMenuBuilder().setCustomId('config:set:adminroles').setPlaceholder('Selecionar cargos administradores').setMinValues(0).setMaxValues(10);
  const staffRoles = new RoleSelectMenuBuilder().setCustomId('config:set:staffroles').setPlaceholder('Selecionar cargos globais da equipe').setMinValues(0).setMaxValues(10);
  const adminUsers = new UserSelectMenuBuilder().setCustomId('config:set:adminusers').setPlaceholder('Usuários administradores extras').setMinValues(0).setMaxValues(10);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(adminRoles),
      new ActionRowBuilder().addComponents(staffRoles),
      new ActionRowBuilder().addComponents(adminUsers),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config:permissions:toggleowner')
          .setLabel(config.permissions.allowGuildOwner ? 'Dono sempre admin: ON' : 'Dono sempre admin: OFF')
          .setStyle(config.permissions.allowGuildOwner ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      navButtons('config:home')
    ],
    ephemeral: true
  };
}

function panelSettings(config) {
  const p = config.panel;
  const embed = baseEmbed(config, '🎨 Painel principal', [
    `**Canal:** ${p.channelId ? `<#${p.channelId}>` : '`não definido`'}`,
    `**Título:** ${config.branding.logoEmoji} ${config.branding.title}`,
    `**Cor:** \`${config.branding.color}\``,
    `**Banner:** ${p.bannerUrl ? 'configurado' : 'não configurado'}`,
    `**Mensagem publicada:** ${p.messageId ? `\`${p.messageId}\`` : '`ainda não publicada`'}`,
    '',
    'Você pode alterar canal, cor, título, emoji/logo, banner e descrição.'
  ].join('\n'));

  const channel = new ChannelSelectMenuBuilder()
    .setCustomId('config:set:panelchannel')
    .setPlaceholder('Canal onde o /painel será publicado')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1).setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(channel),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:modal:branding').setLabel('Editar visual/textos').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('config:modal:paneldesc').setLabel('Editar descrição').setEmoji('📝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('config:panelpreview').setLabel('Prévia').setEmoji('👁️').setStyle(ButtonStyle.Secondary)
      ),
      navButtons('config:home')
    ],
    ephemeral: true
  };
}

function selectorsPanel(config) {
  const selectors = config.panel.selectors || [];
  const visible = selectors.slice(0, 20);
  const lines = visible.length
    ? visible.map((s, i) => `${i + 1}. **${s.name}** • ID \`${s.id}\` • ${s.enabled ? '✅ ativo' : '⛔ desativado'}\n   Placeholder: ${s.placeholder}`).join('\n')
    : '_Nenhum seletor criado._';
  const more = selectors.length > visible.length ? `\n\n_+ ${selectors.length - visible.length} seletor(es) adicionais._` : '';
  const embed = baseEmbed(config, '📋 Seletores do painel', `${lines}${more}\n\nCada seletor é dividido automaticamente em menus de até 25 opções.`);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:selector:new').setLabel('Novo seletor').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('config:selector:editpick').setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('config:selector:togglepick').setLabel('Ativar/Desativar').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('config:selector:deletepick').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      ),
      navButtons('config:home')
    ],
    ephemeral: true
  };
}

function ticketTypesPanel(config, page = 0) {
  const all = config.ticketTypes || [];
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  page = Math.max(0, Math.min(page, pages - 1));
  const slice = all.slice(page * pageSize, page * pageSize + pageSize);
  const lines = slice.length ? slice.map((t, idx) => {
    const globalIndex = page * pageSize + idx + 1;
    return `${globalIndex}. ${t.emoji || '🎫'} **${t.name}** • \`${t.id}\` • ${t.enabled ? '✅' : '⛔'}\n   Categoria: ${t.parentCategoryId ? `<#${t.parentCategoryId}>` : '`não definida`'} • Seletor: \`${t.selectorId || 'nenhum'}\``;
  }).join('\n') : '_Nenhum tipo de ticket criado._';
  const embed = baseEmbed(config, `🎫 Tipos de Ticket • Página ${page + 1}/${pages}`, `${lines}\n\nCada tipo possui categoria própria, nome de canal, cargos, logs individuais e regra de questionário.`);

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('config:type:new').setLabel('Criar tipo').setEmoji('➕').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('config:type:pick').setLabel('Abrir/Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('config:type:deletepick').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    )
  ];

  // Não cria dois botões desativados com o mesmo custom_id quando existe apenas uma página.
  if (pages > 1) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`config:typespage:${page - 1}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
      new ButtonBuilder().setCustomId(`config:typespage:${page + 1}`).setLabel('Próxima').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1)
    ));
  }
  components.push(navButtons('config:home'));
  return { embeds: [embed], components, ephemeral: true };
}

function typePicker(config, action = 'open', page = 0) {
  const all = config.ticketTypes || [];
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  page = Math.max(0, Math.min(page, pages - 1));
  const options = all.slice(page * pageSize, page * pageSize + pageSize).map(t => ({
    label: truncate(t.name, 100),
    value: t.id,
    description: truncate(t.description || t.id, 100)
  }));
  const embed = baseEmbed(
    config,
    action === 'delete' ? `🗑️ Excluir tipo • ${page + 1}/${pages}` : `🎫 Escolha o tipo • ${page + 1}/${pages}`,
    options.length ? 'Selecione abaixo.' : 'Nenhum tipo criado.'
  );
  const rows = [];
  if (options.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(`config:type:${action}`).setPlaceholder('Escolha um tipo').addOptions(options)
    ));
  }
  if (pages > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`config:typepickpage:${action}:${page - 1}`).setLabel('Anterior').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
      new ButtonBuilder().setCustomId(`config:typepickpage:${action}:${page + 1}`).setLabel('Próxima').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1)
    ));
  }
  rows.push(navButtons('config:types'));
  return { embeds: [embed], components: rows, ephemeral: true };
}

function ticketTypeEditor(config, type) {
  const eventOverrides = Object.entries(type.logChannelIds || {}).filter(([, v]) => v).length;
  const embed = baseEmbed(config, `${type.emoji || '🎫'} ${type.name}`, [
    `**ID interno:** \`${type.id}\``,
    `**Descrição:** ${type.description || '_sem descrição_'}`,
    `**Ativo:** ${type.enabled ? '✅ Sim' : '⛔ Não'}`,
    `**Seletor:** \`${type.selectorId || 'não definido'}\``,
    `**Categoria Discord:** ${type.parentCategoryId ? `<#${type.parentCategoryId}>` : '`não definida`'}`,
    `**Nome do canal:** \`${type.channelNameTemplate || config.ticket.defaultNameTemplate}\``,
    `**Cargos específicos:** ${type.staffRoleIds?.length ? type.staffRoleIds.map(id => `<@&${id}>`).join(', ') : '`usa cargos globais`'}`,
    `**Questionário:** ${type.requireQuestionnaire === false ? 'não exigir' : 'exigir conforme regra global'}`,
    `**Logs específicos:** ${eventOverrides} evento(s) com destino próprio`,
    '',
    'Você pode configurar cada log deste tipo separadamente.'
  ].join('\n'));

  const categorySelect = new ChannelSelectMenuBuilder()
    .setCustomId(`config:typecat:${type.id}`)
    .setPlaceholder('Categoria onde os tickets serão criados')
    .setChannelTypes(ChannelType.GuildCategory)
    .setMinValues(1).setMaxValues(1);
  const roles = new RoleSelectMenuBuilder()
    .setCustomId(`config:typeroles:${type.id}`)
    .setPlaceholder('Cargos responsáveis específicos (opcional)')
    .setMinValues(0).setMaxValues(10);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(categorySelect),
      new ActionRowBuilder().addComponents(roles),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`config:typeedit:${type.id}`).setLabel('Nome/descrição/emoji').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`config:typechannel:${type.id}`).setLabel('Nome do canal').setEmoji('🏷️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`config:typeselector:${type.id}`).setLabel('Seletor').setEmoji('📋').setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`config:typelogs:${type.id}`).setLabel('Logs deste tipo').setEmoji('📚').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`config:typequestion:${type.id}`).setLabel('Questionário').setEmoji('🧠').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`config:typetoggle:${type.id}`).setLabel(type.enabled ? 'Desativar' : 'Ativar').setEmoji(type.enabled ? '⛔' : '✅').setStyle(type.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('config:types').setLabel('Voltar').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
      )
    ],
    ephemeral: true
  };
}

function questionnairePanel(config) {
  const q = config.questionnaire;
  const visible = (q.questions || []).slice(0, 20);
  const lines = visible.map((item, i) => `${i + 1}. **${truncate(item.text, 120)}** • ${item.kind === 'text' ? 'texto' : 'seleção'} • ${item.required ? 'obrigatória' : 'opcional'}`).join('\n') || '_Nenhuma pergunta cadastrada._';
  const more = q.questions.length > visible.length ? `\n_+ ${q.questions.length - visible.length} pergunta(s) adicionais._` : '';
  const embed = baseEmbed(config, '🧠 Questionário obrigatório', [
    `**Ativo:** ${q.enabled ? '✅' : '⛔'}`,
    `**Obrigatório antes do ticket:** ${q.requiredBeforeTicket ? '✅' : '⛔'}`,
    `**Versão atual:** \`${q.version}\``,
    `**Canal das respostas:** ${q.responseChannelId ? `<#${q.responseChannelId}>` : '`não definido`'}`,
    '',
    '**Perguntas:**',
    `${lines}${more}`,
    '',
    'Ao alterar perguntas, use **Nova versão** para obrigar quem já respondeu a responder novamente.'
  ].join('\n'));
  const channel = new ChannelSelectMenuBuilder().setCustomId('config:set:qchannel').setPlaceholder('Canal que recebe as respostas').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(channel),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:q:new').setLabel('Nova pergunta').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('config:q:manage').setLabel('Gerenciar perguntas').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('config:q:version').setLabel('Nova versão').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('config:q:texts').setLabel('Editar textos').setEmoji('📝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('config:q:toggle').setLabel(q.enabled ? 'Desativar' : 'Ativar').setStyle(q.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      ),
      navButtons('config:home')
    ],
    ephemeral: true
  };
}

function logsPanel(config) {
  const entries = Object.entries(config.logs.events || {}).map(([event, id]) => `• \`${event}\`: ${id ? `<#${id}>` : '`herda o padrão`'}`).join('\n');
  const embed = baseEmbed(config, '📚 Destinos de logs', `**Canal padrão:** ${config.logs.defaultChannelId ? `<#${config.logs.defaultChannelId}>` : '`não definido`'}\n\n${entries}\n\nVocê também pode definir estes destinos **separadamente em cada tipo de ticket**.`);
  const channel = new ChannelSelectMenuBuilder().setCustomId('config:set:defaultlog').setPlaceholder('Definir canal padrão de logs').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(channel),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:log:eventpick').setLabel('Configurar log por evento').setEmoji('🧾').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('config:logs:clear').setLabel('Limpar destinos individuais').setEmoji('🧹').setStyle(ButtonStyle.Secondary)
      ),
      navButtons('config:home')
    ],
    ephemeral: true
  };
}

function ratingPanel(config) {
  const r = config.rating;
  const embed = baseEmbed(config, '⭐ Sistema de avaliação', [
    `**Ativo:** ${r.enabled ? '✅' : '⛔'}`,
    `**Envio:** \`${r.mode}\` (dm, ticket ou both)`,
    `**Canal de log:** ${r.logChannelId ? `<#${r.logChannelId}>` : '`usa log rating/global`'}`,
    `**Escala:** 1–${r.scale || 5}`,
    `**Comentário obrigatório:** ${r.requireComment ? 'sim' : 'não'}`,
    `**Tempo para avaliar no próprio ticket:** ${r.ticketTimeoutSeconds}s`,
    '',
    `**Título:** ${r.promptTitle}`,
    `**Texto:** ${r.promptText}`
  ].join('\n'));
  const mode = new StringSelectMenuBuilder().setCustomId('config:set:ratingmode').setPlaceholder('Onde enviar a avaliação?').addOptions(
    { label: 'Privado (DM)', value: 'dm', emoji: '📩' },
    { label: 'No próprio ticket', value: 'ticket', emoji: '💬' },
    { label: 'Nos dois', value: 'both', emoji: '🔁' }
  );
  const channel = new ChannelSelectMenuBuilder().setCustomId('config:set:ratinglog').setPlaceholder('Canal de logs das avaliações').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1);
  const scale = new StringSelectMenuBuilder().setCustomId('config:set:ratingscale').setPlaceholder(`Escala atual: 1–${r.scale || 5}`).addOptions(
    { label: '3 níveis', value: '3', description: 'Avaliação de 1 a 3' },
    { label: '4 níveis', value: '4', description: 'Avaliação de 1 a 4' },
    { label: '5 níveis', value: '5', description: 'Avaliação de 1 a 5' }
  );
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(mode),
      new ActionRowBuilder().addComponents(channel),
      new ActionRowBuilder().addComponents(scale),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:modal:rating').setLabel('Editar textos/regras').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('config:rating:togglecomment').setLabel(r.requireComment ? 'Comentário opcional' : 'Exigir comentário').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('config:rating:toggle').setLabel(r.enabled ? 'Desativar' : 'Ativar').setStyle(r.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      ),
      navButtons('config:home')
    ],
    ephemeral: true
  };
}

function templatesPanel(config) {
  const options = Object.keys(config.templates).map(key => ({ label: key, value: key, description: truncate(config.templates[key], 90) })).slice(0, 25);
  const embed = baseEmbed(config, '🧩 Templates de mensagens', 'Selecione um template para editar. Todos aceitam as variáveis listadas em **Variáveis**. Os presets de moderação/resultado também podem ser editados.');
  const rows = [];
  if (options.length) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('config:template:pick').setPlaceholder('Escolha um template').addOptions(options)));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('config:presets').setLabel('Gerenciar presets').setEmoji('🧰').setStyle(ButtonStyle.Primary)
  ));
  rows.push(navButtons('config:home'));
  return { embeds: [embed], components: rows, ephemeral: true };
}

function presetsPanel(config) {
  const mod = (config.presets.moderation || []).slice(0, 15).map(p => `• **${p.label}** — \`${p.id}\``).join('\n') || '_nenhum_';
  const res = (config.presets.results || []).slice(0, 15).map(p => `• **${p.label}** — \`${p.id}\``).join('\n') || '_nenhum_';
  const embed = baseEmbed(config, '🧰 Presets administrativos', `**Moderação**\n${mod}\n\n**Resultados**\n${res}`);
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('config:preset:new:moderation').setLabel('Novo de moderação').setEmoji('➕').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('config:preset:new:results').setLabel('Novo de resultado').setEmoji('➕').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('config:preset:manage').setLabel('Editar/Excluir').setEmoji('✏️').setStyle(ButtonStyle.Primary)
    ),
    navButtons('config:templates')
  ];
  return { embeds: [embed], components: rows, ephemeral: true };
}

function securityPanel(config) {
  const s = config.security;
  const t = config.ticket;
  const embed = baseEmbed(config, '🔒 Regras e comportamento', [
    `**1 ticket por usuário:** ${t.oneOpenPerUser ? '✅' : '⛔'}`,
    `**Máximo ativo por usuário:** ${t.maxActiveTicketsPerUser}`,
    `**Impedir bots:** ${s.preventBotsOpeningTickets ? '✅' : '⛔'}`,
    `**Cooldown de abertura:** ${s.cooldownSeconds}s`,
    `**Transcript:** ${t.transcriptEnabled ? '✅' : '⛔'}`,
    `**Enviar transcript por DM:** ${t.dmTranscript ? '✅' : '⛔'}`,
    `**Apagar canal após fechar:** ${t.deleteAfterCloseSeconds}s`,
    `**Tópico do canal:** \`${truncate(t.topicTemplate, 120)}\``,
    `**Nome da call:** \`${truncate(t.callNameTemplate, 120)}\``
  ].join('\n'));
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:security:oneopen').setLabel('Alternar 1 ticket').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('config:security:transcript').setLabel('Alternar transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('config:security:dmtranscript').setLabel('Alternar DM transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('config:security:preventbots').setLabel(s.preventBotsOpeningTickets ? 'Bots: bloqueados' : 'Bots: permitidos').setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:modal:security').setLabel('Editar números').setEmoji('🔢').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('config:modal:ticketrules').setLabel('Tópico/Call').setEmoji('✏️').setStyle(ButtonStyle.Primary)
      ),
      navButtons('config:home')
    ],
    ephemeral: true
  };
}

function variablesPanel(config) {
  const text = Object.entries(VARIABLE_DOCS).map(([v, d]) => `• \`${v}\` — ${d}`).join('\n');
  const embed = baseEmbed(config, '🔤 Variáveis disponíveis', `${text}\n\nElas podem ser usadas em nomes de canais, mensagens, saudações, fechamento, avaliação e logs.`);
  return { embeds: [embed], components: [navButtons('config:home')], ephemeral: true };
}

function backupPanel(config, validation) {
  const embed = baseEmbed(config, '💾 Backup e status', [
    `**Setup:** ${validation.ok ? '✅ válido' : '⚠️ incompleto'}`,
    `**Tipos de ticket:** ${config.ticketTypes.length}`,
    `**Seletores:** ${config.panel.selectors.length}`,
    `**Perguntas:** ${config.questionnaire.questions.length}`,
    '',
    'O banco é salvo em `data/database.json` com escrita atômica. O botão abaixo gera uma cópia JSON privada para download.'
  ].join('\n'));
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:backup:download').setLabel('Baixar backup JSON').setEmoji('⬇️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('config:refresh').setLabel('Revalidar configuração').setEmoji('🔄').setStyle(ButtonStyle.Primary)
      ),
      navButtons('config:home')
    ],
    ephemeral: true
  };
}

module.exports = {
  baseEmbed,
  configHome,
  permissionsPanel,
  panelSettings,
  selectorsPanel,
  ticketTypesPanel,
  typePicker,
  ticketTypeEditor,
  questionnairePanel,
  logsPanel,
  ratingPanel,
  templatesPanel,
  presetsPanel,
  securityPanel,
  variablesPanel,
  backupPanel
};
