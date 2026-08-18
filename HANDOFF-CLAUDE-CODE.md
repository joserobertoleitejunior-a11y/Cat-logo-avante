# AVANTE Distribuição — Catálogo Digital: status e handoff pro Claude Code

> Checkpoint em 2026-08-18. Escrito pra ser lido por quem (humano ou IA) for continuar
> este projeto sem ter acompanhado o histórico até aqui.

---

## 1. O que já foi feito

### Produto
- Catálogo digital com dois modos: **Revista** (flipbook das 92 páginas escaneadas do
  catálogo em PDF) e **Catálogo Rápido** (grade de produtos estilo e-commerce, 145
  itens). **O Catálogo Rápido é o modo padrão de abertura** — decisão explícita do
  cliente, o site não deve mais abrir direto no flipbook.
- Cards do Catálogo Rápido redesenhados em estilo "prateleira de mercado": foto
  quadrada, marca, nome, tamanho da embalagem, botão **"+ Orçamento"** (adiciona ao
  carrinho de orçamento) e botão "Ver produto" (abre o painel de detalhe). Nenhum
  código interno, número de página ou referência de catálogo aparece pro cliente final.
- **As 145 fotos de produto foram inteiramente reprocessadas** a partir do PDF
  original em 300dpi (o problema de nitidez vinha de um render anterior a 110dpi) e
  auditadas uma a uma — cerca de 20 fotos que estavam quebradas, cortadas ou mostrando
  o produto errado foram corrigidas manualmente, cruzando cada crop com a página
  original do catálogo.
- Nome de produto passa por limpeza automática (`prettyName()` /
  `cleanProductName()` em `catalogo/js/app.js`): corrige capitalização de nomes em
  CAIXA ALTA e corta qualquer `REF:`, `Código:`, `EAN:`, `DUN:`, `Validade:` ou "Preço
  Tabela" que tenha vindo grudado no campo de nome durante a digitalização do PDF.
- IA vendedora (chat dentro do catálogo, `catalogo/js/ai-vendedora.js`) responde
  perguntas, mostra card de produto inline e adiciona ao carrinho automaticamente.
- Painel administrativo em `crm/crm_dashboard.html`: login mock, 4 KPIs, abas de
  navegação, tema claro/escuro persistente, cadastro de cliente, configuração do site
  (inclusive número de WhatsApp lido pelo catálogo via mesma origem), agenda de
  visitas (pedido feito no catálogo aparece pra confirmar no admin), IA Coach, links de
  logística.
- PIN gate de demonstração protegendo catálogo + admin (liberação por link
  `?pin=...` ou digitação, persistida em `localStorage`).
- Splash screen de entrada (só CSS, sem vídeo pesado).
- SEO técnico básico já implementado em `catalogo/`: `robots.txt`, `sitemap.xml`,
  meta description, Open Graph + Twitter Card, dados estruturados Schema.org
  (`Store`), `canonical`, `lang="pt-BR"`.

### Qualidade e testes
- **Suite Playwright com 12 arquivos e ~90 verificações** cobrindo revista, catálogo
  rápido, carrinho, IA vendedora, painel admin, PIN gate, splash, tema escuro, menu,
  filtros, transição entre modos e pedido de visita — **estava rodando só como scratch
  fora do git e foi trazida pra `tests/` nesta sessão** (commit `632bbbc`). Ver
  `tests/README.md` pra como rodar.
- Suite inteira passou limpa contra o pacote final extraído do zip (não só contra os
  arquivos soltos em disco) antes da entrega.

### Git e deploy
- Repositório local em `git` (branch `master`), 5 commits até agora. **Sem remoto
  configurado neste ambiente** — o José subiu o conteúdo pro GitHub
  (`joserobertoleitejunior-a11y/Cat-logo-avante`) manualmente pelo navegador, porque
  este sandbox bloqueia push autenticado pra serviços externos.
- Tentativa de deploy no **Vercel** não completou — o projeto ficou preso mostrando
  uma versão antiga e não foi possível diagnosticar a causa exata à distância (as
  hipóteses mais prováveis: branch de produção configurado no Vercel diferente do
  branch que recebeu o upload, ou **Root Directory** do projeto não apontando pra
  pasta `catalogo/`, que é onde fica o `index.html` real). **Decisão do José: abandonar
  Vercel por ora e ir de Netlify, ou seguir via Claude Code local.**
- Dois zips de teste rápido foram entregues: um só com `catalogo/` (pronto pra
  Netlify Drop) e um completo com `catalogo/ + crm/ + backend/ + shared/`.

---

## 2. O que falta pra finalizar

### 🔴 Bloqueadores de lançamento
1. **Deploy real funcionando com URL estável.** Escolher Netlify, Vercel ou outro,
   configurar **Root/Base Directory = `catalogo`** (site estático, sem build command),
   confirmar que o branch de produção da plataforma bate com o branch que recebe push,
   e validar a URL final abrindo em mobile e desktop.
2. **Tabela de preços real.** O catálogo original da AVANTE é atacado — preço é
   negociado, não publicado. Hoje todo card usa "+ Orçamento" (manda pro WhatsApp) no
   lugar de preço. Se o cliente quiser preço fixo exibido, precisa de uma lista real
   vinda dele — **nunca inventar valor**.
3. **Confirmar com o cliente (AVANTE) que os 145 produtos, marcas e departamentos
   batem com o catálogo real deles hoje** — os dados vieram de OCR/extração do PDF e
   alguns nomes de produto tinham lixo de digitalização misturado (já limpo no nome
   exibido, mas vale uma checagem humana final por amostragem).

### 🟡 Pendências técnicas conhecidas (do checklist em `PADROES-AGENCIA.md`, seção 8)
- **Sentry** (observabilidade de erro em produção) — não plugado, falta um DSN de
  uma conta Sentry do José.
- **Lint (Biome)** — não configurado no projeto ainda.
- **Supabase / banco real** — não existe. Por causa disso, RLS não se aplica e o
  login do painel admin (`crm/crm_dashboard.html`) é só mock via `localStorage`, sem
  verificação real no backend. Bloqueia autenticação administrativa de verdade.
- **`backend/functions/`** (webhook do WhatsApp, webhook do Instagram, IA vendedora
  server-side) existe só como código-fonte — nunca foi publicado nem conectado a
  nenhuma credencial real da Meta/WhatsApp Business API. Precisa de: escolher runtime
  serverless (Netlify Functions ou Vercel Functions), configurar `.env` com as
  credenciais (nunca commitar), registrar o webhook do lado da Meta.
- **Contas externas** (ação do José, não é código): Google Search Console, Google
  Meu Negócio, Google Analytics (GA4), domínio próprio (hoje não existe nenhum —
  domínio de plataforma tipo `.netlify.app` não pesa bem pra SEO/confiança).
- **`institucional/index.html`** tem um bug conhecido e não resolvido: imagens
  quebram com `ERR_TUNNEL_CONNECTION_FAILED` porque estão com hotlink pra fonte
  externa em vez de arquivo local. Baixa prioridade, mas pendente.
- **`institucional/` e `produto_preview/` estão fora do git** (nunca foram
  versionados). `produto_preview/` é só um protótipo de referência de design (pode
  ficar de fora do repo final). `institucional/` parece ser uma página real do site —
  decidir se entra no repositório principal.

### 🟢 Regra permanente (não é tarefa, é padrão de qualidade pra sempre)
- **Zero tolerância a foto quebrada, cortada ou mostrando o produto errado.** Foi
  uma instrução explícita e enfática do cliente. Qualquer produto novo, qualquer
  foto nova, entra já auditada visualmente contra a fonte original antes de ir pro ar.
- Depois de qualquer mudança em `catalogo/js/app.js`, `catalogo/css/style.css`,
  `catalogo/data/products.json` ou nas fotos de produto: **rodar a suite inteira em
  `tests/` de novo antes de considerar pronto.**

---

## 3. Prompt cirúrgico — colar isso na primeira mensagem de uma sessão nova do Claude Code

```
Você está assumindo o projeto "AVANTE Distribuição — Catálogo Digital", uma agência
de sites pra comércio local que segue o VIBE CODING PROCESS. O arquivo
PADROES-AGENCIA.md está na raiz do projeto — leia ele primeiro, é o contrato de
qualidade fixo do projeto e vence qualquer sugestão que o contradiga.

CONTEXTO: repositório em https://github.com/joserobertoleitejunior-a11y/Cat-logo-avante
(clone/pull isso primeiro). Estrutura: catalogo/ (site estático — index.html é o
catálogo digital com modo Revista + Catálogo Rápido), crm/crm_dashboard.html (painel
admin), backend/functions/ (webhooks WhatsApp/Instagram + IA vendedora, ainda não
publicados), shared/ (código comum), tests/ (suite Playwright — leia tests/README.md
antes de rodar).

REGRA ABSOLUTA E PERMANENTE: zero tolerância a foto de produto quebrada, cortada ou
mostrando o item errado. Toda foto nova ou alterada precisa ser auditada visualmente
contra a fonte original antes de ir pro ar. Nunca invente preço ou dado de produto que
não veio do cliente — a AVANTE não tem tabela de preço pública hoje, por isso os cards
usam "+ Orçamento" no lugar de preço.

TAREFAS NESTA ORDEM DE PRIORIDADE:

1. Deploy real. Configure o projeto na plataforma de deploy escolhida (Netlify ou
   Vercel) com Root/Base Directory = catalogo, sem build command (site estático).
   Confirme que o branch de produção da plataforma é o mesmo branch que recebe push
   (provavelmente main ou master — cheque os dois lados). Depois do deploy, rode a
   suite tests/ contra a URL de produção (ajuste o localhost:8099 hardcoded nos
   arquivos de teste pra apontar pra ela) e confirme visualmente em mobile e desktop.

2. Rode a suite tests/ inteira ANTES de mexer em qualquer coisa, pra confirmar que
   o estado atual está 100% verde (12 arquivos, ~90 checks). Se algo já quebrar aqui,
   pare e investigue antes de somar trabalho novo em cima de uma base quebrada.

3. Resolva o bug conhecido de imagens quebradas em institucional/index.html
   (hotlink externo causando ERR_TUNNEL_CONNECTION_FAILED — trocar pra arquivo
   local servido pelo próprio domínio).

4. Decida com o José (pergunte, não assuma) se institucional/ e produto_preview/
   entram no controle de versão do jeito que estão, ou se produto_preview/ deve ser
   removido por ser só protótipo de referência.

5. Pendências de PADROES-AGENCIA.md seção 8 que dependem de decisão externa do José
   antes de você poder agir: conta Sentry (pro DSN), organização Supabase (pro banco
   real + RLS + autenticação real do admin), credenciais da Meta/WhatsApp Business
   API (pros webhooks em backend/functions/). Pergunte antes de tentar implementar
   essas peças sem as credenciais — não é possível terminar sem elas.

6. Configure Biome (lint) no projeto, seguindo os padrões da seção 3.2 do
   PADROES-AGENCIA.md (proibido !important em excesso, function >80 linhas sem
   quebrar, handler inline no HTML).

Depois de qualquer mudança em catalogo/js/app.js, catalogo/css/style.css,
catalogo/data/products.json ou nas fotos de catalogo/images/products/: rode a suite
tests/ inteira de novo antes de considerar a mudança pronta. Use commits pequenos e
descritivos no padrão tipo(escopo): descrição (seção 1 do PADROES-AGENCIA.md).
```

---

*Documento gerado em 2026-08-18 pra continuidade do projeto fora deste ambiente.*
