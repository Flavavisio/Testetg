# Revisão mobile e SEO — 2026-10-03

## Alterações publicadas em Testetg
- Escala interna de 100% em ecrãs até 900px ou dispositivos de toque; a preferência do computador é preservada. Ao mudar de equipamento/orientação, a escala é recalculada. O zoom manual do navegador permanece disponível.
- Campos de escrita com 16px em mobile, incluindo campos com estilos inline; texto sem ampliação automática pelo browser. Correção de larguras mínimas no onboarding, pré-visualização de relatórios e formulário de registo.
- Título e descrição da homepage orientados a assistências/equipas, preservando o título visível pedido pelo proprietário.
- Canonical e identidade da organização uniformizados em https://www.totalgest.pt/. Removida oferta estruturada de preço zero que podia sugerir produto gratuito em vez de teste.
- Organização, website e software descritos em JSON-LD sem avaliações inventadas.
- Guias existentes ligados a partir da homepage e links do blog compatíveis com o subdiretório Testetg.
- Sitemap com páginas públicas e datas reais da alteração; login e confirmação fora dos resultados por noindex (robots.txt permite rastrear para ler a instrução).

## Bloqueio para beneficiar o domínio principal
Em 03/10, www.totalgest.pt respondeu 200 mas serviu HTML diferente do testetg (sem access.css?v=2). O domínio sem www redirecionou para www. Publicar no Testetg não comprova atualização de www.totalgest.pt. Confirmar o alojamento/repositório efetivamente ligado ao domínio e promover a versão testada. Não alterar DNS sem identificar esse destino.

## Próximos passos por prioridade
1. Promover a versão testada para o alojamento do domínio principal.
2. Verificar a propriedade totalgest.pt no Google Search Console (DNS ou método disponibilizado). Submeter https://www.totalgest.pt/sitemap.xml e inspecionar a homepage e os artigos. Requer acesso à propriedade ou ao DNS; não realizado nesta revisão.
3. Consultar indexação, termos de pesquisa e Core Web Vitals para priorizar dados reais. Não há garantia de posição nem de prazo de indexação.
4. Publicar páginas úteis e distintas de solução para assistências técnicas, manutenção AVAC e segurança eletrónica, com fluxos reais e ligações a funcionalidades/preços. Evitar páginas repetidas só para palavras-chave.
5. Acrescentar casos de clientes com autorização, fotografias reais e resultados comprovados. Promover os guias através dos canais próprios e parceiros.
6. Reduzir o carregamento público: o index ainda transporta o shell e JavaScript da aplicação autenticada. Separar o bundle público é uma melhoria posterior de arquitetura, a medir antes/depois.

Documentação: https://developers.google.com/search/docs/fundamentals/seo-starter-guide e https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap.
