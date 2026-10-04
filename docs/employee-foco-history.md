# Foco dos funcionários e histórico do cliente

Os utilizadores com `role=funcionario` usam o layout Foco no computador e no telemóvel. A escolha de layout guardada na empresa continua a aplicar-se aos administradores e subadministradores. Os restantes perfis mantêm o comportamento anterior.

O Foco reutiliza a navegação existente por grupos e o menu móvel lateral. Os cartões ocultos ou bloqueados continuam excluídos. O grupo Equipa passa a chamar-se Funcionário neste perfil. Não há alteração de permissões nem de licenças.

Na ficha do cliente, o separador Histórico reúne OS, assistências, obras, contratos, relatórios e registos comerciais. Os módulos adicionais exigem a respetiva licença. O histórico está limitado à empresa e ao cliente atuais, para administradores e subadministradores com licença base válida. Pesquisa, tipo e intervalo de datas filtram os registos.

As OS arquivadas são obtidas com a consulta paginada existente, filtrada por `admin_id` e `cliente_id`. A consulta não modifica dados; ao abrir uma OS antiga, o registo é acrescentado à memória juntamente com o snapshot, para evitar escritas acidentais. Edições locais prevalecem sobre a resposta do servidor. Se a consulta falhar, aparecem os dados disponíveis e uma opção de tentar novamente.

Esta linha temporal mostra os registos atuais pelas datas disponíveis: a data da intervenção na OS, criação/envio/fecho nos restantes módulos. Não é uma auditoria de todas as alterações feitas a cada registo. CRM e Assistências abrem o respetivo módulo integrado; os restantes botões reutilizam os visualizadores existentes.

O design dos módulos integrados usa cores, campos, botões e tabelas consistentes, com estilos exclusivos do iframe integrado, incluindo modo escuro. Não muda a escolha do layout da empresa. Nenhuma migração de base de dados é necessária.

Validação: `tests/employee-foco-history.test.cjs` verifica perfis e larguras, navegação e restrições, isolamento de empresa/cliente, módulos adquiridos, texto seguro, consulta de arquivo, filtros, snapshots, revogação e respostas tardias. As suites Nexus, módulos integrados, painel de assistências, portal do cliente e faturação cobrem as regressões associadas. Os testes usam dados simulados; não incluem inspeção visual num browser real nem operações na base de produção.
