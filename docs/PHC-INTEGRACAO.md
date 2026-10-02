# PHC por empresa — preparação v1

## Disponível nesta versão

Aceder a Financeiro → configuração do software de faturação →
**Preparar ligação PHC GO / PHC CS**.

Cada administrador/subadministrador pode guardar rascunhos para as duas edições
na configuração da sua empresa. Os rascunhos contêm apenas URL, identificação
da empresa, App ID (GO), versão/script (CS), série pretendida e associações de
armazéns. Não são pedidas passwords, tokens ou chaves secretas. A gravação
utiliza a sincronização já existente da Total Gest e mantém o fornecedor de
faturação atualmente ativo. Guardar um rascunho PHC não ativa o PHC nem desliga
a Moloni/TOConline.

A demonstração usa uma OS fictícia e um stock fictício. Permite experimentar
os dois momentos de abatimento de stock: na fatura ou no consumo da OS. Repetir
o pedido na mesma sessão de demonstração não abate novamente. Esta demonstração
não testa autenticação, rede, séries ou regras reais do PHC; não é um documento
fiscal. Os resultados não são guardados no histórico operacional.

## Ainda por implementar/validar para produção

- Serviço backend autenticado com resolução da empresa no servidor.
- Armazenamento de segredos cifrados, inacessíveis no frontend, cache local,
  exportações e registos de aplicação.
- Conector GO com App ID autorizado e credenciais da instalação.
- Conector CS conforme API/WSDL e scripts efetivamente instalados/licenciados.
- Mapeamentos reais de clientes/artigos/impostos/unidades e séries/armazéns.
- Pré-visualização de documento, autorização de emissão, leitura do resultado
  e associação da referência PHC à OS.
- Fila persistente, identificadores únicos por empresa/documento/operação,
  reconciliação após timeout e repetição apenas quando for seguro.
- Política única de stock validada nas séries PHC: consumo e faturação não podem
  gerar dois movimentos pelo mesmo material.
- Histórico real de erros/sincronizações e testes em instalações autorizadas.

O servidor deverá obter a empresa a partir da identidade autenticada e validar
permissões em cada operação; nunca confiar num admin_id recebido do browser.
As associações devem ser únicas por empresa + edição + identificador externo.
A escolha de um URL em rascunho não autoriza chamadas de rede: no futuro, destinos
precisam de validação/allowlist no backend, sem redirecionamentos para redes
internas. Instalações CS privadas podem precisar de um conector local.

## Documentação oficial consultada em 01/10/2026

- GO autenticação: https://sis50.phcgo.net/FullApiDoc/docs/getting-started.html
  POST UserLoginWS/userLoginCompany; userCode, password, applicationType e company.
  Pedidos seguintes usam o token Engine-Auth. Contrato concreto a validar na
  versão da instalação, incluindo o formato de retorno e erros.
- GO stock: https://sis50.phcgo.net/FullApiDoc/api/PHCWS.StWS.html
  StWS disponibiliza getStByArmazem e getStocksFromStores. Não foi inferida uma
  operação de escrita de stock a partir destes métodos de consulta.
- CS exemplo de API por script:
  https://helpcenter.phccs.net/pt/sug/ptxview.aspx?stamp=dd55de2c73685b::44d5c6
  ws/wscript.asmx / RunCode. A documentação descreve Advanced/Enterprise com
  PHC On e um script instalado. Este exemplo atualiza um dossier: não constitui
  por si só um conector universal de faturação ou stock para todas as versões.

## Validação executada

`node --test tests/phc-core.test.cjs`: sanitização de metadados, URLs sem segredos,
associações únicas, ambas as edições e políticas de stock na simulação.

Teste Chromium com dados fictícios: seleção GO/CS, gravação dos dois rascunhos,
preservação da Moloni, armazéns limitados à empresa, repetição da simulação,
layout móvel, recusa de acesso por funcionário e fecho na troca de conta.

Não foram efetuadas chamadas ao PHC nem alterações à base de dados de produção.
