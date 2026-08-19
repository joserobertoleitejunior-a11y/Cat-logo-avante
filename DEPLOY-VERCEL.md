# Como subir essa pasta no Vercel (demo pro cliente)

## 1. Subindo

O conteúdo do zip já está pronto pra virar a raiz de um projeto Vercel — é só
arrastar/soltar no dashboard (New Project → Deploy) ou usar o CLI (`vercel`
dentro dela). Não precisa de build step, é tudo estático.

**Atenção — isso não é só convenção, é obrigatório:** a pasta do catálogo
PRECISA se chamar exatamente `catalogo` na raiz do deploy, e a pasta
`shared/` PRECISA existir do lado dela. O `catalogo/index.html` carrega CSS,
JS, imagens e o PIN gate por caminhos absolutos (`/catalogo/css/style.css`,
`/shared/pin-gate.js` etc.) — isso foi uma correção de um bug real que
quebrou o primeiro deploy (com caminho relativo, a página abria sem estilo
nenhum quando o navegador não tinha a barra final na URL). Se renomear a
pasta ou mudar a estrutura, esses caminhos absolutos vão quebrar de novo.

Depois de publicado, o link vai ficar mais ou menos assim:
`https://SEU-PROJETO.vercel.app/catalogo/` → catálogo digital (o que o cliente vê)
`https://SEU-PROJETO.vercel.app/crm/crm_dashboard.html` → painel admin (só pra vocês)

## 2. Acesso

O catálogo é público — sem senha, sem PIN. Só o painel admin pede login (a
pasta `shared/` e o PIN de demonstração foram removidos quando o projeto foi
pro ar de verdade).

## 3. Login do painel admin

Ainda é só front-end (sem backend real por trás), então serve pra demonstração,
não pra dado sensível de verdade:

| Vendedor  | Senha    |
|-----------|----------|
| Marcos    | 1234     |
| Fernanda  | 1234     |
| Diego     | 1234     |
| Admin     | admin123 |

## 4. O que ainda é placeholder nessa demo

- As tags de SEO (canonical, Open Graph) apontam pro domínio final
  `catalogo.avantedistribuicao.com.br`, que ainda não existe — não afeta a demo,
  só importa quando for pro domínio de verdade.
- Não tem backend/Supabase ainda: pedidos de visita, cadastro de cliente etc.
  ficam salvos só no navegador de quem está usando (localStorage), não em nuvem.
