# Teco — assistente local

Nome atualizado na mascote, conversa e apresentação pública. A imagem mantém-se a mesma.

Novas consultas: pedidos do portal em aberto, assistências de prioridade alta/urgente, relatórios em rascunho por concluir/assinar, OS por cliente/número, pesquisa de stock por artigo e instruções sobre os fluxos existentes. Resultados de OS incluem cliente e morada quando preenchidos.

Botões abrem os primeiros registos encontrados (OS, cliente, assistência e relatórios). A disponibilidade é validada novamente no clique com os dados/permissões atuais. Não altera registos nem conclui trabalho automaticamente.

Os avisos proativos passam a indicar o primeiro assunto concreto por tratar. Pode silenciar durante uma hora. Dados limitados à empresa, equipa/atribuição e módulos disponíveis; conversas não são enviadas para serviços externos nem persistidas.

É um assistente de regras e consultas locais, sem custos de IA. Não equivale a um modelo generativo e não pesquisa informações externas. Mostra os dados já carregados na aplicação; não inventa respostas quando não tem acesso.

Validação: tests/tg-smart.test.cjs e tests/teco-ui.test.cjs (incluindo isolamento, licenças, pesquisas, abertura direta e acesso revogado entre consulta e clique).
