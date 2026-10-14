# Planeamento e Offline — implementação segura (Testetg)
## Planeamento (tg-planner.js)
Motor de recomendações sem efeitos colaterais. Entrada: técnicos, serviços, férias/ausências, intervalo e tenantId.
Exige tenantId, filtra registos de outros tenants, exclui indisponibilidade e conflito de horário, valida competências e indica motivos. **Nunca altera a atribuição da OS.**
Integração futura: mapear os campos reais da aplicação, executar o cálculo sobre dados já autorizados por RLS e exigir confirmação humana e validação no servidor imediatamente antes da gravação. Distâncias/rota e aptidões que não estejam registadas não são inventadas.

## Offline (tg-offline.js)
Persistência IndexedDB de **rascunhos locais apenas**, por tenant e utilizador, mediante ação explícita; não guarda tokens de autenticação. Guardar/consultar/apagar rascunhos. Não sincroniza automaticamente e não edita dados Supabase.
Para ativar criação/fecho de OS completamente offline ainda é necessário:
- autorização e validade de sessão; RLS nunca pode ser contornada;
- filas idempotentes com chave única de operação e versão de registo no backend;
- resolução explícita de conflitos entre técnico e escritório;
- fotografias comprimidas, limites de armazenamento, permissões e quota;
- limpeza no logout/troca de empresa e testes no iOS Safari/PWA;
- confirmar com os utilizadores o risco de dados sensíveis persistirem num dispositivo partilhado.
**Não ativar envio automático sem testes de integração e migração aprovada.**

## SW
O service worker deve cachear **apenas recursos estáticos de mesma origem**. Nunca guardar respostas de API, pedidos autenticados, páginas com dados privados ou URLs com tokens; instalação da nova versão continua manual.
