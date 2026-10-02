# Portal do cliente final — navegação v2

Menu próprio: Início, Serviços, Instalações, Documentos, Contratos e Pedidos.
Em PC usa navegação lateral; em telemóvel mostra as seis opções numa grelha.
O Início destaca próximas visitas, serviços por concluir, folhas por assinar
 e pedidos por aprovar. Obras continuam disponíveis em Serviços quando o
módulo correspondente está ativo. Instalações mantém o histórico existente.

Documentos reúne folhas de obra/assinaturas/PDF e faturas Moloni e TOConline
já registadas na aplicação. Não apresenta faturas PHC simuladas como documentos
reais. Pesquisa por texto nas tabelas de Serviços, Documentos e Contratos.
O separador e pesquisa são mantidos nas atualizações da mesma sessão e limpos
quando muda o utilizador. Ações de assistência, assinatura e PDF são reutilizadas.

As listagens são limitadas ao cliente e à empresa autenticados. A renderização
assíncrona é descartada se a sessão mudar. Folhas e faturas passaram a verificar
explicitamente a empresa; links de documentos aceitam HTTPS sem credenciais.
Isto complementa, não substitui, a autorização de servidor e as políticas RLS.

Validação: teste Chromium com dados sintéticos, incluindo navegação, pesquisa,
retenção da secção, acesso às ações existentes, duas origens de faturação,
separação entre clientes, logout durante carregamento e largura móvel.

Executar com Playwright instalado:
`node tests/portal-client-browser.cjs`
Opcional: CHROMIUM_EXECUTABLE_PATH indica um Chromium local;
TG_TEST_SCREENSHOTS indica a pasta de capturas (por defeito /tmp).

Não foram usados logins reais nem alterados dados de clientes nos testes.
