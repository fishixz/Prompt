const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { colorInt, truncate } = require('../utils/discord');
const {
  TIER_ORDER,
  TIER_META,
  ensureSystemConfig
} = require('../services/accessControlService');
const { COMMAND_CATEGORIES, COMMAND_CATALOG } = require('../system/commandCatalog');

const PAGE_SIZE = 25;

function embedBase(config, title, description) {
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
  if (config.branding?.footer) embed.setFooter({ text: config.branding.footer });
  return embed;
}

function backRow(customId = 'config:home') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customId).setLabel('Voltar').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  );
}

function appendSystemEntry(view) {
  const clean = { ...view, components: [...(view.components || [])] };
  if (clean.components.length >= 5) return clean;
  clean.components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('systemcfg:home')
      .setLabel('RochaSystem • Cargos e Acessos')
      .setEmoji('🦊')
      .setStyle(ButtonStyle.Primary)
  ));
  return clean;
}

function systemHomePanel(config) {
  const system = ensureSystemConfig(config);
  const lines = TIER_ORDER.map(tier => {
    const meta = TIER_META[tier];
    const access = system.access[tier];
    const roles = access.roleIds.length ? access.roleIds.map(id => `<@&${id}>`).join(', ') : '`nenhum cargo configurado`';
    return `${meta.emoji} **${meta.label}:** ${roles}\n└ ${access.categories.length} categoria(s) + ${access.commands.length} comando(s) individual(is)`;
  }).join('\n\n');

  const embed = embedBase(config, '🦊 RochaSystem • Controle de Acesso', [
    'Configure quais cargos do Discord representam cada nível do RochaSystem e quais comandos cada nível pode usar.',
    '',
    lines,
    '',
    '🔐 Quem **não possuir nenhum dos cargos configurados** não poderá usar comandos do RochaSystem. Isso não impede a interação normal com painéis de ticket.',
    '👑 Comandos de identidade do bot continuam sempre exclusivos do nível **Dono**.'
  ].join('\n'));

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('systemcfg:tier:dono').setLabel('Dono').setEmoji('👑').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('systemcfg:tier:moderador').setLabel('Moderador').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('systemcfg:tier:suporte').setLabel('Suporte').setEmoji('🎧').setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('systemcfg:tier:cidadao').setLabel('Cidadão').setEmoji('🏙️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('systemcfg:tier:visitante').setLabel('Visitante').setEmoji('👤').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('systemcfg:profile').setLabel('Perfil do Bot').setEmoji('🤖').setStyle(ButtonStyle.Secondary)
      ),
      backRow('config:home')
    ]
  };
}

function tierPanel(config, tier) {
  const system = ensureSystemConfig(config);
  const meta = TIER_META[tier];
  const access = system.access[tier];
  if (!meta || !access) return null;

  const roleText = access.roleIds.length ? access.roleIds.map(id => `<@&${id}>`).join(', ') : '`nenhum`';
  const categoryText = access.categories.length
    ? access.categories.map(id => `${COMMAND_CATEGORIES[id]?.emoji || '•'} ${COMMAND_CATEGORIES[id]?.label || id}`).join(', ')
    : '`nenhuma categoria`';

  const embed = embedBase(config, `${meta.emoji} Acesso • ${meta.label}`, [
    `**Cargos vinculados:** ${roleText}`,
    `**Categorias liberadas:** ${categoryText}`,
    `**Comandos individuais extras:** ${access.commands.length}`,
    '',
    'Acesso funciona por **união**: o cargo pode usar tudo das categorias marcadas e também os comandos individuais escolhidos.',
    'Para liberar somente alguns comandos de uma categoria, deixe a categoria desmarcada e configure apenas os comandos individuais.'
  ].join('\n'));

  const roles = new RoleSelectMenuBuilder()
    .setCustomId(`systemcfg:roles:${tier}`)
    .setPlaceholder(`Cargos que serão ${meta.label}`)
    .setMinValues(0)
    .setMaxValues(10);

  const categoryOptions = Object.entries(COMMAND_CATEGORIES).map(([id, item]) => ({
    label: truncate(item.label, 100),
    value: id,
    description: truncate(item.description, 100),
    emoji: item.emoji,
    default: access.categories.includes(id)
  }));
  const categories = new StringSelectMenuBuilder()
    .setCustomId(`systemcfg:categories:${tier}`)
    .setPlaceholder('Categorias de comandos liberadas')
    .setMinValues(0)
    .setMaxValues(categoryOptions.length)
    .addOptions(categoryOptions);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(roles),
      new ActionRowBuilder().addComponents(categories),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`systemcfg:commands:${tier}:0`).setLabel('Comandos individuais').setEmoji('🎛️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`systemcfg:clear:${tier}`).setLabel('Limpar acessos extras').setEmoji('🧹').setStyle(ButtonStyle.Secondary)
      ),
      backRow('systemcfg:home')
    ]
  };
}

function commandAccessPanel(config, tier, page = 0) {
  const system = ensureSystemConfig(config);
  const meta = TIER_META[tier];
  const access = system.access[tier];
  if (!meta || !access) return null;

  const all = COMMAND_CATALOG.filter(command => !command.ownerOnly || tier === 'dono');
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = Math.max(0, Math.min(Number(page) || 0, pages - 1));
  const slice = all.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const embed = embedBase(config, `🎛️ Comandos individuais • ${meta.label}`, [
    `Página **${current + 1}/${pages}**`,
    '',
    'Marque comandos que este nível poderá usar **mesmo sem ter a categoria inteira liberada**.',
    `Atualmente existem **${access.commands.length}** liberações individuais para este nível.`
  ].join('\n'));

  const rows = [];
  if (slice.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`systemcfg:commandset:${tier}:${current}`)
        .setPlaceholder('Comandos individuais liberados nesta página')
        .setMinValues(0)
        .setMaxValues(slice.length)
        .addOptions(slice.map(command => ({
          label: truncate(command.label || command.id, 100),
          value: command.id,
          description: truncate(`/${command.slash} • ${COMMAND_CATEGORIES[command.category]?.label || command.category}`, 100),
          default: access.commands.includes(command.id)
        })))
    ));
  }

  if (pages > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`systemcfg:commands:${tier}:${current - 1}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(current <= 0),
      new ButtonBuilder().setCustomId(`systemcfg:commands:${tier}:${current + 1}`).setLabel('Próxima').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(current >= pages - 1)
    ));
  }
  rows.push(backRow(`systemcfg:tier:${tier}`));
  return { embeds: [embed], components: rows };
}

function profilePanel(config) {
  const system = ensureSystemConfig(config);
  const profile = system.identity;
  const embed = embedBase(config, '🤖 Perfil do RochaSystem', [
    `**Nome desejado:** ${profile.name}`,
    `**Status:** \`${profile.status}\``,
    `**Atividade:** ${profile.activity || '`nenhuma`'}`,
    `**Avatar salvo:** ${profile.avatarUrl ? '✅' : '—'}`,
    `**Banner salvo:** ${profile.bannerUrl ? '✅' : '—'}`,
    '',
    '**Descrição/Bio:**',
    profile.bio,
    '',
    'Alterações de identidade são feitas pelos subcomandos `/bot` e exigem o nível **Dono**.'
  ].join('\n'));

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('systemcfg:profile:refresh').setLabel('Atualizar dados').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('systemcfg:home').setLabel('Voltar').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

module.exports = {
  appendSystemEntry,
  systemHomePanel,
  tierPanel,
  commandAccessPanel,
  profilePanel
};
