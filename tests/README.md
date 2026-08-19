# Suite de testes E2E — AVANTE Catálogo Digital

10 arquivos Playwright cobrindo a revista (flipbook, único modo do site), busca de
produto pelo índice, carrinho/orçamento, IA vendedora (chat), painel admin
(`crm/crm_dashboard.html`), PIN gate, splash, tema escuro, menu e pedido de visita.

Como rodar:

```bash
npm install -g playwright   # ou: npm install playwright (local ao projeto)
npx playwright install chromium   # baixa o Chromium do Playwright, se ainda não tiver

# sirva a raiz do projeto (o repo inteiro, não só catalogo/) numa porta local
python3 -m http.server 8099 --directory /caminho/pra/avante

# em outro terminal, na pasta tests/
for f in test_*.js; do node "$f"; done
```

Cada arquivo já assume o servidor em `http://localhost:8099`. Se o Playwright estiver
instalado num caminho customizado (como acontece em alguns sandboxes), defina
`PW_CHROMIUM_PATH=/caminho/pro/chrome` antes de rodar — sem a variável, ele usa o
Chromium padrão baixado pelo `playwright install`.

## Sobre o modo único (Revista)

O site voltou a ter só um modo — a revista/flipbook — depois de o Catálogo Rápido
(grade de produtos) ter sido removido. A busca por produto (nome/marca/código) que
antes vivia no Catálogo Rápido agora mora dentro do índice (`#tocBtn` → `#tocSearch`),
testada em `test_revista2.js` e `test_new_features.js`.

## Rodando depois de qualquer mudança visual/de dados

Sempre que mexer em `catalogo/js/app.js`, `catalogo/css/style.css`,
`catalogo/data/products.json` ou nas fotos de produto, rode a suite inteira de novo
antes de considerar a mudança pronta — é o "Definition of Done" do PADROES-AGENCIA.md
(seção 3.3).
