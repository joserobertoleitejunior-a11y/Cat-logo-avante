# Suite de testes E2E — AVANTE Catálogo Digital

12 arquivos Playwright, ~90 verificações, cobrindo revista (flipbook), catálogo rápido,
carrinho/orçamento, IA vendedora (chat), painel admin (`crm/crm_dashboard.html`), PIN
gate, splash, tema escuro, menu, filtros, transição entre modos e pedido de visita.

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

## Observação importante pra quem for mexer no default de visualização

`test_splash.js`, `test_drag_from_hotspot.js`, `test_fitbook_bug.js` e `test_revista2.js`
clicam em `#modeBookBtn` antes de testar qualquer coisa específica do modo Revista
(flipbook), porque o modo padrão de abertura do site é o Catálogo Rápido (grade de
produtos), não mais a revista escaneada. Se esse padrão mudar de novo no futuro, esses
4 arquivos são os que precisam de ajuste.

## Rodando depois de qualquer mudança visual/de dados

Sempre que mexer em `catalogo/js/app.js`, `catalogo/css/style.css`,
`catalogo/data/products.json` ou nas fotos de produto, rode a suite inteira de novo
antes de considerar a mudança pronta — é o "Definition of Done" do PADROES-AGENCIA.md
(seção 3.3).
