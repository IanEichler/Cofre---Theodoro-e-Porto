# Cofre — Theodoro & Porto

Gerenciador de senhas do escritório em português. React 19, Vinext, Cloudflare Workers e D1.

## Acesso

O login usa **e-mail e senha próprios**, seguido de **Google Authenticator obrigatório**. O aplicativo não depende de conta ChatGPT. A hospedagem precisa permitir visitantes anônimos na página de login; as APIs do cofre exigem sessão própria com o segundo fator concluído.

A primeira conta é criada por um link reservado ao responsável. O servidor valida o hash do token e sua validade antes de permitir a configuração. Depois que o escritório existe, o token não pode criar outra conta. Não existe cadastro público nem senha padrão.

Administradores criam convites por e-mail e compartilham o link individual. Cada pessoa define a senha e configura seu autenticador por QR Code ou chave manual. Convites duram sete dias e são de uso único. O aplicativo não envia e-mails automaticamente.

## Recursos

- Senhas, notas seguras e cartões; departamentos, marcadores e favoritos.
- Itens pessoais ou compartilhados com a equipe inteira.
- Administrador, editor e leitor; revogação de acesso com encerramento das sessões.
- Busca, ordenação, lista e cartões, gerador de senhas no navegador.
- Lixeira, restauração e confirmação para exclusão permanente.
- Controle de versão para evitar sobrescrever alterações de outra pessoa.
- TOTP com proteção contra repetição, limite de tentativas e códigos de recuperação de uso único.
- Alteração da própria senha com confirmação da senha atual e do segundo fator.
- Links administrativos de redefinição válidos por uma hora. O segundo fator existente é preservado.

## Segurança implementada

Senhas de login são armazenadas como hashes scrypt, com salt independente de 16 bytes e parâmetros N=32768, r=8, p=3. Uma verificação equivalente é executada para contas inexistentes. Não são armazenadas senhas de login em texto simples.

A validação da senha cria uma sessão intermediária de cinco minutos. Somente a confirmação do TOTP ou de um código de recuperação cria a sessão do cofre, de até 15 minutos. Os tokens são aleatórios e seus hashes ficam no banco; cookies são HttpOnly, SameSite=Strict e Secure em HTTPS. Redefinir senha invalida sessões anteriores por versão da credencial. Cabeçalhos de identidade da hospedagem não autorizam acesso às APIs.

Há limitação de tentativas por conta, IP e segundo fator, validação de origem nas mutações e respostas de autenticação sem cache. Tokens de convite e configuração usam fragmentos de URL, removidos da barra pelo app; seus hashes são verificados no servidor. QR Codes são gerados no navegador sem serviços externos.

Credenciais do cofre, notas e segredos TOTP são criptografados com AES-256-GCM, IV aleatório e contexto por registro. A chave fica em segredo no runtime. A criptografia ocorre no servidor; esta versão não oferece ponta a ponta ou zero knowledge. Metadados de membros, departamentos e auditoria não são criptografados.

## Executar localmente

Requisitos: Node.js 22.13 ou superior e npm. No Windows, use Node.js 24 LTS.

```sh
npm ci
npm run build
```

Crie um arquivo `.dev.vars` a partir de `.env.example`. Configure os quatro valores; **nunca envie esse arquivo ao Git**. Gere a chave do cofre e o token com `node:crypto.randomBytes`. Use 32 bytes para a chave AES, codificados em base64, e pelo menos 32 bytes para o token. COFRE_BOOTSTRAP_HASH deve ser o SHA-256 do token, em base64. COFRE_BOOTSTRAP_EXPIRES é a validade do link em milissegundos Unix.

Aplique as migrações no banco local, uma única vez e em ordem:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_true_robbie_robertson.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_chief_rattler.sql
npm run dev -- --port 5186
```

Abra `http://localhost:5186/#configurar=SEU_TOKEN` e defina a senha do administrador. O login de desenvolvimento também usa as credenciais próprias; não há identidade simulada.

## Publicação

A pasta `.openai/hosting.json` vincula esta instância à hospedagem Sites e ao banco D1 `DB`. As migrações em `drizzle/` são aplicadas no deploy. Configure os segredos do `.env.example` no runtime. Os valores reais e o link reservado de configuração não fazem parte deste repositório. Preserve a chave de criptografia em futuras publicações.

O repositório contém o código; fazer push não configura, por si só, uma implantação automática no GitHub. A instância atual é publicada pelo fluxo Sites. Para outra instância, configure seu próprio projeto, banco e segredos.

## Verificações

```sh
node node_modules/typescript/bin/tsc --noEmit
node scripts/cofre-tests.mjs
npm run build
```

Os testes unitários incluem vetores RFC 6238, criptografia autenticada, vínculo de contexto, rejeição de chave incorreta, repetição de TOTP e hash de senhas.

Os testes de integração são opcionais e recusam URLs externas. Use um banco **local de testes vazio**, e configure nele o bootstrap `admin@qa.example`, o hash de `cofre-local-qa-setup-token-2026` e validade futura. Esses valores são exclusivamente de teste e não são os da publicação. Inicie o Worker de produção local com segredos definidos em `dist/server/.dev.vars`; defina `COFRE_TEST_URL=http://127.0.0.1:8796` e execute o script de testes.

São verificados: ausência de acesso por cabeçalhos da hospedagem, configuração protegida, login, TOTP, convites de uso único, matrícula concorrente do autenticador, recuperação, CRUD, conflitos de versão, permissões, isolamento pessoal, CSRF, logout, redefinição com segundo fator preservado, invalidação de sessões antigas, alteração de senha, revogação e limitação de tentativas.
