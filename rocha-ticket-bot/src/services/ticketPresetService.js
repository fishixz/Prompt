const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder
} = require('discord.js');
const { getGuildConfig } = require('../database/store');
const { getTicketByUid } = require('./ticketService');
const { getTicketType } = require('./configService');
const { canManageTicket } = require('../utils/permissions');
const { buildVariables, renderTemplate } = require('../utils/variables');
const { colorInt, truncate } = require('../utils/discord');

const EPHEMERAL = MessageFlags.Ephemeral;
const PAGE_SIZE = 25;

function normalizeKind(actionOrKind) {
  if (actionOrKind === 'presetmod' || actionOrKind === 'moderation') return 'moderation';
  if (actionOrKind === 'presetresult' || actionOrKind === 'results') return 'results';
  return null;
}

async function context(interaction, uid) {
  const ticket = await getTicketByUid(uid);
  if (!ticket || ticket.guildId !== interaction.guildId) return { error: 'Ticket não encontrado.' };
  const config = await getGuildConfig(interaction.guildId);
  const type = getTicketType(config, ticket.typeId);
  if (!await canManageTicket(interaction, type)) return { error: 'Este controle é exclusivo para a equipe responsável.' };
  if (ticket.status !== 'open') return { error: 'Este ticket não está mais ativo.' };
  return { ticket, config, type };
}

function buildPresetPage(config, uid, kind, page = 0) {
  const presets = config.presets?.[kind] || [];
  const pages = Math.max(1, Math.ceil(presets.length / PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(Number(page) || 0, pages - 1));
  const slice = presets.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  const title = kind === 'moderation' ? '🧩 Preset de Moderação' : '⚖️ Preset de Resultados';
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(title)
    .setDescription(slice.length
      ? `Selecione o preset que será enviado no ticket. Página **${currentPage + 1}/${pages}**.`
      : 'Nenhum preset configurado para esta categoria.');

  const rows = [];
  if (slice.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ticketx:presetselect:${uid}:${kind}`)
        .setPlaceholder('Selecione o preset')
        .addOptions(slice.map(preset => ({
          label: truncate(preset.label, 100),
          value: preset.id,
          description: truncate(preset.text, 100)
        })))
    ));
  }
  if (pages > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticketx:presetpage:${uid}:${kind}:${currentPage - 1}`)
        .setLabel('Anterior')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 0),
      new ButtonBuilder()
        .setCustomId(`ticketx:presetpage:${uid}:${kind}:${currentPage + 1}`)
        .setLabel('Próxima')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= pages - 1)
    ));
  }
  return { embeds: [embed], components: rows };
}

async function handleTicketPresetInteraction(interaction) {
  const id = interaction.customId || '';

  if (id.startsWith('ticket:presetmod:') || id.startsWith('ticket:presetresult:')) {
    const parts = id.split(':');
    const kind = normalizeKind(parts[1]);
    const uid = parts[2];
    const ctx = await context(interaction, uid);
    if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, flags: EPHEMERAL });
    return interaction.reply({ ...buildPresetPage(ctx.config, uid, kind, 0), flags: EPHEMERAL });
  }

  if (id.startsWith('ticketx:presetpage:')) {
    const [, , uid, rawKind, rawPage] = id.split(':');
    const kind = normalizeKind(rawKind);
    const ctx = await context(interaction, uid);
    if (ctx.error) return interaction.update({ content: `❌ ${ctx.error}`, embeds: [], components: [] });
    return interaction.update(buildPresetPage(ctx.config, uid, kind, Number(rawPage) || 0));
  }

  if (id.startsWith('ticketx:presetselect:') && interaction.isStringSelectMenu()) {
    const [, , uid, rawKind] = id.split(':');
    const kind = normalizeKind(rawKind);
    const ctx = await context(interaction, uid);
    if (ctx.error) return interaction.update({ content: `❌ ${ctx.error}`, embeds: [], components: [] });
    const preset = (ctx.config.presets?.[kind] || []).find(item => item.id === interaction.values[0]);
    if (!preset) return interaction.update({ content: '❌ Preset não encontrado.', embeds: [], components: [] });

    const vars = buildVariables({
      guild: interaction.guild,
      ticket: ctx.ticket,
      ticketType: ctx.type,
      channel: interaction.channel,
      staff: interaction.member || interaction.user,
      config: ctx.config
    });
    await interaction.channel.send({ content: renderTemplate(preset.text, vars) });
    return interaction.update({ content: `✅ Preset **${preset.label}** enviado.`, embeds: [], components: [] });
  }

  return false;
}

function isTicketPresetId(id = '') {
  return id.startsWith('ticket:presetmod:')
    || id.startsWith('ticket:presetresult:')
    || id.startsWith('ticketx:preset');
}

module.exports = { handleTicketPresetInteraction, isTicketPresetId, buildPresetPage };
