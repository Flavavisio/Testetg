# TesteTG — materiais no quiosque com agenda

A folha do responsável no quiosque com agenda passa a abrir um modal ao escolher “Sim” em “Usou materiais?”. Mostra o plano da obra atual (também quando se entra por uma OS ligada à obra), com visto e quantidade usada por artigo. Confirmar aplica a seleção; cancelar mantém a última seleção confirmada.

No fim da lista é possível escrever material não planeado ou selecionar um artigo existente. Os artigos novos só são criados ao gravar a folha, sem preços. Os extras ficam identificados no texto da folha, na nota dos movimentos e num registo de informação ao administrador, independente do add-on de push. Os movimentos pertencem à folha para aparecerem no seu detalhe e PDF; o consumo acumulado do plano é atualizado. A quantidade prevista não é alterada.

A agenda diária e o quiosque de obra fixa conservam o comportamento existente. Isolamento por empresa, responsável e ligação OS/obra é revalidado ao confirmar. Uma repetição após falha de sincronização reaproveita a mesma folha e os mesmos movimentos no formulário atual.

## Validação

Oito verificações de lógica executadas num runtime JavaScript hospedado: plano através de OS/obra, isolamento entre empresas, responsável, quantidades, materiais extra, OS avulsa, rejeição de dados inválidos e regravação sem duplicações. Sintaxe completa da aplicação verificada.

Inclui três testes de DOM com jsdom e regressões existentes, configurados no GitHub Actions. A execução real de navegador, gravação autenticada e inspeção visual permanecem pendentes até acesso ao ambiente de testes.

## Publicação

Esta proposta fica numa branch isolada do repositório Testetg. Não altera TG nem faz deploy. Antes de integrar/publicar, confirmar a URL e o destino de testes: o CNAME atual deste repositório contém www.totalgest.pt, também identificado como domínio de produção.
