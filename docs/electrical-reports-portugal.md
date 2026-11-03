# Relatórios de eletricidade — Portugal

Verificação das fontes: 3 de novembro de 2026.

Cada trabalho RELE tem modelo, rascunho, assinatura, número e estado próprios:

- Instalação elétrica.
- Verificação técnica / preparação para inspeção (código histórico `Certificação elétrica`). Os rótulos antigos continuam a ser reconhecidos; o relatório técnico não emite uma certificação de uma EIIEL.
- Quadro elétrico.
- Iluminação.
- Avaria elétrica.
- Relatório de exploração (DGEG).

## Modelo de exploração

O modelo atualmente publicado pela DGEG tem quatro páginas e foi aprovado pelo Despacho n.º 31/2026, de 16 de abril. A identificação impressa no documento é `DGEG.DSEE.Mod_Relatorio_v2024`; esta identificação não deve ser confundida com a data do despacho de aprovação. O antigo Anexo III-3 não é usado para emitir os novos documentos.

O formulário digital inclui a divisão da DGEG; período e responsabilidade; promotor; técnico e registos; local; identificação e características A/B/C, NIP, CPE, PTC, potências PT1–6/GG1–6 e equipamentos adicionais; medições sazonais das terras; dielétricos; continuidade; grupos geradores de socorro e segurança; BT, isolamento, tensão de ensaio, fator de potência e diferenciais; os 23 pontos de verificação 6.1–6.23; observações 6A; UPAC/PCVE e outras instalações relacionadas; modificações; relações com o proprietário; anexos e assinatura.

`templates/dgeg/relatorio-exploracao-31-2026.pdf` é a cópia integral, inalterada, do PDF publicado pela DGEG. `templates/dgeg/relatorio-exploracao-map.json` localiza os campos a preencher. O exportador conserva as quatro páginas originais, usa os resultados efetivamente introduzidos, identifica NA apenas quando declarado pelo técnico e acrescenta anexos para texto longo, instrumentos, limitações e fotografias. C/NC/NA correspondem às respostas explícitas OK/NÃO OK/N/A; não existem aprovações nem medições automáticas.

O PDF de consulta antes da conclusão tem a marca RASCUNHO. Ao concluir, o PDF do modelo DGEG é preparado com o número definitivo e guardado no snapshot, onde pode ser descarregado posteriormente sem voltar a gerar valores. A folha editável e as assinaturas continuam preservadas no estado do rascunho. A empresa e o nome fiscal constam do rodapé dos documentos e anexos da TG.

## Validação e responsabilidade

O formulário exige identificação do técnico, um registo DGEG/OE/OET, declaração da habilitação aplicável, correspondência entre responsável e assinante, período coerente, NIF com nove algarismos, classificação A/B/C e PTC para tipo B. Estes controlos verificam o preenchimento: não consultam nem validam automaticamente registos profissionais ou a adequação da habilitação à potência/tensão concreta.

As medições inexistentes não são inventadas. Quando não realizadas, o técnico regista a limitação e a justificação na parte aplicável. As não conformidades devem ser descritas em 6A. As obrigações de inspeção, correção de deficiências, assinatura e registo dos atos no SRIESP permanecem com os intervenientes legalmente responsáveis; o sistema não submete documentos no SRIESP.

Os cinco modelos técnicos de intervenção incluem referências às RTIEBT, DL 96/2017 e Lei 14/2015. O modelo de instalação inclui referências de arquivo da ficha de execução atual e da declaração/termo de responsabilidade, sem se apresentar como substituto destes documentos.

## Fontes primárias

- [Despacho DGEG 31/2026 e anexos](https://www.dgeg.gov.pt/pt/destaques/despacho-n-%C2%BA-31-2026/).
- [Anexo I — Relatório de exploração, quatro páginas](https://www.dgeg.gov.pt/media/nplnli53/anexo-1.pdf).
- [Anexo II — Ficha de execução](https://www.dgeg.gov.pt/media/51ddykce/anexo-2.pdf).
- [DL 96/2017, texto consolidado](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/2017-107989053): artigos 7.º, 15.º, 16.º e 21.º.
- [Lei 14/2015](https://diariodarepublica.pt/dr/detalhe/lei/14-2015-66528823): entidades e profissionais responsáveis.
- [RTIEBT, Portaria 949-A/2006 e alterações](https://diariodarepublica.pt/dr/legislacao-consolidada/portaria/2006-70055500): verificações e ensaios, manutenção e segurança.
- [DGEG — Exploração e averbamentos](https://dgeg.gov.pt/pt/areas-setoriais/energia/energia-eletrica/instalacoes-eletricas-de-servico-particular/procedimentos-e-controlo-das-instalacoes/exploracao-e-averbamentos/).

## Dependências e verificações

PDF-Lib 1.17.1, fontkit 1.1.1 e Bitstream Vera são distribuídos localmente com as respetivas licenças. As fontes são incorporadas no PDF; não depende das fontes instaladas no dispositivo. Bibliotecas, fontes e modelo DGEG constam da cache offline. Não há alterações de esquema nem migrações.

Os testes cobrem seis rascunhos simultâneos, etiquetas antigas, validação de dados, conservação de assinaturas/fotografias, PDF no modelo original, número definitivo, anexos, gravação confirmada e regressões AVAC/Limpeza/Segurança. A verificação visual usa 1280 e 390 px e renderização do PDF preenchido com dados fictícios.
