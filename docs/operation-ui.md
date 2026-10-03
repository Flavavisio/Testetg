# Primeira revisão do uso diário

- Menu sidebar organizado por grupos recolhíveis, com pesquisa sobre opções já autorizadas. Os módulos bloqueados continuam excluídos pela lógica existente.
- Painel inicial com serviços de hoje, em atraso e OS com relatórios em rascunho. Pedidos abertos do portal e assistências de prioridade alta/urgente abrem a ficha do cliente na área de Assistências.
- Listas limitadas ao administrador da empresa ou à equipa/atribuição do técnico; sem acesso de cliente, vigilante ou superadmin a este painel operacional.
- OS com atalhos para entrada/saída pessoal quando aplicável, folha de obra, materiais, fotos, relatórios e conclusão através do fluxo existente. Não substitui validações, assinatura, checklist ou confirmação de conclusão.
- A entrada/saída não aparece no Express; a conclusão não é oferecida ao funcionário.
- Não há migração de dados nem nova persistência. Integrações PHC, autonomia offline completa e separação dos bundles do site são trabalhos posteriores.

Validação: tests/operation-ui.test.cjs verifica limites da empresa/equipa, módulos, prioridades, pesquisa, texto escapado e ações permitidas. Verificação no Chromium em 320/390/768/1024px sem overflow.
