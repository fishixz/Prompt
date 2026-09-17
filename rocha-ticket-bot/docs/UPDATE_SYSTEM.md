# RochaSystem • Sistema de Atualização

O RochaSystem foi preparado para usar um repositório público dedicado em `fishixz/RochaSystem` como fonte oficial das versões.

## Versionamento

A versão publicada fica em `version.txt` na raiz do repositório e também deve ser mantida igual ao campo `version` do `package.json`.

Exemplo:

```text
2.0.0-beta.6
```

O atualizador usa comparação SemVer, incluindo versões prerelease. Exemplos:

- `2.0.0-beta.7` é maior que `2.0.0-beta.6`;
- `2.0.0` é maior que `2.0.0-beta.99`;
- `2.1.0` é maior que `2.0.99`;
- uma versão remota igual ou inferior nunca faz downgrade automático.

## Verificação automática

Por padrão, o bot consulta publicamente:

```text
https://raw.githubusercontent.com/fishixz/RochaSystem/main/version.txt
```

Nenhum token do GitHub é necessário porque o repositório é público.

O bot faz uma primeira verificação depois de iniciar e, em seguida, verifica novamente a cada 3 horas. É possível desativar esse comportamento com:

```env
ROCHASYSTEM_AUTO_UPDATE=false
```

Também é possível trocar a fonte para testes:

```env
ROCHASYSTEM_UPDATE_REPO=fishixz/RochaSystem
ROCHASYSTEM_UPDATE_BRANCH=main
```

## Instalação de uma versão nova

Quando a versão remota for maior que a versão local, o RochaSystem:

1. valida que a instalação é um clone Git do repositório oficial;
2. recusa atualizar se houver alterações locais em arquivos controlados pelo Git;
3. executa `git fetch` da branch oficial;
4. confirma o `version.txt` recebido pelo Git;
5. salva o commit atual para rollback;
6. move a instalação para `origin/main`;
7. executa `npm install --no-audit --no-fund`;
8. executa `npm run check` na versão nova;
9. se os testes falharem, restaura automaticamente o commit anterior;
10. se tudo passar, encerra com código `75` para o watchdog reiniciar o processo.

`.env`, `data/database.json`, backups e outros arquivos de runtime não são versionados e portanto não são substituídos pelo update.

## Atualização manual

O comando `/update` é exclusivo do cargo **Dono** do RochaSystem. Ele consulta a mesma fonte pública, mostra a versão instalada e a versão publicada, instala somente se a remota for maior e reinicia o bot depois da validação.

## Publicando uma nova versão

A atualização só deve ser liberada depois que os arquivos da nova versão estiverem completos e testados. O fluxo recomendado é:

1. atualizar os arquivos do bot;
2. atualizar `package.json`;
3. atualizar `version.txt` com o mesmo número;
4. executar `npm run check`;
5. publicar tudo no mesmo commit/versão da branch `main` do repositório oficial.

Não aumente `version.txt` antes de os demais arquivos da versão estarem publicados, porque bots em produção podem detectar a versão nova imediatamente.

## Repositório antigo

Enquanto o RochaSystem estiver instalado como a subpasta `rocha-ticket-bot` de outro repositório, a instalação automática é bloqueada de propósito para não executar `git reset --hard` no repositório pai inteiro. Para usar o auto-update em produção, a instalação final deve ser um clone próprio de `fishixz/RochaSystem`.
