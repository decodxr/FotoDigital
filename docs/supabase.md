# FOTO DIGITAL — configurar Supabase e Vercel

Esta versão usa **PostgreSQL do Supabase para os dados** e **Supabase Storage, pela API S3, para os arquivos privados**. A Vercel executa o site e as APIs. O código já está adaptado; a conexão com a sua conta só passa a existir após os passos abaixo e a publicação com as variáveis corretas.

O endereço publicado no **Sites** continua usando seu banco D1 e armazenamento R2. Colocar variáveis Supabase no Sites não troca esses bindings. Para usar esta integração, publique a versão Next.js na Vercel. Os dois ambientes têm bancos, sessões e arquivos independentes.

## 1. Abrir o projeto no Supabase

1. Entre em [supabase.com/dashboard](https://supabase.com/dashboard).
2. Use um projeto dedicado à FOTO DIGITAL. Se você já criou um, confira se está ativo antes de criar outro.
3. Se estiver criando agora, escolha a região disponível mais próxima dos seus clientes e guarde a **senha do banco de dados** em um gerenciador de senhas.
4. Aguarde o projeto ficar disponível. A senha do banco é diferente da senha de login no site do Supabase e das API keys.

Se sua tentativa anterior já criou tabelas ou contém dados reais, faça backup antes de alterar o esquema. Não apague tabelas para fazer o instalador passar. Caso haja colisão de nomes sem histórico em `_migrations`, é necessário conferir o esquema anterior.

## 2. Instalar as tabelas

O caminho mais simples não exige terminal:

1. No GitHub, abra [supabase/setup.sql](../supabase/setup.sql) e copie o **arquivo inteiro**. Use a visualização Raw para não copiar elementos da página.
2. No Supabase, abra **SQL Editor → New query**.
3. Cole o SQL e execute com **Run**, usando a conexão administrativa do projeto.
4. Confira o sucesso da execução. No **Table Editor**, escolha o schema `public`.

São **29 tabelas da aplicação e a tabela `_migrations`**. Elas incluem produtos, usuários, sessões, pedidos, arquivos, cupons e configurações. O nome `public` é o nome do schema PostgreSQL; não significa que as tabelas ficaram acessíveis pela internet. O instalador habilita RLS e retira permissões de acesso direto de `anon` e `authenticated`.

O arquivo pode ser executado novamente: só aplica migrations ainda não registradas e preserva os dados existentes. Não importa dados de outro banco. O catálogo inicial é inserido pelo servidor no primeiro acesso, com preços ainda não configurados e cupom inativo.

Alternativa pelo terminal, com as variáveis preenchidas em `.env.local`:

```bash
npm ci
npm run db:migrate:postgres
```

Esse comando lê `DIRECT_URL`, quando preenchida, ou `DATABASE_URL`. Ele executa o mesmo instalador, com transação e trava para impedir execuções concorrentes. Não é executado automaticamente durante o build.

## 3. Criar o armazenamento privado

No Supabase, abra **Storage → New bucket** e configure:

| Campo | Valor |
| --- | --- |
| Nome | `foto-digital-private` |
| Public bucket | **Desativado** |
| Limite por arquivo | **26.214.400 bytes (25 MiB)** ou maior, de acordo com o limite da loja |
| MIME types permitidos | `image/jpeg`, `image/png`, `image/heic`, `application/pdf` |

Confira também o limite **global** do Storage: ele deve permitir o limite escolhido para o bucket. PDFs continuam limitados a 10 MB no aplicativo. `image/heif` é normalizado para `image/heic` no cabeçalho de envio; os bytes originais não são alterados.

Não crie políticas de leitura pública ou de upload anônimo. O servidor autoriza o dono do arquivo e fornece uma URL assinada, com validade de cinco minutos, para um caminho específico. Downloads de fotografias e thumbnails passam pela autorização do site. A vitrine comercial usa a rota própria do aplicativo para publicar somente imagens vinculadas a banners ativos.

Não é necessário criar as pastas manualmente. O aplicativo organiza os objetos por chave em `originals/`, `thumbnails/` e `storefront/`.

## 4. Obter as credenciais S3

Na configuração de **Storage → S3**, habilite a conexão pelo protocolo S3, se estiver desabilitada, e gere um par de credenciais para o servidor da FOTO DIGITAL.

Copie exatamente os quatro valores exibidos: **Endpoint, Region, Access Key ID e Secret Access Key**. O endpoint deve incluir `/storage/v1/s3`, sem o nome do bucket. Prefira o endpoint direto do Storage indicado no painel.

Exemplo de formato, sem credenciais reais:

```text
https://SEU_PROJECT_REF.storage.supabase.co/storage/v1/s3
```

As credenciais S3 são diferentes das chaves `anon`, `publishable`, `service_role` e `secret` da API Supabase. Essas API keys não substituem o Access Key ID ou o Secret Access Key.

As credenciais S3 dão acesso elevado aos buckets do projeto: mantenha-as exclusivamente no servidor. Não coloque secrets em `NEXT_PUBLIC_*`, no GitHub, em imagens do painel ou em mensagens.

O Supabase não implementa a API S3 `PutBucketCors`. Não siga instruções de configurar CORS com comandos AWS para esse provedor. O diagnóstico abaixo verifica o preflight HTTP do endpoint para a origem do site. Nunca torne o bucket público para tentar corrigir um erro de upload.

## 5. Obter a conexão PostgreSQL

No Supabase, abra **Connect** e selecione **Transaction pooler**, normalmente na porta **6543**. Copie a URI inteira para `DATABASE_URL`.

```text
postgresql://postgres.SEU_PROJECT_REF:SENHA_CODIFICADA@HOST_DO_POOLER:6543/postgres
```

Use o host real copiado do seu painel, sem inventar a região ou o número do servidor. Substitua `[YOUR-PASSWORD]` pela senha do **banco**. Se a senha tiver caracteres como `@`, `#`, `%`, `/` ou `:`, codifique a senha como um componente de URL; não codifique a URI inteira. Não deixe os colchetes na conexão.

A versão Vercel usa um pool pequeno e `prepare: false`, compatível com o Supavisor em modo Transaction. A validação TLS é obrigatória.

O pool usa uma conexão por instância e `max_pipeline: 1`. A aplicação mantém uma fila de operações em `postgres-runtime.ts`: uma consulta ou transação só começa depois que a operação anterior termina. A fila inclui a transação inteira, de BEGIN até COMMIT/ROLLBACK, impedindo consultas sobrepostas e leituras de outro pedido dentro de uma transação em andamento.

Não use `max_pipeline: 0`. No Postgres.js 3.4.9, zero impede a execução do callback interno que reserva a conexão da transação; isso provoca `Cannot set properties of undefined (setting 'onclose')` e uma segunda rejeição envolvendo `queue`. Apenas aumentar esse número não basta: a fila da aplicação é que impede o pipeline no Supavisor. Os testes com TLS e o driver real cobrem criação de conta, carrinho, pedido, commit, rollback e chamadas concorrentes.

A aplicação desativa `fetch_types` porque suas listas são armazenadas como JSON em campos de texto; não utiliza arrays nativos do PostgreSQL. Isso evita a consulta automática a `pg_type` na inicialização do driver. Uma falha nessa consulta interna pode gerar uma rejeição não tratada antes de o aplicativo receber o resultado.

Na Vercel, cada consulta tem prazo de 8 segundos, incluindo a fila do pool; transações têm prazo total de 25 segundos. Ao exceder o prazo, a aplicação descarta o pool e registra `database_operation_failed` com etapa, tabela/operação, código e duração, sem parâmetros ou credenciais. Conexões ociosas por mais de 5 segundos são renovadas antes de um novo trabalho para evitar sockets parados após a suspensão da função. Operações de escrita com resultado incerto não são repetidas automaticamente. As únicas repetições de transações continuam sendo para rollback confirmado por serialização/deadlock.

O carregamento público do catálogo tem prazo total de 12 segundos e, durante falhas, mostra o aviso de indisponibilidade já existente. Esse fallback não confirma que compras e cadastro estão funcionando. Metadata e página compartilham a leitura durante a renderização; a instalação inicial do catálogo também é compartilhada entre chamadas concorrentes da mesma instância.

Para migrations, você pode preencher `DIRECT_URL` com a URI do **Session pooler**, normalmente na porta **5432**. A conexão direta `db.<project-ref>.supabase.co:5432` pode exigir IPv6; o Session pooler é uma alternativa quando sua rede só possui IPv4.

Se houver erro de certificado, copie o certificado CA do projeto para `DATABASE_CA_CERT`, em formato PEM completo. Essa variável aceita quebras de linha reais ou `\n`. Não desative a verificação TLS.

## 6. Configurar a Vercel

1. Na Vercel, importe o repositório **`decodxr/FotoDigital`**, branch `main`, usando a raiz do projeto.
2. Escolha **Next.js** e Node **24**. O `vercel.json` já define `npm run build:vercel`; `npm run build` é o build do Sites.
3. Em **Settings → Environment Variables**, preencha a tabela abaixo para **Production**. Para Preview, prefira um projeto Supabase separado de homologação.

| Variável | O que preencher |
| --- | --- |
| `APP_URL` | URL HTTPS pública da Vercel ou seu domínio, sem barra final |
| `DATABASE_URL` | URI do Transaction pooler com a senha do banco |
| `S3_ENDPOINT` | Endpoint completo da configuração S3 do Supabase |
| `S3_BUCKET` | `foto-digital-private` |
| `S3_REGION` | Região exata exibida na configuração S3; não use `auto` |
| `S3_ACCESS_KEY_ID` | Access Key ID gerado na configuração S3 |
| `S3_SECRET_ACCESS_KEY` | Secret Access Key correspondente |
| `ADMIN_BOOTSTRAP_TOKEN` | Código aleatório gerado por você para ativar o primeiro administrador |
| `PIX_KEY` | `05998428000199`, após conferir que essa chave recebe na conta correta da empresa |
| `DIRECT_URL` | Opcional; conexão para migrations executadas pelo terminal |
| `DATABASE_CA_CERT` | Opcional; certificado CA quando exigido pelo endpoint |

Não é necessário configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ou `NEXT_PUBLIC_SUPABASE_*` nesta implementação. Se uma integração automática da Vercel criou outros nomes de variáveis, copie os valores para os nomes que a aplicação realmente utiliza.

4. Faça o deploy. Se ainda não tinha uma URL, use a URL gerada para atualizar `APP_URL` e faça **Redeploy**.
5. Sempre faça um novo deploy depois de alterar variáveis. Elas não entram em vigor em uma implantação já construída.

Os secrets de produção ficam na Vercel. Para desenvolvimento local, copie `.env.example` para `.env.local` e preencha com seu ambiente de homologação; esse arquivo é ignorado pelo Git.

```bash
npm ci
npm run db:migrate:postgres
npm run dev:vercel
```

Em desenvolvimento local, use `APP_URL=http://localhost:3000`. O comando `npm run dev` utiliza o ambiente Sites, não o Supabase.

## 7. Verificar a conexão

Em um computador com Node 22.13+ e o projeto instalado, preencha `.env.local` com as variáveis do ambiente que deseja verificar e execute:

```bash
npm run supabase:check
```

O diagnóstico verifica formato das variáveis, correspondência entre projetos, conexão PostgreSQL, migrations, RLS, permissões de acesso direto, bucket privado, limite, MIME types e preflight CORS. Não altera os dados da loja. Sem credenciais completas, encerra com erro e informa os nomes faltantes.

Para conferir também as credenciais S3 e a transferência real:

```bash
npm run supabase:check -- --write-test
```

Essa opção envia **um pequeno PNG de diagnóstico**, verifica o tamanho e os bytes baixados, confere o bloqueio do acesso sem assinatura e remove o próprio arquivo ao terminar. Não altera fotografias de clientes. Se a limpeza falhar, o comando identifica somente a chave do objeto temporário para remoção manual.

O diagnóstico não substitui testar o celular, o navegador e a compra real no seu domínio. A execução local em PostgreSQL/PGlite valida SQL e regras, mas não comprova suas credenciais, sua rede ou a configuração remota do Supabase.

## 8. Criar o primeiro administrador

Gere o código inicial no seu computador:

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

1. Salve o resultado em `ADMIN_BOOTSTRAP_TOKEN` na Vercel e faça deploy.
2. Entre no **site da FOTO DIGITAL**, abra `/minha-conta` e crie sua conta com e-mail e senha.
3. Abra `/admin`, expanda **Configurar o primeiro administrador** e informe o mesmo código.
4. Depois da ativação, remova `ADMIN_BOOTSTRAP_TOKEN` da Vercel e faça novo deploy. O banco mantém seu acesso administrativo.

**O login continua sendo o do aplicativo.** Perfis ficam em `public.users` e sessões em `public.sessions`. Eles não aparecem em **Authentication → Users** do Supabase. Criar uma pessoa nessa tela não cria acesso ao site. Não há configuração de OAuth, Redirect URLs ou Supabase Auth necessária para este fluxo. `ADMIN_EMAILS` é exclusivo da identidade verificada do Sites e não concede acesso administrativo na Vercel.

As senhas são armazenadas como hash e as sessões usam cookies HttpOnly. A recuperação automática por e-mail ainda não está implementada; o site indica o atendimento da loja para suporte. Configurar SMTP no Supabase Auth não altera esse comportamento.

## 9. Preparar a loja e testar o pedido

1. Cadastre preços reais, tamanhos, acabamentos, prazos e estoque no `/admin`.
2. Revise o cupom de primeira compra, que começa inativo, e as imagens ilustrativas.
3. Envie uma foto pelo celular, confira a miniatura, escolha o tamanho e faça um pedido de homologação com retirada.
4. Confira o pedido e baixe o arquivo original/ZIP no administrador. Compare o arquivo com o enviado.
5. Entre com outro cliente e confira que ele não acessa esse pedido ou arquivo.
6. Atualize o status do pedido e confira a linha do tempo na conta do cliente.
7. Confirme uma cobrança PIX somente após verificar o recebimento. A confirmação é manual.

Supabase não conecta pagamentos ou fretes automaticamente. Para cartão, Correios e Jadlog, siga [integrations.md](integrations.md) e preencha as credenciais dos provedores contratados. Sem cotação, a retirada local continua gratuita; não são inventados valores de frete.

## 10. Dados anteriores, retenção e backups

Trocar as variáveis não transfere clientes, pedidos, preços nem fotografias de D1/R2 ou de outro projeto Supabase. Se já houver dados reais, planeje exportação, importação na ordem dos relacionamentos e cópia dos objetos preservando suas chaves. Verifique contagens e arquivos antes de mudar o domínio; mantenha a origem disponível até a conferência. Este instalador não apaga nem copia esses dados automaticamente.

Defina a retenção no administrador. A rotina **Limpar arquivos expirados** exclui em lotes e preserva arquivos usados por pedidos/solicitações abertos. Ela não está agendada automaticamente. Garanta backup separado do banco e dos objetos; o backup do banco não equivale a uma cópia das fotografias. Monitore armazenamento, tráfego e conexões conforme o uso da loja.

## Erros comuns

| Sintoma | Confira |
| --- | --- |
| Catálogo aparece, mas login/pedido retorna indisponível | O catálogo possui fallback visível. Verifique `DATABASE_URL`, migrations e logs da Vercel; a presença da página não comprova conexão. |
| `password authentication failed` | Senha do banco, usuário completo e codificação de caracteres especiais na URI. |
| `Tenant or user not found` | Host e usuário copiados de Connect; o pooler normalmente usa `postgres.<project-ref>`. |
| Erro IPv6 ou timeout | Use o pooler compatível com IPv4 e confira se o projeto está ativo. |
| `self-signed certificate in certificate chain` | Em Database Settings → SSL Configuration, baixe o certificado CA e cole todo o PEM em `DATABASE_CA_CERT`, incluindo BEGIN/END. Salve em Production e faça Redeploy. |
| Página presa / timeout de 300 segundos | Confirme o deploy da correção de consultas limitadas. Consulte `database_operation_failed`, filtrando pelo deploy atual. |
| Primeira consulta funciona, mas várias consultas do catálogo expiram | Confira se o deploy contém a fila de operações em `postgres-runtime.ts`. Ela impede consultas sobrepostas no mesmo socket do Transaction pooler. Não remova o certificado para corrigir esse sintoma. |
| `Cannot set properties of undefined (setting 'onclose')` / erro em `queue` ao cadastrar ou abrir o carrinho | Publique a correção de transações, com `max_pipeline: 1` e a fila de operações. `max_pipeline: 0` é incompatível com a reserva de transações do driver. |
| `57014` / `canceling statement due to statement timeout` | A conexão chegou ao PostgreSQL. Confira a etapa/tabela indicada no log, consultas bloqueadas, saúde do banco e `statement_timeout`. Não desative a verificação SSL. |
| `relation ... does not exist` | Execute o instalador inteiro no banco correto. |
| `relation ... already exists` sem migration registrada | Não apague tabelas; revise o esquema de uma tentativa anterior e o histórico `_migrations`. |
| `permission denied` no backend | Use a conexão do proprietário das tabelas ou papel com BYPASSRLS, exclusivamente no servidor. |
| Aviso de RLS sem políticas | É intencional neste projeto: a API da loja é a responsável por autorizar o acesso. Não crie uma política pública para silenciar o aviso. |
| `SignatureDoesNotMatch` ou HTTP 403 no upload | Endpoint com prefixo, região correta, credenciais S3 correspondentes e data/hora do servidor. API keys não são credenciais S3. |
| Upload bloqueado por formato/tamanho | Limite global, limite do bucket e MIME types permitidos. |
| CORS | Execute o diagnóstico, confira `APP_URL`/endpoint e não torne o bucket público. |
| Usuário criado em Authentication não consegue entrar | Crie a conta pelo `/minha-conta` do site; Supabase Auth não gerencia o login desta versão. |
| Alterei uma variável, mas nada mudou | Faça Redeploy na Vercel e confira se editou Production ou Preview corretamente. |

## Referências oficiais

- [Supavisor: respostas perdidas em transações enviadas em pipeline](https://github.com/supabase/supavisor/issues/1061)
- [Postgres.js: falha na reserva de conexão ao iniciar transações](https://github.com/porsager/postgres/issues/1189)
- [Conexão PostgreSQL e poolers](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Postgres.js no Supabase](https://supabase.com/docs/guides/database/postgres-js)
- [Autenticação S3 e endpoint do Storage](https://supabase.com/docs/guides/storage/s3/authentication)
- [Compatibilidade S3, incluindo limitações de CORS](https://supabase.com/docs/guides/storage/s3/compatibility)
- [Criação de buckets e limites](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
