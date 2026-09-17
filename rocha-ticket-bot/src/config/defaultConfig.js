const DEFAULT_BANNER = 'https://cdn.discordapp.com/attachments/1549985628790460436/1550037285624619070/20260917_035221_0000.png?ex=6aace037&is=6aab8eb7&hm=bc3b4ad7ca7645c1723ef757e3a8abbeaae01f1fa598345824741b9a8be8a3ed&';

function defaultGuildConfig(guildId) {
  return {
    version: 1,
    guildId,
    setupComplete: false,
    createdAt: new Date().toISOString(),
    permissions: {
      adminRoleIds: [],
      adminUserIds: [],
      staffRoleIds: [],
      allowGuildOwner: true
    },
    branding: {
      color: '#F5A300',
      logoEmoji: ':rocha:',
      title: 'Ticket | Rocha Roleplay',
      footer: 'Rocha Roleplay • Sistema de Atendimento'
    },
    panel: {
      channelId: '1545422212511694858',
      messageId: null,
      titleTemplate: '{logo} {panel_title}',
      description: [
        '👑 **Bem-vindo(a) ao atendimento do Rocha Roleplay!**',
        '',
        '🟡 Abra o ticket na **categoria correta**.',
        '🟡 Explique seu problema com **clareza e detalhes**.',
        '🟡 Evite marcar membros da equipe sem necessidade.',
        '🟡 Aguarde o atendimento da equipe responsável.',
        '',
        '🔥 **Selecione abaixo a opção do seu atendimento.**'
      ].join('\n'),
      bannerUrl: DEFAULT_BANNER,
      selectors: [
        {
          id: 'principal',
          name: 'Atendimento',
          placeholder: 'Clique aqui para selecionar...',
          enabled: true
        }
      ]
    },
    ticket: {
      counterStart: 1,
      oneOpenPerUser: true,
      defaultNameTemplate: 'ticket-{ticket_type_slug}-{ticket_id}',
      topicTemplate: 'Ticket #{ticket_id} • {ticket_type} • {user_name} ({user_id})',
      dmTranscript: true,
      transcriptEnabled: true,
      deleteAfterCloseSeconds: 3,
      userExitKeepsOpen: true,
      maxActiveTicketsPerUser: 1,
      callNameTemplate: '🔊 atendimento-{ticket_id}'
    },
    questionnaire: {
      enabled: true,
      requiredBeforeTicket: true,
      version: 1,
      responseChannelId: '1550050260586467378',
      title: '📊 Questionário obrigatório',
      intro: 'Antes de abrir seu primeiro ticket, responda o questionário abaixo. Suas respostas ficam salvas para os próximos atendimentos.',
      questions: []
    },
    rating: {
      enabled: true,
      mode: 'dm',
      logChannelId: null,
      scale: 5,
      requireComment: false,
      ticketTimeoutSeconds: 300,
      promptTitle: '⭐ Avalie seu atendimento',
      promptText: 'Como você avalia o atendimento do ticket **#{ticket_id}**? Escolha de 1 a 5 estrelas.',
      thanksText: 'Obrigado pela sua avaliação! 💛'
    },
    logs: {
      defaultChannelId: null,
      events: {
        ticket_open: null,
        ticket_claim: null,
        ticket_user_exit: null,
        member_add: null,
        member_remove: null,
        ticket_move: null,
        ticket_rename: null,
        internal_note: null,
        call_create: null,
        greet: null,
        ticket_close: null,
        rating: null,
        questionnaire: '1550050260586467378'
      }
    },
    templates: {
      createdSuccessTitle: '✅ Ticket de Atendimento Criado com Sucesso!',
      createdSuccessBody: '➡ **Canal criado:** {channel_mention}\n➡ **Categoria:** `{ticket_type}`',
      ticketOpenTitle: 'Ticket Criado com Sucesso! 📌',
      ticketOpenBody: [
        '**Todos os responsáveis pelo ticket já estão cientes da abertura.**',
        '',
        '{user_mention}, evite chamar alguém via DM. Aguarde um responsável atender você.',
        '',
        '**Categoria Escolhida:**',
        '`{ticket_type}`',
        '',
        'Lembrando que os botões administrativos são exclusivos para a equipe responsável.',
        '',
        '`DESCREVA O MOTIVO DO CONTATO COM O MÁXIMO DE DETALHES POSSÍVEIS. UM RESPONSÁVEL IRÁ LHE ATENDER.`'
      ].join('\n'),
      userNotice: '⚠️ **Mantenha sua DM aberta** para receber uma cópia deste ticket e a opção de avaliar seu atendimento.',
      greetText: '👋 Olá {user_mention}! Eu sou {staff_mention} e vou cuidar do seu atendimento. Como posso ajudar?',
      closeDmText: '✅ Seu ticket **#{ticket_id}** foi finalizado. Motivo: **{reason}**.',
      closeLogTitle: '🔒 Ticket finalizado',
      claimText: '😉 {staff_mention} assumiu o atendimento deste ticket.',
      userExitText: '🚪 {user_mention} saiu do ticket. O canal continuará aberto até a equipe finalizar.'
    },
    presets: {
      moderation: [
        { id: 'orientacao', label: 'Orientação', text: '📘 **Resultado da moderação:** orientação aplicada.' },
        { id: 'advertencia', label: 'Advertência', text: '⚠️ **Resultado da moderação:** advertência aplicada.' }
      ],
      results: [
        { id: 'resolvido', label: 'Resolvido', text: '✅ **Resultado:** atendimento resolvido.' },
        { id: 'encaminhado', label: 'Encaminhado', text: '📨 **Resultado:** atendimento encaminhado ao setor responsável.' }
      ]
    },
    security: {
      allowConfigBeforeSetupForEveryone: true,
      preventBotsOpeningTickets: true,
      cooldownSeconds: 5
    },
    ticketTypes: []
  };
}

module.exports = { defaultGuildConfig, DEFAULT_BANNER };
