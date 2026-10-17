# Pagamentos TotalGest — fase 1, sandbox

Implementação preparada para revisão; **não está instalada nem validada no Supabase/Stripe da TotalGest**. A interface vem desligada. O servidor recusa chaves reais e eventos `livemode=true`. Não existe nesta fase um caminho para cobrar dinheiro real ou alterar licenças operacionais.

## Modelo comercial

Novas compras: apenas **Express, Expert, Pro e Supreme**. Os atalhos antigos de compras/renovações individuais do administrador encaminham para a seleção de packs. Os cartões de compra de add-ons deixam de aparecer na área da licença.

Os campos antigos, contratos, pedidos e direitos já adquiridos continuam guardados. Não se apagam registos nem se retiram direitos em produção nesta alteração. A migração das contas antigas, formulários do Super Admin/distribuidores e páginas comerciais precisa de uma revisão própria antes de retirar definitivamente todo o modelo antigo. O servidor novo nunca aceita produtos individuais.

O sandbox usa os preços atuais de `PACK_PRECOS`, em cêntimos e com IVA incluído conforme o código atual, nos escalões 5/10/25/50. O anual é mensal × 12 com 10% de desconto. Há comparação automática de todos os 32 preços entre JavaScript e SQL. Blocos de funcionários e condições comerciais especiais não são vendidos neste sandbox; não se devem converter contratos com preço fundador/distribuidor para o catálogo automaticamente.

## Fluxo implementado

1. Administrador autenticado escolhe pack, escalão, período e método.
2. Edge Function valida a sessão através de Supabase Auth. A base de dados confirma o papel e identifica a empresa através de `perfis.registo_id`.
3. PostgreSQL calcula o preço. Valores, estado de pagamento e empresa enviados pelo navegador não são usados.
4. Um bloqueio por empresa e índice único impedem dois checkouts pendentes diferentes para a mesma empresa. A repetição devolve o mesmo pedido. Há limite de cinco novos pedidos por hora/empresa.
5. Stripe recebe um checkout **de teste**, com chave de idempotência. A sessão e o cliente são vinculados ao pedido antes de devolver o URL.
6. O retorno ao site apenas apresenta o estado. Não ativa nem confirma nada.
7. Webhook valida HMAC-SHA256 sobre o corpo bruto e tolerância de 300 segundos, recusa eventos reais, consulta novamente a sessão Stripe e confere sessão, cliente, pedido, moeda, valor e modo.
8. Uma transação grava evento + pagamento + fila de ativação simulada + outbox. Eventos repetidos não duplicam efeitos. Um erro em qualquer escrita desfaz tudo, permitindo repetir.

`checkout.session.completed` com `payment_status=unpaid` fica em processamento. Apenas o estado canónico `paid` produz a ativação simulada. Eventos atrasados não fazem regredir um pagamento confirmado.

Métodos preparados: cartão, SEPA, Multibanco e transferência EUR via `customer_balance`. O IBAN virtual da transferência pode não ser português (configuração inicial FR). A disponibilidade depende da conta Stripe. Gerar referência, mandato ou instruções bancárias não é confirmação.

**São pagamentos avulsos do período escolhido. Mensal/anual não significa assinatura automática nesta fase.** O checkout não cria débitos recorrentes, nem guarda mandatos para cobrança futura. O desenvolvimento de subscrições só deve avançar depois da validação do primeiro pagamento com a conta do proprietário.

## Instalação no ambiente de testes

Requer acesso ao projeto correto: `rfniufasivfnrqfntzog` (confirmar no painel da TotalGest antes de qualquer operação). Não utilizar um projeto de outra aplicação que esteja ligado na mesma conta. Preferir um projeto de testes com o esquema `perfis` e `administradores`, e utilizadores de teste.

1. Rever e aplicar `supabase/migrations/*_billing_packs_sandbox.sql` primeiro numa base descartável. Não foi executada em produção.
2. Publicar `billing-checkout` e `billing-webhook` com a configuração `verify_jwt=false` do `supabase/config.toml`. O primeiro valida o JWT explicitamente; o segundo valida a assinatura Stripe.
3. Configurar exclusivamente nos segredos do servidor:

   | Variável | Conteúdo |
   | --- | --- |
   | `TG_BILLING_SANDBOX_ENABLED` | `true` |
   | `STRIPE_SECRET_KEY` | Chave de teste `sk_test_…` |
   | `STRIPE_WEBHOOK_SECRET` | Segredo `whsec_…` do webhook de teste |
   | `TG_BILLING_RETURN_URL` | URL HTTPS completo de `login.html`, sem query/fragmento |
   | `TG_BILLING_ALLOWED_ORIGINS` | Origens exatas separadas por vírgula, sem caminhos |
   | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Fornecidos pelo ambiente da função |

4. Na Stripe de teste, registar `https://<project-ref>.supabase.co/functions/v1/billing-webhook` para os eventos snapshot:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
5. O cliente HTTP fixa a API em `2025-02-24.acacia`. Confirmar a compatibilidade com a conta no teste integrado. O webhook utiliza só o identificador do evento e consulta o estado atual via API.
6. Só no frontend de testes, ligar `window.TG_BILLING_SANDBOX_ENABLED` em `tg-billing-config.js`. Entrar como administrador e abrir a licença. O painel identifica explicitamente que não cobra nem ativa licenças.
7. Confirmar cada método no checkout Stripe, incluindo SEPA pendente/falhado, Multibanco não pago/expirado e transferência incompleta. Não usar cartões ou IBANs reais em testes.
8. Conferir `tg_billing_orders`, `tg_billing_events`, `tg_billing_activation_queue` e `tg_billing_outbox`. As duas últimas são filas de teste, sem consumidor que envie emails ou ative licenças.
9. Executar os advisors do Supabase após instalar e rever as permissões. As quatro tabelas têm RLS e não permitem acesso direto por `anon`/`authenticated`; os RPCs só são executáveis por `service_role`, com `SECURITY INVOKER`.

Não há qualquer chave secreta no frontend. Não colocar segredos em ficheiros Git ou na conversa.

## Verificação local

Node 24 ou superior:

```sh
npm ci --ignore-scripts
npm run test:billing
```

Os testes usam PostgreSQL embebido (PGlite) para executar a migração e os RPCs, jsdom para a interface e pedidos HTTP simulados para as Edge Functions. Exercitam isolamento por empresa, permissões, preços, duplicação, atomicidade, assinaturas, condições de corrida e falhas. **Não equivalem a pagamentos ponta a ponta contra Stripe/Supabase reais.** Ações de CI repetem estes testes nas pull requests.

## Fases ainda necessárias antes de pagamentos reais

- Validar a conta Stripe, métodos disponíveis, dados fiscais e preços comerciais definitivos.
- Testar o esquema real da TotalGest e a ligação `perfis → administradores → licencas`.
- Implementar a ativação transacional real de packs, com validade, limites e módulos, incluindo descidas de pack e preservação de períodos pagos. Resolver conflitos com sessões antigas que ainda possam gravar licenças pelo frontend.
- Migrar contas antigas e retirar as restantes vendas individuais do Super Admin, distribuidores, inscrição e site. A migração não deve retirar direitos pagos sem uma regra explícita.
- Implementar subscrições de cartão/SEPA, ciclos com datas de calendário, cancelamento, falhas, regularização e tolerância. Impedir dupla assinatura por empresa.
- Implementar faturas/recibos através do sistema de faturação escolhido e envio de emails com outbox, tentativas e prevenção de duplicados. O comprovativo Stripe não substitui essa integração.
- Implementar devoluções, estornos e disputas SEPA/cartão: estes eventos ainda não são processados pelo sandbox.
- Completar área de pagamentos do Super Admin e reconciliação de transferências feitas para IBAN próprio, caso seja necessária.
- Validar os quatro métodos ponta a ponta no ambiente de teste e só depois preparar uma alteração distinta para produção. Não basta trocar a chave: esta versão bloqueia deliberadamente pagamentos reais.

## Desligar

Desligar o sinalizador do frontend esconde a interface. Desligar `TG_BILLING_SANDBOX_ENABLED` no servidor bloqueia novos pedidos e processamento de eventos. Para terminar um ensaio, deixar primeiro os webhooks de teste pendentes serem processados; depois desligar e guardar os registos para revisão. Não eliminar as tabelas para resolver pagamentos pendentes.
