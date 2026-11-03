# Horas e custos de obra — quiosque

Correção de 03/11/2026.

## Regra de cálculo

- Agrupar por empresa, obra, pessoa e dia. Incluir as OS da obra.
- Usar os intervalos de picagem válidos desse dia, incluindo manhã/tarde e colegas sem folha.
- Unir intervalos duplicados/sobrepostos antes de somar; o ponto geral e os intervalos assinalados como pausa não contam para uma obra.
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
