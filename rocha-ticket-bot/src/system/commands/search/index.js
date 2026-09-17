const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt, truncate } = require('../../../utils/discord');

function commandIdForSubcommand(subcommand) {
  return `pesquisa.${subcommand}`;
}

async function executeSearch(interaction, subcommand) {
  const config = await getGuildConfig(interaction.guildId);

  if (subcommand === 'github') {
    const username = interaction.options.getString('usuario', true).trim();
    if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) throw new Error('Nome de usuário do GitHub inválido.');
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'RochaSystem/2.0' }
    });
    if (response.status === 404) throw new Error('Usuário do GitHub não encontrado.');
    if (!response.ok) throw new Error(`GitHub respondeu HTTP ${response.status}. Tente novamente mais tarde.`);
    const data = await response.json();
    const embed = new EmbedBuilder()
      .setColor(colorInt(config.branding?.color || '#F5A300'))
      .setTitle(`🔎 GitHub • ${data.login}`)
      .setURL(data.html_url)
      .setThumbnail(data.avatar_url)
      .setDescription(truncate(data.bio || '_Sem bio pública._', 1000))
      .addFields(
        { name: 'Nome', value: data.name || '_não informado_', inline: true },
        { name: 'Repositórios', value: String(data.public_repos ?? 0), inline: true },
        { name: 'Seguidores', value: String(data.followers ?? 0), inline: true },
        { name: 'Seguindo', value: String(data.following ?? 0), inline: true },
        { name: 'Localização', value: data.location || '_não informada_', inline: true },
        { name: 'Conta criada', value: data.created_at ? `<t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:F>` : '_desconhecido_', inline: false }
      );
    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === 'cargo') {
    const role = interaction.options.getRole('cargo', true);
    const members = role.members;
    const embed = new EmbedBuilder()
      .setColor(role.color || colorInt(config.branding?.color || '#F5A300'))
      .setTitle(`🔎 Cargo • ${role.name}`)
      .addFields(
        { name: 'ID', value: `\`${role.id}\``, inline: true },
        { name: 'Posição', value: String(role.position), inline: true },
        { name: 'Membros', value: String(members.size), inline: true },
        { name: 'Cor', value: role.hexColor, inline: true },
        { name: 'Mencionável', value: role.mentionable ? 'Sim' : 'Não', inline: true },
        { name: 'Gerenciado', value: role.managed ? 'Sim' : 'Não', inline: true }
      );
    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === 'canal') {
    const channel = interaction.options.getChannel('canal', true);
    const created = Math.floor(channel.createdTimestamp / 1000);
    const embed = new EmbedBuilder()
      .setColor(colorInt(config.branding?.color || '#F5A300'))
      .setTitle(`🔎 Canal • ${channel.name || channel.id}`)
      .addFields(
        { name: 'ID', value: `\`${channel.id}\``, inline: true },
        { name: 'Tipo', value: `\`${channel.type}\``, inline: true },
        { name: 'Categoria', value: channel.parent ? `${channel.parent}` : '_nenhuma_', inline: true },
        { name: 'Criado', value: `<t:${created}:F>`, inline: false }
      );
    return interaction.editReply({ embeds: [embed] });
  }

  throw new Error(`Subcomando de pesquisa não implementado: ${subcommand}`);
}

module.exports = { commandIdForSubcommand, executeSearch };
