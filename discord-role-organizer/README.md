# Rocha Discord Role Organizer

Organizador seguro de cargos para o servidor **Rocha Roleplay - Desenvolvimento**.

- Protege `dono geral` e `︱👑`.
- Mantém `Orga` como limite máximo da automação.
- Cria ou reaproveita os separadores aprovados.
- Organiza cargos normais um por um, sem reordenação em lote.
- Não apaga cargos.
- Move duplicados e cargos não classificados para `INTERNOS`.
- Não tenta editar diretamente cargos `managed` de bots/integrações.
- Salva backup antes das mudanças e exporta `roles-organized.json` no final.

## Executar no Termux

```bash
pkg update -y && pkg install git nodejs -y && rm -rf "$HOME/Prompt" && git clone --depth 1 https://github.com/fishixz/Prompt.git "$HOME/Prompt" && cd "$HOME/Prompt/discord-role-organizer" && npm install && read -rsp 'Cole o token do bot: ' DISCORD_TOKEN && printf '\n' && DISCORD_TOKEN="$DISCORD_TOKEN" node index.js
```

Quando aparecer a confirmação, digite exatamente:

```text
ORGANIZAR
```

O token não fica salvo no código nem no repositório.
