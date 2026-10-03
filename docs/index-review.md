# Revisão do index — Total Gest

Atualização: 3 de outubro de 2026. Âmbito: página pública, navegação, apresentação dos packs, escolha guiada e formulários de acesso/registo. O dashboard autenticado e os preços base dos packs mantêm-se.

## Problemas encontrados e alterações

- Apresentação inicial duplicada e treze cartões de funcionalidades com informação repetida. Substituídos por uma apresentação curta, três passos de trabalho e seis áreas expansíveis.
- Acesso à conta misturado com aquisição de uma nova licença. Acesso separado, com indicação de email para empresa/equipa e NIF para portal do cliente.
- “Ligue agora” abria WhatsApp; “Entrar / Pedir acesso” abria registo; “Fala connosco” abria registo. Os rótulos e destinos passam a corresponder à ação.
- Duas calculadoras com preços diferentes dos packs, pressuposto não validado de poupança de 70% e falha ao escolher Assistências (chave ausente). Substituídas por uma escolha guiada baseada nos packs atuais.
- Alternância mensal/anual sem tratamento de clique. Mostra agora os valores e a periodicidade; o anual abre uma proposta no WhatsApp, com pack, capacidade e valor preenchidos.
- “Mudar” no registo apontava para um elemento inexistente. Aponta agora à comparação de packs.
- Blog usava `/blog/`, incompatível com publicação num subdiretório. Passa a `blog/`.
- Menu desaparecia no telemóvel. Adicionado botão de menu, estados acessíveis e fecho com Escape.
- Estilos globais antigos acrescentavam molduras às imagens e centravam texto. Isolamento visual da página pública, incluindo Toto sem moldura.
- Removidos textos que sugeriam funcionalidades sem limites ou faturação automática universal. A integração depende de compatibilidade e configuração.

## Mapa dos botões e ligações

| Controlo | Ação implementada |
|---|---|
| Logótipo | Volta ao início da página. |
| Menu (telemóvel) | Abre/fecha a navegação. Fecha após escolher um destino ou carregar em Escape. |
| Como funciona / Ver como funciona | Mostra os três passos da operação. |
| Funcionalidades | Vai às seis áreas; cada título expande a descrição e a disponibilidade por pack. |
| Planos e preços / Veja os planos | Vai à seleção de dimensão da equipa e aos packs. |
| Dúvidas | Vai às perguntas frequentes; cada pergunta expande a resposta. |
| Contactos / Fale connosco | Vai aos contactos no rodapé. |
| Entrar | Vai ao formulário e foca o campo email/NIF. |
| Entrar (formulário) | Usa o mecanismo de autenticação existente com os campos preenchidos. |
| Recuperar palavra-passe | Reutiliza a recuperação existente para a identificação introduzida. |
| Experimentar 14 dias grátis / Experimentar grátis (genérico) | Abre o registo de conta de teste. |
| Ampliar a plataforma | Abre uma imagem ampliada da interface, identificada como exemplo; não é uma sessão de demonstração. |
| Fechar imagem / Escape | Fecha a imagem e devolve o foco. |
| Mensal / Anual | Atualiza todos os packs, unidades de cobrança e ação dos botões. Anual: total anual com desconto de 10%, com IVA e equivalente mensal. |
| Até 5 / 10 / 25 / 50 | Atualiza o preço de todos os packs e preserva a periodicidade selecionada. |
| Comparar funcionalidades | Abre a tabela completa e realça o pack escolhido; novo clique ou × fecha-a. |
| Experimentar grátis (pack mensal) | Abre o registo com o pack e escalão selecionados. |
| Pedir proposta anual | Abre WhatsApp com pack, capacidade e total anual. Não envia a mensagem automaticamente nem ativa uma licença. |
| Ajudar a escolher | Abre três passos: dimensão, necessidades e recomendação. |
| Opções de funcionários / campo numérico | Define a equipa; só aceita inteiros positivos até 10 000. |
| Necessidades | Sugere o primeiro pack que cobre todas as áreas escolhidas. Assistências conduz pelo menos ao Pro. |
| Seguinte / Ver recomendação / Voltar | Navega no assistente mantendo as escolhas e valida a dimensão. |
| Experimentar este pack | Transfere pack, escalão e blocos extra para o registo. Procura a configuração de menor preço dentro das regras atuais. |
| Mais de 100 funcionários | Apresenta pedido de proposta; não inventa um preço acima da capacidade pública. |
| Mudar (no registo) | Fecha o registo e regressa aos preços. |
| Escalões e +/− blocos (no registo) | Atualizam capacidade e total mensal, até 100 funcionários. |
| Mostrar/ocultar palavra-passe | Alterna a visibilidade do respetivo campo e atualiza o rótulo acessível. |
| Criar conta de teste | Usa a criação de conta existente, com validação e confirmação de email. |
| × / Escape / fundo dos diálogos | Fecha o diálogo público e devolve o foco ao controlo anterior. Tab permanece no diálogo. |
| Blog | Abre o blog relativo à instalação atual. |
| Email / telefone / WhatsApp | Abre a aplicação correspondente com o contacto da Total Gest. |

## Verificação e limites

Teste automatizado com HTML/CSS/JS reais da página pública e autenticação simulada: preços partilhados com a aplicação, valores anuais, seleção de pack, blocos, recomendação de Assistências, dimensões inválidas e superiores a 100, comparação, âncoras, encaminhamento do login/recuperação, imagem ampliada, teclado e menu mobile. Verificados ecrãs de 320, 390, 768, 1024 e 1440 px e capturas visuais.

Não foram criadas contas reais, enviadas mensagens nem efetuados pagamentos nos testes. A contratação anual é um pedido de proposta, sem novo processo de cobrança automática. O registo e a autenticação continuam a utilizar o serviço existente.
