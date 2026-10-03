# Relatórios operacionais

O card existente `relatorio-os` passa a chamar-se Relatórios. Mantém o identificador para preservar navegação, favoritos e permissões. Abre sete opções: OS, Assistências, Clientes e locais, Técnicos e equipas, Obras, Manutenções e contratos, Stock e materiais. Documentos de especialidade e personalizados não são consultados por esta área.

Os relatórios são calculados a partir dos dados já carregados na aplicação. Não há alterações de esquema, envios de email ou escrita de registos. Pré-visualização de até 100 linhas por tabela; PDF e Excel incluem todas as linhas filtradas. Exportações incluem período, filtros, resumo e indicação da base de cálculo. PDF utiliza o cabeçalho e rodapé existentes da empresa.

A cada consulta/exportação são revalidadas licença, papel, permissões negadas, cards disponíveis e módulos pagos. Admin/subadmin: informação da sua empresa. Encarregado: OS atribuídas a si, à sua equipa ou a Todos, e atividade dos membros da equipa. Os novos relatórios de gestão não são disponibilizados a funcionários/clientes.

Datas: OS pela data agendada; assistências pela criação; obras pelo início previsto ou criação; contratos pela próxima manutenção; registos realizados pela data de realização. Horas: folhas de obra no período, sem usar duração prevista como trabalho realizado. A sede é uma localização separada de cada instalação. Stock: saldo atual com todos os movimentos e movimentos do período em tabela distinta; não somar unidades de artigos distintos. Uma OS com vários técnicos conta para cada pessoa, com um resumo de OS únicas separado. Não se estima tempo de resolução de assistência a partir da última modificação, porque esse campo não é uma data de fecho fiável.

Verificação:
- `node --test tests/reports.test.cjs tests/tg-smart.test.cjs`
- `JSDOM_PATH=.../jsdom node tests/reports-ui.test.cjs`
- `node --check app-principal.js`, `tg-reports-engine.js`, `tg-reports-ui.js`, `sw.js`
- Gerar login após alterações ao index: `python scripts/build-login.py`.
