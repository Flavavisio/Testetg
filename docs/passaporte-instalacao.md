# Passaporte de Instalação

Na ficha do cliente, abrir **Instalações** e escolher Sede ou um local existente. A lista de Locais conserva a sua função e acrescenta um atalho Passaporte. Nas OS e nos cartões da agenda dos técnicos, **Consultar instalação** abre a mesma ficha adaptada ao telemóvel.

A ficha reúne fotografia do local, acesso, armário técnico, contacto, pendências, notas, equipamentos com nome/modelo/foto/IP/porta/cabo/estado, documentos/esquemas e as OS do local. A última OS fornece as fotografias; o relatório técnico acrescenta problema, verificações, trabalho realizado, resultado e informação para o próximo técnico. **Imprimir / PDF** abre a versão de impressão, com fotografias, para guardar em PDF através do navegador.

Nova intervenção usa o formulário de OS existente, com cliente e local preenchidos. Não cria outra tabela de intervenções nem altera o fecho das OS. As fotos, folhas de obra, checklists, relatórios de especialidade e histórico atual permanecem nos seus fluxos existentes.

Equipamentos novos recebem `cliente_id`, para identificar corretamente equipamentos na Sede sem contrato. Equipamentos antigos são localizados através do local ou contrato existente, sem reatribuição automática. A leitura dos equipamentos e documentos associados a contratos continua dependente da licença de Contratos. Equipamentos diretamente associados ao cliente no passaporte são consultáveis na ficha.

Dados adicionais, todos opcionais: `clientes.passaporte_tecnico` (Sede), `locais.passaporte_tecnico`, `equipamentos.ficha_tecnica`, `equipamentos.cliente_id`, `servicos.passaporte_intervencao`. Os mapeadores omitem propriedades ausentes, evitando regravar dados antigos só por esta atualização. SQL reproduzível: `docs/sql/passaporte-instalacao.sql`. As tabelas conservam as suas políticas de RLS; não se criaram tabelas, funções privilegiadas ou permissões públicas adicionais.

Admin e subadmin gerem fichas/equipamentos. Técnicos e encarregados consultam instalações das OS em que estão atribuídos e podem preencher o suplemento técnico das suas OS em aberto. Uma ligação de consulta é um deep link autenticado; não é uma partilha pública. Fotografias/documentos usam o Storage existente. Não guardar credenciais nas notas.

Consulta do arquivo é paginada por empresa/cliente. Abrir uma OS antiga adiciona um snapshot limpo à memória, sem provocar gravações. Falhas de consulta mostram aviso e botão de nova tentativa. Gravações usam a sincronização existente; offline, a confirmação distingue cópia local de sincronização confirmada.

## Validação em 8 de outubro de 2026

Antes/depois dos novos campos, contagens e somas de hashes de todas as colunas anteriores coincidiram: 1571 clientes, 65 locais, 75 equipamentos e 137 OS. Nenhum registo de produção foi criado, editado ou eliminado para demonstrar a interface. Os campos novos permanecem vazios até serem preenchidos pelos utilizadores.

`tests/passport.test.cjs` verifica atribuição cliente/local, isolamento de empresa, acesso por técnico, dados antigos, snapshots, filtros, URLs seguras, gravação/repetição sem duplicação, preservação de checklists/fotos/estado, respostas tardias, falhas do arquivo e conversão dos novos campos. Testes usam dados fictícios.

A suite de navegação antiga `tests/navigation-logic.test.cjs` já tem três falhas no commit-base `412e70e` (subabas, resposta tardia e retorno às subabas). Não foram introduzidas pelo passaporte. O linter de Supabase apresenta avisos anteriores em funções/tabelas não alteradas; as quatro tabelas utilizadas têm RLS ativo e políticas de isolamento existentes. Referência: https://supabase.com/docs/guides/database/database-linter.

Teste visual e funcional em Chromium com dados fictícios: vista de computador (1440 px), telemóvel (390 px), entrada pelo separador real da ficha do cliente, pesquisa de equipamentos, gravação do relatório, regresso ao histórico atual, permissões do funcionário e ausência de scroll horizontal. Sem erros JavaScript. `tests/passport-browser.cjs` aceita `CHROMIUM_BINARY` e `TG_CHROMIUM_ARGS` para ambientes com navegador próprio.

50 testes das suites passaporte, histórico/Foco, módulos integrados, login/logout, relatórios, portal e assistente passaram. O teste de módulos integrados em jsdom emite uma exceção no observer ao encerrar a janela; a suite termina com sucesso e não foi alterada por esta implementação.
