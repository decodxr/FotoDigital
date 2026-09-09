# Segurança e operação

## Limites e autorização

A aplicação verifica o dono em todo acesso a pedido, endereço, carrinho e upload. Admin é verificado no servidor antes de qualquer leitura/alteração administrativa. Identidade encaminhada pelo Sites só é aceita nesse build; o adapter Vercel ignora headers equivalentes do visitante. O primeiro administrador é promovido por segredo de uso único e uma atualização atômica. Não existe senha padrão.

Sessões usam tokens aleatórios, hash no banco, expiração de sete dias e cookies HttpOnly, SameSite=Lax e Secure fora do desenvolvimento. Senhas possuem salt e PBKDF2 SHA-256 com 100.000 iterações, compatível com WebCrypto do Worker. Para políticas de autenticação mais exigentes, o ponto de substituição está em `security.ts`; considere um provedor com MFA e recuperação verificada.

Mutações verificam Origin; webhooks possuem HMAC e tolerância temporal próprios. Inputs passam por schemas Zod. Preços e descontos são calculados pelo servidor. As transações impedem estoque negativo e aplicação concorrente do mesmo cupom. Os mesmos headers que protegem anexos impedem sua execução como HTML. O cabeçalho de CSP é básico, não uma política completa com nonces para scripts; adapte-o ao domínio, fontes e gateways efetivos.

## Uploads

Originais, miniaturas e instruções são objetos/registros distintos. Não execute arquivos recebidos. O detector usa assinatura binária, tamanho declarado versus recebido e limites de upload. PDFs são analisados para quantidade de páginas e conteúdo ativo/anexos conhecidos. A aplicação não inclui um motor antivírus; integre varredura/quarentena no storage se exigido pela operação.

O DPI é uma estimativa a partir das dimensões informadas pelo decodificador do navegador e do crop. Não mede foco ou ruído e não implica garantia de qualidade. HEIC sem suporte de decodificação fica sem prévia e solicita confirmação. A miniatura pode ter cores diferentes da impressão, especialmente arquivos com perfis de cor; o original conserva seus bytes e metadados.

## Retenção e atendimento

Defina o prazo no painel. O botão de limpeza exclui objetos expirados em lotes e registra auditoria; fotos em pedidos ou solicitações abertos são preservadas para produção. O cliente pode excluir uploads não vinculados; arquivos já associados a pedidos exigem atendimento da loja. Exclusão de conta/dados e recuperação de senha são tratadas pelo canal de suporte, após verificar a identidade. Não há tarefa automática de retenção habilitada por padrão.

Faça backups dos dois recursos (banco e bucket) antes de migrations. Teste restauração. Defina responsável, período de conservação dos registros fiscais, procedimento para incidentes e acesso mínimo da equipe. A política publicada deve acompanhar os provedores e processos utilizados. Referência: [orientações da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes).

## Homologação antes da abertura

Cadastre valores autorizados e fotos reais; revise textos comerciais/políticas; configure frete/cartão/storage no ambiente escolhido; teste pagamento com o operador e reconciliação; confirme o arquivo ZIP na estação de impressão; valide upload em iOS e Android, navegação por teclado e fluxo de checkout no domínio final. Builds e testes automatizados não equivalem a auditoria independente ou certificação de conformidade LGPD.
