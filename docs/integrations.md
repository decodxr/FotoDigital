# Contratos dos adapters

Todos os preços são centavos inteiros BRL. Segredos ficam no servidor. Falhas e timeouts não geram preços de substituição.

## S3 e Cloudflare R2

No Sites, `DB` e `BUCKET` são bindings gerenciados. O upload é transmitido ao R2 sem passar por disco nem banco. No Vercel, defina:

- `S3_ENDPOINT`: endpoint HTTPS do serviço, sem bucket no caminho.
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- `S3_REGION`: `auto` para R2; região correta para S3.

O signer implementa AWS Signature V4, endereçamento por caminho, URLs de cinco minutos. Mantenha o bucket **privado**, sem website/public access, e habilite CORS com a origem exata do site, métodos PUT, GET e HEAD, headers Content-Type e os headers da requisição assinada. Não use `*` para origens em produção. Credencial limitada ao bucket e operações necessárias. Downloads passam por autorização no backend.

O POST `/api/uploads` requer consentimento e cria o registro; o cliente faz PUT dos bytes, chama `/complete` e depois envia thumbnail JPEG separada. Nenhuma transformação escreve sobre o original. As miniaturas são geradas no navegador para manter o upload do original independente de codecs. Falha na prévia é exibida, especialmente em HEIC.

## Correios e Jadlog

Implemente o contrato `ShippingProvider` em `lib/server/providers.ts` ou conecte uma bridge HTTPS da loja que traduza seu contrato comercial.

Para cada transportadora: `CORREIOS_QUOTE_URL` + `CORREIOS_API_TOKEN` ou `JADLOG_QUOTE_URL` + `JADLOG_API_TOKEN`. POST JSON, `Authorization: Bearer <token>`, timeout de oito segundos.

Entrada:

```json
{"originCep":"87302230","destinationCep":"<CEP com 8 dígitos>","items":[{"id":"<produto>","name":"<nome>","quantity":1,"weightGrams":"<peso configurado>","widthCm":"<medida>","heightCm":"<medida>","lengthCm":"<medida>","valueCents":"<subtotal validado>"}]}
```

As strings entre `<...>` explicam o contrato; peso, medidas e valores são **números** em uma chamada real. O campo `quantity` representa unidades físicas: impressões/cartelas nas revelações, folhas nos documentos (considerando frente e verso) ou unidades de produto. Peso e medidas cadastrados correspondem a uma unidade; a bridge deve compor a embalagem e o peso final. O payload também inclui `kind`, `variantId` quando escolhido e `prints` com tamanho (`sizeId`) e quantidade total de cada impressão. Para tamanhos com embalagens diferentes, a bridge deve mapear esses identificadores para as dimensões reais; não estime fretes sem essa configuração. O adapter recebe as opções em:

```json
{"quotes":[{"service":"<modalidade real>","cents":"<centavos reais como número>","days":"<dias reais como inteiro>"}]}
```

O backend acrescenta a transportadora, gera ID opaco, expira a cotação em dez minutos e vincula a dono, CEP e digest do carrinho. O checkout recalcula o digest e rejeita cotações alteradas/expiradas. Um provider indisponível não apaga respostas do outro. A retirada sempre custa zero.

## PIX

`PIX_KEY` deve conter `05998428000199`, CNPJ informado pelo proprietário, quando estiver pronto para receber. O servidor gera BRCode com valor e referência por pedido. O cliente copia o código no banco; a loja confere o crédito e aprova no painel. **Não há confirmação bancária automática**, cobrança dinâmica nem simulação de pagamento recebido. Use o manual oficial do [Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/pix) ao conectar um PSP para PIX dinâmico.

## Cartão hospedado

`PAYMENT_CREATE_URL`, `PAYMENT_API_TOKEN`, `PAYMENT_REDIRECT_HOSTS` (domínios exatos separados por vírgula), `PAYMENT_WEBHOOK_SECRET`. Débito só é habilitado por `PAYMENT_DEBIT_ENABLED=true` e gateway compatível.

O servidor envia POST com `Idempotency-Key: <orderId>` e Bearer token. Corpo: `orderId`, `amountCents`, `currency: "BRL"`, `method: "credit"|"debit"`, `installments: { maximum, disclosure }` (configurados no painel), `customer`, `returnUrl`, `webhookUrl`. A bridge deve respeitar o limite/juros contratados com a loja e criar um checkout hospedado idempotente. Resposta: `{ "externalId": "<id real>", "url": "https://<domínio autorizado>/..." }`. Destinos fora da allowlist são recusados.

Se o provedor falhar, o pedido continua pendente e o cliente pode repetir a abertura do pagamento. O retorno do navegador nunca aprova um pagamento.

### Webhook

POST `/api/payments/webhook`, corpo JSON sem reformatar depois da assinatura:

```json
{"orderId":"<UUID>","externalId":"<id do gateway>","status":"approved","amountCents":"<inteiro>","currency":"BRL"}
```

Cabeçalhos:

- `x-fd-timestamp`: Unix timestamp em segundos; tolerância de cinco minutos.
- `x-fd-signature`: HMAC-SHA256 hexadecimal de `timestamp + "." + rawBody`, com `PAYMENT_WEBHOOK_SECRET`.

A bridge deve primeiro validar a notificação original do gateway. O servidor verifica assinatura, horário, valor, moeda e correspondência do identificador. Repetições de aprovação são idempotentes. Notificações `failed` não aprovam o pedido; ele permanece pendente para nova tentativa. Pagamento recebido após cancelamento exige conciliação pela loja e recebe conflito, sem reabrir produção automaticamente. Estornos e reembolsos devem ser realizados junto ao operador.

## PostgreSQL

O adapter Vercel utiliza o [SQL-over-HTTP do Neon](https://neon.com/docs/serverless/serverless-driver). Restringe o hostname ao serviço contratado, envia consultas parametrizadas, usa batch transacional Serializable e valida o formato da resposta. As tabelas e colunas preservam nomes entre D1 e PostgreSQL. Não foi executado contra banco remoto sem credenciais. Confira conexão, permissões, backups e o contrato HTTP na homologação.
