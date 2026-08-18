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

## 2. PIN de acesso (proteção de demo)

Pra ninguém cair na demo por acaso antes da hora, o catálogo e o admin pedem um
código de 4 dígitos antes de mostrar qualquer coisa: **4546**

- Liberar um libera o outro também (mesmo link/domínio).
- Quer mandar um link que já entra sozinho pro cliente, sem ele digitar nada?
  Manda assim: `https://SEU-PROJETO.vercel.app/catalogo/?pin=4546`
- Pra trocar o PIN: abra `shared/pin-gate.js`, linha `var PIN = '4546';`, troque
  o número e suba de novo.

**Importante:** isso é só uma cortina simples pra demo, não é segurança de
verdade (o código fica visível pra quem abrir o "ver código-fonte" da página).
Quando o projeto for pra produção com domínio final, é só apagar as duas tags
`<script src="/shared/pin-gate.js"></script>` (uma no `catalogo/index.html`,
outra no `crm/crm_dashboard.html`) e a pasta `shared/` inteira.

## 3. Login do painel admin (depois de passar o PIN)

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
