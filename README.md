# Cofre

Gerenciador de senhas do escritório em português, construído em React/Vinext com Cloudflare Workers e D1.

## Acesso

A identidade é fornecida pelo login do Sites/ChatGPT. O Cofre mantém uma lista própria de membros autorizados e exige TOTP compatível com o Google Authenticator. A primeira pessoa no site privado configura o escritório e se torna administradora. Pessoas convidadas precisam ter acesso à hospedagem e entrar com o e-mail autorizado.

## Recursos

- Senhas, notas seguras e cartões; cofres por departamento, marcadores e favoritos.
- Visibilidade pessoal ou compartilhada com a equipe inteira.
- Administradores, editores e leitores; revogação de acessos e sessões.
- Busca, ordenação, lista e cartões, gerador aleatório de senhas no navegador.
- Lixeira, restauração, exclusão permanente com confirmação e prevenção de conflitos de edição.
- TOTP com proteção contra repetição, limite de tentativas e dez códigos de recuperação de uso único.
- Sessão HttpOnly/SameSite de 15 minutos e histórico de atividades sem senhas.

## Armazenamento

O payload dos itens e os segredos TOTP são criptografados com AES-256-GCM, IV aleatório e contexto autenticado por registro. A chave COFRE_ENCRYPTION_KEY é configurada como segredo no Sites e nunca vai para o cliente ou repositório. Identificadores de itens, nomes dos cofres, membros e metadados de auditoria não são criptografados. A criptografia ocorre no servidor; esta versão não é ponta a ponta ou zero knowledge. Os exemplos iniciais são fictícios e vivem apenas em memória no navegador; não são carregados no banco do escritório.

## Desenvolvimento e testes

Configure COFRE_ENCRYPTION_KEY em .dev.vars para desenvolvimento. Use uma chave base64 aleatória de 32 bytes. Aplique as migrações de drizzle/ no D1 local antes de usar o banco.

- npm run dev: prévia com identidade simulada somente em loopback.
- npm run build: compilação de produção.
- node node_modules/typescript/bin/tsc --noEmit: checagem de tipos.
- node scripts/cofre-tests.mjs: vetores RFC 6238 e criptografia autenticada.
- COFRE_TEST_URL apontando para um Worker local: testes de integração com dados fictícios em banco local vazio. O teste recusa endereços externos.

Os testes de integração cobrem matrícula, segundo fator, recuperação, CRUD, favoritos, conflitos de versão, permissões, isolamento pessoal, CSRF, sessões, repetição de códigos, limite de tentativas, revogação e lixeira.
