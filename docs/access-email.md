# Acesso, instalação e emails

- `login.html` é gerado a partir de `index.html` e `templates/login-content.html`. Depois de alterar o shell da aplicação no index, executar `python3 scripts/build-login.py` e incluir login.html no commit.
- A autenticação existente é partilhada, incluindo email, NIF, recuperação e sessões ativas. Não é necessário terminar a sessão para abrir a app instalada.
- O manifesto abre login.html. Instalações antigas que abram index são encaminhadas preservando parâmetros e tokens. A identidade da PWA mantém-se.
- Android usa o pedido nativo quando disponibilizado pelo navegador e exige confirmação. Na ausência do evento, mostra instruções. iPhone abre o login e apresenta três passos no Safari.
- Os 14 modelos ativos de super-function partilham estrutura de tabelas, título, pré-visualização, contactos e links alternativos aos botões. Dados bancários continuam a vir do servidor.
- Corrigido recuperar-password-cliente: nomes de campos e tipo compatíveis com o remetente, destino da recuperação e diagnóstico HTTP sem expor tokens. Mantém resposta genérica e verificação de NIF/email/portal ativo.
- Não foram enviados emails reais durante os testes. A renderização foi validada no browser; não foi feita uma matriz de clientes Outlook/Gmail/iOS.
- Funções antigas/alternativas não usadas pelo fluxo atual não foram alteradas. Foi detetado também um pedido_renovacao_novo sem destinatário no cliente; requer revisão própria do encaminhamento interno.
