# Relatórios nativos de AVAC, limpezas e eletricidade — TesteTG

Disponíveis por área de negócio: `avac` → RAVAC, `limpeza` → RLIM, `eletricidade` → RELE. Os tipos de trabalho de origem têm formulários incluídos e aparecem agrupados por especialidade na OS. Os modelos vazios criados pelo onboarding deixam de surgir como relatórios personalizados; o histórico existente é preservado.

## Utilização

1. Selecionar a área de negócio e um trabalho correspondente na OS.
2. No separador Relatórios, usar Iniciar ou Continuar. A saída da OS usa a mesma fila de relatórios pendentes.
3. Guardar rascunho para continuar noutra sessão. A conclusão exige identificação, trabalhos, resultado e assinatura do técnico autorizado; registar assinatura, ausência ou recusa do cliente.
4. Consultar o documento emitido no histórico da OS/cliente/instalação. A pré-visualização abre dentro da app, com botão de fechar; Imprimir / Guardar PDF usa o documento completo.

AVAC inclui cinco intervenções: manutenção, instalação/arranque, recarga, filtros/condutas e diagnóstico, com anexos de refrigerante e plano de manutenção quando aplicáveis. A recarga abre a ficha de gases fluorados. Não calcula obrigações ou prazos legais automaticamente.

Limpezas inclui zonas e tarefas, métodos, produtos, diluição, contacto, biocida, proteção, resíduos e verificação final. Desinfeção exige identificar produto, diluição, contacto e autorização/registo.

Eletricidade inclui quadro/instalação, circuitos, proteções, instrumentos, tensão, terra, isolamento, diferencial, continuidade, ensaios, anomalias e medidas tomadas. É um registo técnico; não emite certificação ou inspeção oficial.

## Persistência e permissões

Usa `relatorios_especialidade`, `config_series_relatorio` e a RPC de numeração existentes. Os campos estruturados ficam em `campos.avac`, `campos.limpeza` e `campos.eletricidade`; o documento congelado fica em `campos.htmlSnapshot`. Fotografias comprimidas (até quatro), legendas e assinaturas persistem com o relatório. Só é mostrado sucesso depois de o servidor devolver o ID gravado. A atualização exige que o relatório continue em rascunho. A cache local e o snapshot de sincronização são atualizados após a confirmação.

Preserva empresa, atribuição da OS, responsável, permissões negadas, autorização para assinar e validade da licença. As políticas restritivas de área não concedem acesso adicional a linhas. Os relatórios históricos mantêm-se consultáveis mesmo que a área mude.

A base de dados é partilhada com produção: a migração apenas aceita os novos tipos e acrescenta condições de área para a sua escrita. O frontend e o deploy desta alteração destinam-se exclusivamente ao repositório Testetg.

## Validação em 30/10/2026

- Testes de formulários, persistência simulada, reabertura a partir de JSON, fotografias, assinaturas, validações e isolamento de empresa.
- Regressões de relatórios por equipamento, fila de conclusão da OS, nome fiscal e carregamento das entradas web/PWA.
- Transações reais com papel `authenticated`: reserva de número, inserção de rascunho, releitura JSON e conclusão de RAVAC/RLIM/RELE. Todas revertidas; não deixaram documentos nem consumiram números.
- Testes de negação por área para RLIM/RELE igualmente revertidos.
- Verificação visual em navegador e numa janela de 390 × 844 px com dados fictícios. A pré-visualização usa o leitor da app. Não foi simulada uma assinatura de um cliente real.
