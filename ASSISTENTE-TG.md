# TG Smart 2.0 — 1 de outubro de 2026

Assistente local dentro da Total Gest, após login. Sem IA externa e sem custo
por tokens. Reutiliza os dados carregados pela aplicação; não altera registos,
não envia conversas nem faz novas consultas ao backend.

## Novidades

- Mascote original transparente: movimento contínuo e reações distintas a
  abertura, consulta, sucesso e alerta. A animação também aparece no cabeçalho.
- Balão proativo com contador de alertas, dispensa e silêncio por uma hora.
- OS atrasadas, excluindo concluídas/canceladas.
- OS de hoje, amanhã, ontem e de hoje até domingo; seguimento “e amanhã?”.
- Contratos expirados e a vencer nos próximos 30 dias, pela validade contratual.
- Stock abaixo do mínimo para artigos com alertaStock ativo. Soma o stock
  inicial e os movimentos da empresa, incluindo devoluções e ajustes.
- Pesquisa de clientes por nome, empresa e número, sem distinguir acentos.
- Resumo do dia, listas até seis registos e atalhos para os módulos existentes.

## Permissões e limites

Os administradores/subadministradores consultam apenas a própria empresa e
os módulos disponíveis. Funcionários veem OS atribuídas a si ou a Todos.
Encarregados veem as OS da sua equipa segundo as regras atuais da aplicação.
Pesquisa de clientes, contratos e stock fica limitada a administradores e
subadministradores com acesso ao módulo. Super Admin e Vendedor mantêm apenas
os atalhos, sem agregação de dados de outras empresas. Sem assistente no portal
cliente ou quiosque. As consultas dependem também da validade da licença.

O balão reavalia os dados em memória após a renderização da aplicação e a cada
minuto com a página visível. Não funciona com a aplicação fechada. Os números
refletem os dados carregados; o histórico de OS pode ser parcial conforme a
sincronização atual da plataforma. Não confirma disponibilidade de técnicos:
para isso seria necessário cruzar serviços, férias e horários.

Texto livre é interpretado por regras; não se trata de um modelo generativo.
As preferências e conversa duram apenas a sessão da página. O histórico é
limpo ao trocar de utilizador/empresa/perfil ou terminar sessão.

## Publicação

Publicar em conjunto app-principal.js, tg-smart-engine.js, tg-assistente.js,
tg-assistente.css, sw.js e assets/tg-mascote-alerta.webp (além dos assets já
existentes). A versão de cache e os URLs dos módulos foram atualizados.
O index e as restantes funcionalidades não foram substituídos pelo ZIP antigo.

## Testes

Executar `node --test tests/tg-smart.test.cjs` para verificar empresa/perfil,
licença, módulos, datas, stock, intenções e ausência de alterações nos dados.
Há três falhas preexistentes em tests/navigation-logic.test.cjs, confirmadas
também no commit de base, sem relação com a integração TG.

Validação em Chromium com dados sintéticos: alertas proativos, estados visuais,
contagens, seguimento, layout móvel, silêncio, troca de conta, logout, quiosque
e preferência de movimento reduzido passaram. Não foi usado login real.
