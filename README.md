# FOTO DIGITAL

E-commerce para **Matsumi & Matsumi Ltda.**, Campo Mourão – PR. Desde 2003 eternizando momentos.

O projeto reúne loja, revelação de fotos, documentos, personalizados, área do cliente e administração com persistência. Não há preços comerciais, fretes estimados nem avaliações inventadas no seed. Produtos sem preço ficam sob consulta; o servidor bloqueia a compra até a configuração do valor.

## Arquitetura

- React 19, TypeScript estrito, Next.js 16, Tailwind CSS 4, controles acessíveis Radix e Lucide.
- Componentes por domínio em `components/store`. Editor e áreas secundárias são carregados separadamente.
- APIs em `app/api/[...path]`, regras e autorização em `lib/server`, cálculos compartilhados em `lib/shared`.
- Sites: build Vinext, Cloudflare Worker, banco D1 e bucket R2 privados provisionados pelos bindings `DB` e `BUCKET`.
- Vercel: build Next.js nativo, adapter PostgreSQL Neon por HTTPS e armazenamento S3/R2 por URLs assinadas. Sem armazenamento permanente no filesystem.
- Modelagem Drizzle com 28 tabelas, migrations SQL D1 e versão PostgreSQL. Não utiliza Prisma: os adapters evitam acoplar a aplicação a um engine incompatível com a hospedagem Sites. PostgreSQL preserva as mesmas entidades e regras.
- Variantes, campos configuráveis, endereços e snapshots são documentos JSON tipados/validados, sem blobs de imagens no banco. `users` reúne identidade e perfil do cliente; `uploads`/`photoConfigurations` representam arquivos e instruções de impressão.

## Identidade e movimento

O visual utiliza superfícies com tom de papel, verde profundo e tipografia Newsreader/DM Sans hospedada no próprio site. A home combina fotografias, categorias visuais e conteúdo editorial. O padrão segue no catálogo, upload, checkout, conta e administração. Animações usam CSS e IntersectionObserver, sem dependência adicional; respeitam `prefers-reduced-motion`, mantêm o conteúdo disponível sem JavaScript e revelam elementos quando recebem foco pelo teclado.

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

Para desenvolver no ambiente Vercel/Neon, configure `DATABASE_URL` e o storage, aplique as migrations PostgreSQL e execute `npx next dev`.

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
# Apenas ao preparar o esquema inicial equivalente do PostgreSQL:
node scripts/generate-postgres.mjs
# Com DATABASE_URL exportada no terminal:
npm run db:migrate:postgres
```

Não regenere/substitua migrations já aplicadas. O SQL inicial PostgreSQL é consolidado e ordena as chaves estrangeiras; alterações futuras exigem migrations incrementais para **ambos** os bancos. `migrate-postgres.mjs` aplica arquivos SQL em transações por arquivo. Este projeto não recebeu credenciais PostgreSQL; sua execução remota depende da conta de implantação.

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
3. Conecte PostgreSQL Neon, configure `DATABASE_URL` com TLS e aplique `npm run db:migrate:postgres` no ambiente autorizado.
4. Configure bucket privado, credenciais S3/R2 e CORS para upload PUT a partir do domínio real.
5. Configure `APP_URL` com o domínio HTTPS, a chave PIX e o código inicial do administrador.
6. Faça o deploy. Execute uma compra de homologação com produtos/preços autorizados e credenciais de teste dos provedores antes da abertura ao público.

Não exponha chaves em variáveis `NEXT_PUBLIC_*`. Não copie headers de identidade do Sites para a implantação Vercel. Nenhum dado de negócio depende de arquivos locais persistentes.

## Sites

A identidade existente está em `.openai/hosting.json`. Reutilize o `project_id`; não crie outra aplicação ao atualizar. O build leva código, assets e migrations em `dist/`. Variáveis de produção são mantidas pelo serviço Sites. Publique sempre uma versão cujo commit tenha sido enviado ao repositório de origem. A primeira publicação é privada para revisão do proprietário; ela não torna a loja pública nem altera permissões de acesso.

## Verificação

```bash
npm run lint
npm run typecheck
npm run db:migrate:local
npm test
npm run build
npm run build:vercel
```

Os testes exercitam cálculos de DPI, preços e PIX, documentos, identidade, autorização entre clientes, bootstrap, arquivos originais, checkout persistente, idempotência, ZIP, estados e disputa de estoque. O teste opcional `node tests/worker.test.mjs` exercita o bundle compilado com Miniflare/D1/R2; sua execução requer permissão para abrir o runtime local e não foi concluída neste ambiente. O adapter SQLite/Map usado nos testes é explicitamente isolado em `tests/platform.ts`; não integra o bundle de produção. Integrações externas exigem homologação com credenciais reais e testes de dispositivos/fluxos no domínio escolhido.

## Imagens e conteúdo

Veja [docs/assets.md](docs/assets.md). A identidade visual usa fotografias ilustrativas de bancos de imagem, declaradas como tais. Galerias de inspiração não são apresentadas como portfólio da empresa. Substitua-as pelas fotos autorizadas da loja pelo painel ou assets públicos. Não há avaliações falsas, horários de funcionamento ou preços não informados.

Políticas de privacidade, envio, trocas e termos estão em `components/store/institutional.tsx` e devem refletir a operação efetiva ao abrir a loja. Referência legal utilizada para compras à distância: [CDC, art. 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm).
