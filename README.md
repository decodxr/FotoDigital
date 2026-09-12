# FOTO DIGITAL

E-commerce para **Matsumi & Matsumi Ltda.**, Campo Mourão – PR. Desde 2003 eternizando momentos.

O projeto reúne loja, revelação de fotos, documentos, personalizados, área do cliente e administração com persistência. Não há preços comerciais, fretes estimados nem avaliações inventadas no seed. Produtos sem preço ficam sob consulta; o servidor bloqueia a compra até a configuração do valor.

## Arquitetura

- React 19, TypeScript estrito, Next.js 16, Tailwind CSS 4, controles acessíveis Radix e Lucide.
- Componentes por domínio em `components/store`. Editor e áreas secundárias são carregados separadamente.
- APIs em `app/api/[...path]`, regras e autorização em `lib/server`, cálculos compartilhados em `lib/shared`.
- Sites: build Vinext, Cloudflare Worker, banco D1 e bucket R2 privados provisionados pelos bindings `DB` e `BUCKET`.
- Vercel: build Next.js nativo, PostgreSQL do Supabase via Supavisor e Supabase Storage pela API S3 privada. Consultas parametrizadas, pool limitado, TLS verificado e URLs de upload assinadas. Sem armazenamento permanente no filesystem. AWS S3/R2 continuam compatíveis com o adapter de objetos.
- Modelagem Drizzle com 29 tabelas, migrations SQL D1 e versão PostgreSQL. Não utiliza Prisma: os adapters evitam acoplar a aplicação a um engine incompatível com a hospedagem Sites. PostgreSQL preserva as mesmas entidades e regras.
- Variantes, campos configuráveis, endereços e snapshots são documentos JSON tipados/validados, sem blobs de imagens no banco. `users` reúne identidade e perfil do cliente; `uploads`/`photoConfigurations` representam arquivos e instruções de impressão.

## Identidade e movimento

O visual utiliza superfícies brancas e cinza, controles em carvão, a abertura colorida da marca e tipografia DM Sans hospedada no próprio site. A home combina fotografias, categorias visuais e conteúdo editorial. O padrão segue no catálogo, upload, checkout, conta e administração. Animações usam CSS e IntersectionObserver, sem dependência adicional; respeitam `prefers-reduced-motion`, mantêm o conteúdo disponível sem JavaScript e revelam elementos quando recebem foco pelo teclado.

## Funcionalidades

Catálogo, busca com sugestões, filtros, paginação da apresentação, favoritos locais e autenticados; carrinho persistente com edição e duplicação; checkout com cálculo financeiro no servidor, cupons, retirada gratuita e cotações persistidas com expiração; PIX copia e cola com desconto de 5% e confirmação **manual**; checkout de cartão hospedado quando conectado; pedidos, histórico e repetição com revalidação de preço, estoque e arquivos.

Upload múltiplo com duas transferências simultâneas, progresso, reenvio, consentimento, JPG/PNG/HEIC e PDFs para documentos. Os bytes originais permanecem separados das miniaturas JPEG. Editor com toque, posição, zoom, giro, preenchimento ou bordas, avisos de DPI e configurações individuais/em lote. HEIC é preservado mesmo quando o navegador não fornece prévia; o usuário recebe aviso de resolução não identificada.

Administração protegida: dashboard, produtos, variantes, estoque, campos, tamanhos, descontos por quantidade, pedidos, clientes, categorias, cupons, avaliações, serviços, banners, solicitações, configurações e auditoria. Download individual e ZIP sem recompressão, com arquivo de instruções. Alterações de status respeitam uma máquina de estados e concorrência; pagamento só pode ser aprovado pela administração ou por webhook autenticado.

## Instalação e desenvolvimento

Requer Node **22.13+** (Node 24 recomendado) e npm. O lockfile deve permanecer versionado.

```bash
npm ci
cp .env.example .env.local
npm run db:migrate:local
npm run dev
```

`db:migrate:local` aplica as migrations em `.local/foto-digital.sqlite` e verifica relacionamentos. É a base para validação local, separada do banco D1 usado pelo emulador Vinext. Para desenvolvimento com D1, aplique os mesmos SQLs ao binding `DB` do Wrangler; a publicação Sites empacota `drizzle/` e aplica as migrations à base hospedada. Não use a base de validação como banco de produção.

O seed é idempotente e executado no primeiro acesso ao catálogo. O registro `settings/store` marca a inicialização; alterações administrativas não são sobrescritas. Para acrescentar novos dados a uma loja existente, crie uma migration/rotina explícita ou utilize o painel.

Para desenvolver com Supabase, siga [o guia completo de configuração](docs/supabase.md), configure `.env.local`, aplique o SQL e execute `npm run dev:vercel`. Esse é o comando Next.js que usa o Supabase; `npm run dev` continua reservado ao Sites.

## Supabase

Veja [docs/supabase.md](docs/supabase.md) para todos os passos, variáveis, diagnóstico e solução de erros. O instalador completo está em [supabase/setup.sql](supabase/setup.sql). A autenticação permanece no aplicativo: usuários e sessões ficam no PostgreSQL, sem dependência de Supabase Auth.

## Primeiro administrador

1. Gere um segredo: `node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"`.
2. Configure-o em `ADMIN_BOOTSTRAP_TOKEN` no provedor, como secret, e publique a configuração.
3. Entre/crie uma conta, abra `/admin`, expanda **Configurar o primeiro administrador** e informe o código.
4. O servidor permite a primeira promoção uma única vez. Remova o segredo do ambiente após o uso e faça novo deploy para aplicar.

No Sites, a identidade verificada da plataforma pode ser usada. `ADMIN_EMAILS` só funciona com os headers confiáveis do Sites e nunca com headers enviados ao build Vercel. E-mail e senha do aplicativo usam hash PBKDF2 SHA-256 com salt, sessões opacas expiráveis em cookies HttpOnly/SameSite/Secure e limites de tentativas. A conta pública não tem envio de e-mail de recuperação: o canal de suporte é exibido; implemente um provedor de e-mail e tokens de recuperação antes de oferecer autoatendimento de senha esquecida.

## Operação inicial

- Em **Revelações**, cadastre preços reais por tamanho e faixas de quantidade. Os tamanhos especiais `3x4`, `polaroid` e `polaroid-ima` possuem preços independentes.
- Em **Produtos**, revise descrições, imagens ilustrativas, campos, variantes, prazos e estoque. Preço vazio significa sob consulta; estoque vazio significa sem limitação cadastrada; prazo zero significa a confirmar.
- Em **Configurações**, defina preços por página, frente e verso, fotos por cartela, retenção e limites. O preço dos documentos é por página impressa, mesmo frente e verso.
- Revise o cupom `PRIMEIRACOMPRA`, inicialmente inativo e sem desconto, antes de ativá-lo.
- Informe peso em gramas e medidas em centímetros para todos os itens enviados. Consulte o contrato do adapter para compor embalagens e quantidades.
- Confira o recebimento bancário antes de marcar PIX como aprovado. O código não consulta banco nem faz conciliação automática.
- Confirme arquivos, produza, atualize o status e informe rastreio para envios. As instruções do ZIP incluem crop, tamanho, acabamento, quantidade e personalização; a aplicação não altera os originais para gerar a arte final da impressora.
- Cancele pedidos pendentes abandonados para devolver estoque. Reembolsos, estornos e emissão fiscal são operações externas e não são disparados automaticamente.

## Banco e migrations

`db/schema.ts` contém relações e índices. Valores monetários são inteiros em centavos. Pedidos guardam snapshots; alteração de produto não altera um pedido antigo. Estoque e cupons usam transações e constraints contra valores negativos, além de chaves de idempotência.

```bash
npm run db:generate
npm run db:migrate:local
# Com DATABASE_URL (ou DIRECT_URL) em .env.local:
npm run db:migrate:postgres
# Gerar o instalador para copiar no SQL Editor do Supabase:
npm run supabase:sql
# Verificar a conexão configurada sem alterar dados:
npm run supabase:check
```

Não regenere/substitua migrations já aplicadas. O SQL inicial PostgreSQL é consolidado e ordena as chaves estrangeiras; alterações futuras nas entidades exigem migrations incrementais para **ambos** os bancos. A migration PostgreSQL de RLS é exclusiva desse provedor. `migrate-postgres.mjs` aplica migrations pendentes numa transação com trava, sem dividir blocos SQL por ponto e vírgula. `supabase/setup.sql` é gerado dos mesmos arquivos e pode ser reexecutado. O utilitário antigo `generate-postgres.mjs` foi usado somente na criação inicial: não o execute sobre o histórico aplicado. Este projeto não recebeu credenciais Supabase; a execução remota depende da sua configuração.

## Arquivos, privacidade e segurança

Veja [docs/security.md](docs/security.md). Fotografias e thumbnails são privadas; somente dono do arquivo ou administrador pode baixá-las. Cada requisição é autorizada. Originais são entregues como anexos com `nosniff` e `no-store`. Nenhuma foto pessoal recebe URL pública permanente. O ZIP usa o método STORE, transmitindo bytes sem recompressão; limite de 4 GB para esse formato, com download individual como alternativa.

Limite padrão: 25 MB por foto, 200 arquivos ativos por dono; PDF máximo 10 MB e 2.000 páginas. A contagem do PDF ocorre no servidor. PDFs com senha, scripts ou anexos detectados são rejeitados. Há validação de MIME por assinatura, limites de corpo, rate limiting, consentimento, proteção de origem/CSRF e logs administrativos. Isso não substitui um serviço antivírus especializado.

A retenção padrão é 90 dias, editável no painel. A exclusão é executada pelo comando **Limpar arquivos expirados** no administrador, em lotes. Arquivos vinculados a pedidos/solicitações abertos são preservados. Não existe um cron automático habilitado; agende uma rotina autenticada de manutenção ao conectar o ambiente operacional. Mantenha backups e política de descarte também no storage contratado.

## Frete, pagamentos e armazenamento externo

Veja [docs/integrations.md](docs/integrations.md) para contratos, variáveis, webhooks e CORS. Os providers Correios/Jadlog e cartão recebem endpoints de uma **bridge da loja**; não fingem chamadas diretas às APIs comerciais nem trazem URLs ou taxas presumidas. É necessário implementar/conectar a bridge ao contrato efetivamente contratado. Sem ela, há mensagem de indisponibilidade e retirada local gratuita.

A máquina Rede física não cria uma integração de cartão online. Cartões são digitados somente no checkout hospedado do gateway. O sistema não recebe número/CVV. Parcelas e juros são apresentados pelo operador; o limite cadastrado deve ser respeitado pela bridge.

## Deploy na Vercel

1. Importe `decodxr/FotoDigital` na Vercel, framework Next.js, Node 24.
2. `vercel.json` já seleciona `npm run build:vercel` (`next build --webpack`). O comando `npm run build` é reservado ao Worker Sites.
3. Siga [docs/supabase.md](docs/supabase.md): instale `supabase/setup.sql` pelo SQL Editor e configure `DATABASE_URL` com a URI do Transaction pooler.
4. Crie o bucket privado no Supabase e configure as credenciais da API S3, incluindo endpoint completo e região. Execute `npm run supabase:check -- --write-test` no ambiente configurado.
5. Configure `APP_URL` com o domínio HTTPS, a chave PIX e o código inicial do administrador.
6. Faça o deploy. Execute uma compra de homologação com produtos/preços autorizados e credenciais de teste dos provedores antes da abertura ao público.

Não exponha chaves em variáveis `NEXT_PUBLIC_*`. Não copie headers de identidade do Sites para a implantação Vercel. Nenhum dado de negócio depende de arquivos locais persistentes.

## Sites

A identidade existente está em `.openai/hosting.json`. Reutilize o `project_id`; não crie outra aplicação ao atualizar. O build leva código, assets e migrations em `dist/`. Variáveis de produção são mantidas pelo serviço Sites. Publique sempre uma versão cujo commit tenha sido enviado ao repositório de origem. As atualizações preservam o acesso já configurado para este Site. Seus dados D1/R2 não são transferidos automaticamente para Supabase; a versão Vercel possui banco, arquivos e autenticação próprios.

## Verificação

```bash
npm run lint
npm run typecheck
npm run db:migrate:local
npm test
npm run build
npm run build:vercel
```

Os testes exercitam cálculos de DPI, preços e PIX, documentos, identidade, autorização entre clientes, bootstrap, arquivos originais, checkout persistente, idempotência, ZIP, estados e disputa de estoque. O fluxo da API é executado em SQLite e no motor PostgreSQL/PGlite. Também são verificados instalação repetida do SQL, RLS, bloqueio para anon/authenticated, rollback, parâmetros, configuração do pool e assinatura S3 com o prefixo Supabase. O teste opcional `node tests/worker.test.mjs` exercita o bundle compilado com Miniflare/D1/R2; sua execução requer permissão para abrir o runtime local e não foi concluída neste ambiente. O adapter SQLite/Map usado nos testes é explicitamente isolado em `tests/platform.ts`; não integra o bundle de produção. Integrações externas exigem homologação com credenciais reais e testes de dispositivos/fluxos no domínio escolhido.

O teste de protocolo usa o driver Postgres.js real, TLS e um servidor local com PostgreSQL/PGlite para verificar consultas concorrentes, commit e rollback. A suíte da API também roda pelo adapter real da Vercel: cadastro, sessão, carrinho, pedido e disputa de estoque passam pelo driver e pela fila de operações de produção. Requer `openssl` no PATH apenas durante os testes, para gerar um certificado temporário; não adiciona dependência ao servidor de produção. O certificado e a chave de teste são removidos ao terminar.

## Imagens e conteúdo

### Câmera vintage 3D

A home usa **Camera 01**, de Rajil Jose Macatangay / Poly Haven, sob CC0. Não é
um modelo feito pela loja, nem implica vínculo com um fabricante. Fonte, licença,
adaptações e hashes estão em `public/models/camera/LICENSE.md`. Os arquivos são
hospedados pelo próprio site; não há iframe, API de terceiros ou segredo em runtime.

`components/store/camera-story.tsx` mantém a narrativa e a imagem estática no HTML.
O módulo `camera-stage.tsx`, com React Three Fiber/Three.js, só é carregado perto
da seção. O asset desktop usa texturas 2K (4,05 MB) e o mobile usa 1K (1,67 MB).
Os materiais PBR preservam os mapas do artista; reflexos vêm de softboxes capturados
com PMREM. O eixo fica centralizado no corpo; a alça solta da composição original
fica oculta. O modelo completa uma volta por scroll, com amortecimento e parallax.

O render usa `frameloop="demand"`: desenha enquanto o movimento está se acomodando,
para ao estabilizar e não fica animando continuamente. Há pausa manual, respeito
à aba invisível e fallback para falha de carregamento/contexto WebGL. Movimento
reduzido mostra a imagem renderizada da própria geometria e todos os capítulos,
sem carregar WebGL. Telas baixas usam conteúdo em fluxo para evitar corte de texto.
O topo do palco acompanha a altura real do cabeçalho por ResizeObserver.

Para atualizar os assets: `node scripts/prepare-camera.mjs /caminho/cache-camera`.
O script verifica os hashes fornecidos pelo publicador e usa o Sharp incluído na
dependência Next.js para empacotar GLBs. Execute a preparação a partir da raiz.
O pôster pode ser recriado offline com `scripts/render-camera-poster.py` e as
dependências Python indicadas no arquivo; elas não participam do build/deploy.
Teste específico: `node --experimental-strip-types --test tests/camera.test.mjs`.

Veja [docs/assets.md](docs/assets.md). A identidade visual usa fotografias ilustrativas de bancos de imagem, declaradas como tais. Galerias de inspiração não são apresentadas como portfólio da empresa. Substitua-as pelas fotos autorizadas da loja pelo painel ou assets públicos. Não há avaliações falsas, horários de funcionamento ou preços não informados.

Políticas de privacidade, envio, trocas e termos estão em `components/store/institutional.tsx` e devem refletir a operação efetiva ao abrir a loja. Referência legal utilizada para compras à distância: [CDC, art. 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm).


## Vitrine animada e identidade visual

A interface usa DM Sans local, superfícies brancas e cinza e controles em carvão. A logo em `public/brand/foto-digital.png` foi modernizada a partir da marca enviada pelo proprietário; a abertura multicolorida permanece o destaque cromático da identidade. `app/showcase.css` define a direção visual e `components/store/showcase.tsx` a vitrine em perspectiva.

No **/admin → Vitrine animada**, adicione ou edite um destaque. Envie uma foto JPG/PNG, preencha título, descrição e página de destino, escolha a posição e ative o registro. Os oito primeiros registros ativos, ordenados por posição, aparecem imediatamente na home após atualização. É possível arquivar, reordenar e substituir as fotografias. A identificação “imagem ilustrativa” é configurável por foto. Os cinco destaques iniciais usam as fontes já documentadas, sem atribuição de portfólio à empresa; são inseridos uma única vez, preservando banners existentes e sem recriar registros arquivados.

O envio da vitrine é exclusivo de administradores: até 20 MB no seletor, versão JPEG de até 1600 px preparada no navegador e limite de 6 MB validado no servidor. **Essa otimização se aplica apenas à imagem comercial da vitrine**. Fotografias de clientes para impressão continuam preservadas integralmente. Imagens da vitrine ficam em `storefront/` no mesmo storage privado, com metadados em `storeMedia`. A rota `/api/store-media/[id]` permite leitura pública apenas quando a foto está vinculada a um destaque ativo; prévias não publicadas exigem administrador. Ao arquivar, a cópia eventualmente em cache expira em até 60 segundos. A rotina de retenção de fotografias de clientes não remove imagens comerciais; registros comerciais não referenciados permanecem armazenados para manutenção administrativa do bucket.

A rotação automática ocorre a cada 6,5 segundos. Setas, indicadores, gestos horizontais e teclado permitem navegação manual. A apresentação pausa após interação ou foco no conteúdo e quando a aba/vitrine deixa de estar visível; a preferência de movimento reduzido desativa reprodução automática e transições. O botão de reprodução permite retomar. Nenhum novo serviço ou segredo externo é necessário no Sites; na Vercel, utiliza os adapters PostgreSQL/S3 já existentes.

As migrations incrementais `drizzle/0001_misty_pepper_potts.sql` e `db/postgres/0001_showcase.sql` acrescentam apenas a mídia comercial e os campos de ordenação/identificação ilustrativa. A migração inicial permanece intacta.
