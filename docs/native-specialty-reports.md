# Modelos nativos de especialidade — TesteTG

São 14 modelos completos com folhas, secções, campos e perguntas já elaborados, usando o mesmo iframe/leitor e fluxo de relatórios de CCTV e intrusão. O técnico não precisa de configurar modelos personalizados.

| Área | Modelos incluídos |
| --- | --- |
| AVAC (RAVAC) | Manutenção de ar condicionado; instalação e colocação em serviço; recarga de gás; limpeza de filtros/condutas; diagnóstico de avaria |
| Limpeza (RLIM) | Limpeza regular; limpeza profunda; limpeza pós-obra; desinfeção |
| Eletricidade (RELE) | Instalação elétrica; verificação técnica/preparação para inspeção; quadro elétrico; iluminação; avaria elétrica |

## Funcionamento na OS

O tipo de trabalho escolhido na OS determina a folha que abre. Se a OS contiver vários trabalhos da mesma área, a folha reúne as secções dos trabalhos selecionados. As áreas de negócio continuam a controlar a disponibilidade das especialidades.

O cabeçalho recebe os dados disponíveis da empresa, nome fiscal, logótipo, cliente, instalação/morada, OS, data e técnico. A identificação de equipamento é preenchida quando existe um equipamento associado ao relatório, ou quando existe exatamente um equipamento nessa instalação configurado com esse tipo de relatório.

Cada modelo contém verificações numeradas com OK / NÃO OK / N/A, observação por verificação, campos de identificação e medições próprios da intervenção, trabalhos realizados, materiais, anomalias, resultado, fotografias e assinaturas. As respostas de conformidade e os valores medidos nunca são inventados nem copiados de uma visita concluída anterior.

Ao concluir é necessário responder às verificações, registar os trabalhos e o resultado, assinar com um perfil autorizado e registar a receção/ausência/recusa do cliente. Respostas NÃO OK exigem observações. Os relatórios de eletricidade documentam os ensaios e trabalhos; não emitem certificação ou inspeção oficial.

## Persistência

Usa `relatorios_especialidade`, a numeração RPC e o histórico existentes. `campos.estadoNativo` conserva os valores e respostas; `campos.htmlSnapshot` conserva a folha. O rascunho mantém campos editáveis e as assinaturas/fotografias. A folha concluída fica congelada, com os resultados e assinaturas visíveis, pronta a imprimir/guardar em PDF. Guardar/concluir só fecha o editor depois da confirmação do servidor. Falhas mantêm o editor aberto com opção de repetir.

Uma alteração posterior aos trabalhos da OS carrega a folha atual e restaura os campos compatíveis do rascunho dessa OS. Rascunhos do editor anterior são preservados no registo ao serem convertidos. Os documentos históricos emitidos mantêm-se consultáveis.

## Fontes do código

- `tg-specialty-models.json`: os 14 conjuntos de perguntas/campos elaborados.
- `templates/native-specialty.html`: folha base no estilo CCTV/intrusão.
- `templates/native-specialty-runtime.js`: preenchimento, fotografias, assinaturas e snapshot no iframe.
- `templates/native-specialty-host.js`: seleção do modelo, contexto/permissões, gravação confirmada e registo no catálogo nativo.
- `scripts/build-specialty-models.py`: gera `tg-specialty-templates.js`, carregado nas entradas web/PWA e incluído na cache offline.

A migração aditiva dos tipos RLIM/RELE e condições de área foi aplicada no trabalho anterior à base partilhada. Esta revisão dos modelos não altera o esquema nem os dados de clientes. O frontend de produção não foi alterado. A publicação no TesteTG continua pendente da autorização explícita solicitada após o bloqueio automático do envio para main.

## Verificações

Testes dos 14 modelos; seleção por código/rótulo; composição de vários trabalhos; preenchimento automático; conservação de perguntas sem respostas automáticas; reabertura do rascunho com fotografias/assinaturas sem duplicar secções; conclusão e PDF; gravação confirmada dos três tipos; restrições de acesso; entrada real `_abrirModalRelatorioEspecialidade` e regressões do fluxo CCTV/intrusão. Verificação visual de folhas em desktop e 390 px com dados fictícios.
