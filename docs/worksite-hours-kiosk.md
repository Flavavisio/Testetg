# Horas e custos de obra — quiosque

Correção de 03/11/2026.

## Regra de cálculo

- Agrupar por empresa, obra, pessoa e dia. Incluir as OS da obra.
- Usar os intervalos de picagem válidos desse dia, incluindo manhã/tarde e colegas sem folha.
- Unir intervalos duplicados/sobrepostos antes de somar; o ponto geral não conta para uma obra. `pausaAlmoco` assinala a saída para almoço: o intervalo entrada→saída continua a ser trabalho. A pausa é o espaço entre essa saída e o regresso.
- A folha não volta a somar horas já cobertas pelas picagens. Nos dias sem picagens válidas, as folhas com descrição continuam a fornecer as horas.
- Entradas em aberto contam apenas no próprio dia; uma entrada antiga não cresce com a hora de hoje. Intervalos invertidos ou inválidos não criam horas.
- Registos antigos sem data não permitem conciliação por sessão: quando existem folhas da pessoa, estas mantêm-se como fonte em vez de somar picagens sem data.
- Diferenças entre folhas e picagens são identificadas no Financeiro e no PDF interno. As folhas permanecem intactas, incluindo descrições e assinaturas.

Resumo da obra, Financeiro, listagem, PDF e novos Autos de Medição usam a mesma contagem. Horas exibidas com duas casas decimais; 22,55h correspondem a 22h33.

## Quiosque e custos

A folha do responsável no quiosque com agenda passa a guardar todos os intervalos do dia para essa OS/obra. O cálculo da obra inclui também os colegas que apenas picaram entrada e saída.

A criação de encarregados através do formulário de equipa guarda o ordenado bruto introduzido. Mantém-se a fórmula: ordenado bruto / (horas semanais × 4,33). O custo/hora definido na obra é a alternativa quando não existe uma taxa individual válida.

O Financeiro passa a discriminar horas, taxa, origem da taxa e custo por pessoa, tal como o PDF interno. Custos em falta são apresentados como subtotal incompleto, nunca como custo total zero nem margem fictícia. PDFs para o cliente continuam sem custos/salários internos.

## Histórico e limites

O recálculo é feito na leitura: não escreve nem apaga picagens ou folhas e não altera Autos de Medição já emitidos nem PDFs já descarregados. Abrir a obra ou gerar um novo relatório usa os novos totais. Ordenados em falta não são inventados; devem ser preenchidos na ficha para completar o custo.

Nos dias com picagens, estas prevalecem sobre horas introduzidas manualmente em folhas. O aviso de divergência permite rever eventuais ajustes manuais ou picagens incompletas; não é feita uma correção silenciosa dos documentos originais.

## Validação

`tests/kiosk-work-hours.test.cjs` cobre almoço, colegas sem folha, múltiplos dias, sobreposições, entrada aberta atual/antiga, isolamento entre empresas, ponto geral, períodos de Autos, Financeiro/PDF, salários em falta, atualização de taxa, criação efetiva de encarregado e gravação da folha do quiosque.

Exemplo histórico anonimizado: 42,53h no cálculo anterior → 22,55h após conciliação dos intervalos; subtotal de pessoal 94,16 €, com uma pessoa sem ordenado definido. Os dados originais não são modificados.

Também são executados os testes existentes de custos de obra, quiosque, registo de tempo e resumo de obra. A revisão base já apresenta falhas nos testes `service-time`, `ponto-day-boundary` e num caso de `presence-status`, por funções ausentes/dependências de extração; essas falhas são independentes desta alteração.

## Complemento: app normal e associação persistente

A revisão seguinte cobre também os fluxos normais de OS e obras. As folhas novas guardam `picagens_vinculadas` (array de tipo/id por sessão). A associação é filtrada por empresa, pessoa, data e OS/obra. Não são alteradas picagens para marcar o tempo como consumido. Editar uma folha da mesma pessoa/data/intervenção mantém os vínculos originais e não captura sessões posteriores.

- `null`: folha antiga sem associação verificável; mantém a compatibilidade histórica e os avisos de divergência. Não há associação retroativa automática.
- `[]`: folha manual independente, somada mesmo quando existem outras picagens nesse dia.
- Array de referências: sessões usadas pela folha; referências com `manual: true` substituem apenas o intervalo correspondente por horas corrigidas explicitamente.

O cálculo inicial da folha passa a considerar só a pessoa/data selecionadas, junta intervalos sobrepostos e inclui a manhã antes do almoço. Uma nova folha só considera sessões ainda não vinculadas. O legado com `usadoEmFolha` só é aceite quando existe uma folha da própria pessoa/data, evitando consumir horas de colegas.

O PDF interno individual usa `_custoHoraPessoa` também para encarregados e administradores. A folha individual continua a representar o documento original; o relatório agregado da obra recalcula as picagens sem reescrever folhas assinadas.

A coluna JSON é aditiva e anulável, sem alteração de RLS ou permissões. Novos testes reproduzem almoço real da app, dois técnicos, recarga com o mapeamento real, folha manual e sessão independente, correção manual de uma única sessão, edição sem consumo de períodos posteriores e custo de encarregado no PDF.

## Tempo exato e folha com a equipa

O relatório individual de OS passa a usar o mesmo registo de horas de todos os intervenientes, mesmo sem obra associada. A folha gerada e o seu PDF apresentam o tempo combinado da equipa no dia, com detalhe por técnico e identificação separada do responsável. As horas pessoais guardadas na folha e a assinatura original não são reescritas nem multiplicadas. A apresentação conjunta não é uma nova parcela para o cálculo de totais.

O cálculo de intervalos usa segundos inteiros; a apresentação usa horas, minutos e segundos, sem casas decimais de horas nos totais. Exemplo: 08:34:49–09:04:26 + 08:34:58–09:04:00 = 58 min 39 s de mão de obra, com uma folha assinada. O relatório interno da OS discrimina custos por técnico e inclui mão de obra e materiais na margem. O relatório do cliente não contém salários, taxas ou custos internos.

Nos agrupamentos da lista, várias folhas da mesma OS/obra/dia não repetem o tempo da equipa. O total da OS é calculado pelas sessões de cada pessoa; não resulta da soma dos totais de equipa apresentados em cada documento.

Testes adicionais: OS sem obra e dois técnicos com uma assinatura; soma exata de segundos; saída ao almoço; faltas; folha/PDF e total iguais; custos com ordenados diferentes; proteção do PDF do cliente; várias folhas no mesmo dia; folhas de obra e OS associadas sem duplicações.
