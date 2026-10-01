# Assistente TG — integração de 1 de outubro de 2026

## Instalação

Substituir os ficheiros do projeto pelos deste ZIP, mantendo a pasta assets.
O index.html mantém o conteúdo original. O app-principal.js carrega o módulo
tg-assistente.js, que carrega os estilos e as imagens locais. Publicar também
os ficheiros novos, não apenas app-principal.js.

Se a PWA apresentar o aviso de atualização, guardar o trabalho e clicar em
Atualizar. O service worker foi versionado sem forçar recarregamentos.

## O que está incluído

- Mascote TG original animada, com transparência e sem moldura.
- Foi usado o conjunto original idle/adeus com tablet. A antiga animação
  sentada tinha fundo visível e não foi usada. Não foi redesenhada a mascote.
- Painel de conversa em português, atalhos e navegação por pedidos escritos.
- Apenas após autenticação, para os perfis internos; oculto no portal do
  cliente e no modo quiosque.
- As ações reutilizam os cartões disponíveis do próprio perfil e os seus
  handlers, conservando as verificações de acesso e licença da aplicação.
- A conversa fica apenas em memória e é apagada ao mudar de utilizador.
- Minimização, fecho por Escape, adaptação ao telemóvel, modo escuro e
  imagem estática para quem usa a preferência de reduzir movimento.
- Sem chamadas a IA externa e sem custos por tokens.

## Limites desta versão

O TG encontra e abre áreas. Ainda não consulta os registos para calcular OS
atrasadas, disponibilidade de técnicos, contratos a vencer ou stock baixo.
Esses pedidos apresentam um encaminhamento explícito para o respetivo módulo.
Não cria, modifica ou elimina registos, nem envia mensagens.

## Ficheiros alterados

- app-principal.js: evento após renderização e carregamento do módulo.
- sw.js: versão da cache.
- Novos: tg-assistente.js, tg-assistente.css, assets/tg-mascote-idle.webp,
  assets/tg-mascote-adeus.webp, assets/tg-mascote-ola.png e este documento.

## Validação

Verificação de sintaxe JavaScript executada nos três ficheiros de código.
Testes DOM passaram: sessão, logout, mudança de conta, quiosque, portal cliente,
permissões, navegação, texto seguro, Escape, minimização e instalação única.
Não foi efetuado login numa conta real nem publicação no site.
A validação visual num navegador não ficou disponível neste ambiente.
