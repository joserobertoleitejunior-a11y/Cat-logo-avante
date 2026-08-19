/* AVANTE — Revista Digital v2
   Física de arrasto real (pointer events), som sintetizado (Web Audio, sem arquivo externo),
   carregamento de imagem sob demanda (leve para celulares fracos), hotspots clicáveis por produto,
   orçamento (carrinho) com captura de lead via WhatsApp, e stub de analytics pronto pra GA4 + Supabase.
*/

// ============ CONFIG ============
const TOTAL_PAGES = 92;
const WHATSAPP_NUMBER = '5511945460722'; // confirmado: mesmo número (11) 94546-0722 impresso na capa do catálogo

// lê overrides salvos pelo painel admin (crm/crm_dashboard.html, aba "Config") — como o
// catálogo e o admin rodam na mesma origem, dá pra trocar o número do WhatsApp e outros
// textos do site direto pelo painel, sem precisar mexer em código. Se nada foi configurado
// lá ainda, cai nos valores padrão acima.
function getSiteCfg(){
  try{
    const raw = localStorage.getItem('avante_site_cfg');
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function getWhatsAppNumber(){
  const cfg = getSiteCfg();
  return (cfg.whatsapp && /^\d{10,13}$/.test(cfg.whatsapp)) ? cfg.whatsapp : WHATSAPP_NUMBER;
}
const AI_NAME_DEFAULT = 'Atendente Avante';
function getAiName(){
  const cfg = getSiteCfg();
  return (cfg.aiName && cfg.aiName.trim()) ? cfg.aiName.trim() : AI_NAME_DEFAULT;
}
const GA4_MEASUREMENT_ID = ''; // TODO: colar o ID do Google Analytics 4 (ex: G-XXXXXXX) para ativar
// TODO fase 2: quando a function do backend (backend/functions/ai-vendedora.js) estiver publicada,
// colar a URL aqui. Com isso vazio, o chat usa o motor local (js/ai-vendedora.js) — funciona sem
// nenhuma chave de API, mas é um motor de regras, não a Claude de verdade conversando.
const AI_BACKEND_URL = '';

// ============ ANALYTICS STUB ============
function trackEvent(name, params){
  params = params || {};
  if (window.gtag) window.gtag('event', name, params);
  // TODO fase 2: também gravar em Supabase (tabela eventos_analytics) quando o backend estiver conectado.
  console.debug('[analytics]', name, params);
}
(function initGA(){
  if(!GA4_MEASUREMENT_ID) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA4_MEASUREMENT_ID);
})();

// ============ SOM (sintetizado, sem arquivo externo) ============
let audioCtx = null;
let soundOn = true;
function ensureAudio(){
  if(!audioCtx){
    try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; }
  }
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playPageFlipSound(){
  if(!soundOn) return;
  const ctx = ensureAudio();
  if(!ctx) return;
  const dur = 0.42;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1); }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.Q.value = 0.7;
  bandpass.frequency.setValueAtTime(2200, ctx.currentTime);
  bandpass.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + dur*0.85);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

  noise.connect(bandpass).connect(gain).connect(ctx.destination);
  noise.start();
  noise.stop(ctx.currentTime + dur);
}

// ============ ESTADO ============
let TOC = [];
let PRODUCTS = [];
let TOC_BY_PAGE = {};
let PRODUCTS_BY_PAGE = {};
let current = 0; // páginas já viradas (0..TOTAL_PAGES)
let flipLock = false; // impede que duas animações de virar página se sobreponham e corrompam `current`
const leaves = [];
let bookEl, stageEl;
let dragState = null;
const IMG_WINDOW = 4;   // carrega imagem de current±4
const IMG_UNLOAD = 9;   // descarrega além disso

const CART = []; // {codigo, nome, caixa, qtd, page}

// caminho absoluto (a partir da raiz do domínio) pra funcionar em qualquer URL,
// com ou sem barra final — path relativo aqui já quebrou um deploy real no Vercel
// (ver commit "fix(deploy): caminhos absolutos")
const ASSET_BASE = '/catalogo/';

// ============ CARREGAR DADOS ============
async function loadData(){
  const [tocRes, prodRes] = await Promise.all([
    fetch(ASSET_BASE + 'data/toc.json'), fetch(ASSET_BASE + 'data/products.json')
  ]);
  TOC = await tocRes.json();
  PRODUCTS = await prodRes.json();
  TOC.forEach(r => TOC_BY_PAGE[r.page] = r);
  // foto do produto recortada individualmente (não a página inteira escaneada) — o arquivo
  // pXXX.jpg foi gerado na MESMA ordem deste array, então o índice aqui é o nome do arquivo.
  PRODUCTS.forEach((p,i) => {
    p.photo = `${ASSET_BASE}images/products/p${String(i).padStart(3,'0')}.jpg`;
    // identidade interna do produto (carrinho/seleção/hotspot) — o `codigo` (EAN) vem do
    // catálogo digitalizado e algumas linhas saíram com o MESMO EAN em produtos diferentes
    // (erro de OCR na digitalização, ex: "Doce de Frutas Goiaba" e "...Banana" com o mesmo
    // código). Usar o índice como uid evita que selecionar um marque o outro como selecionado
    // também — o `codigo` continua sendo exibido pro cliente exatamente como veio da fonte.
    p.uid = String(i);
    (PRODUCTS_BY_PAGE[p.page] = PRODUCTS_BY_PAGE[p.page] || []).push(p);
  });
}

// ============ CONSTRUÇÃO DO LIVRO ============
function buildBook(){
  bookEl = document.getElementById('book');
  for(let i=0;i<TOTAL_PAGES;i++){
    const leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.dataset.index = i;
    leaf.innerHTML = `
      <div class="face front">
        <div class="skel"></div>
        <img alt="Página ${i+1}" draggable="false">
        <div class="hotspot-layer" data-layer="front"></div>
      </div>
      <div class="face back"><span class="wm">AVANTE DISTRIBUIÇÃO</span></div>
      <div class="shade"></div>`;
    bookEl.appendChild(leaf);
    leaves.push(leaf);
  }
}

function fitBook(){
  stageEl = document.getElementById('stage');
  // Se um resize disparar antes do #stage ter medida real (aba em segundo plano,
  // primeiro paint), o livro ficava preso no tamanho mínimo de fallback pro resto da
  // sessão — ignorar o recálculo até #stage ter tamanho de verdade resolve.
  if(stageEl.clientWidth < 10 || stageEl.clientHeight < 10) return;
  const availW = stageEl.clientWidth - 16;
  const availH = stageEl.clientHeight - 8;
  const ratio = 540/720;
  let h = availH, w = h*ratio;
  if(w > availW){ w = availW; h = w/ratio; }
  bookEl.style.width = Math.max(140,w)+'px';
  bookEl.style.height = Math.max(190,h)+'px';
}
window.addEventListener('resize', fitBook);

function pageSrc(n){ return `${ASSET_BASE}images/page-${String(n).padStart(2,'0')}.jpg`; }

function updateImageWindow(){
  for(let i=0;i<TOTAL_PAGES;i++){
    const img = leaves[i].querySelector('.face.front img');
    const skel = leaves[i].querySelector('.skel');
    const dist = Math.abs(i - current);
    if(dist <= IMG_WINDOW){
      if(!img.src || !img.src.includes(pageSrc(i+1))){
        img.src = pageSrc(i+1);
        img.onload = () => { skel.style.display = 'none'; };
      }
    } else if(dist > IMG_UNLOAD && img.getAttribute('src')){
      img.removeAttribute('src');
      skel.style.display = '';
    }
  }
}

function buildHotspots(pageIndex){
  const leaf = leaves[pageIndex];
  if(!leaf) return;
  const layer = leaf.querySelector('.hotspot-layer');
  if(layer.dataset.built) return;
  layer.dataset.built = '1';
  const pageNum = pageIndex + 1;
  const prods = PRODUCTS_BY_PAGE[pageNum] || [];
  prods.forEach(p => {
    const hs = document.createElement('div');
    hs.className = 'hotspot';
    hs.dataset.uid = p.uid;
    // aplica o estado "selecionado" já na criação (isInCart é barato — olha só o carrinho,
    // não o DOM inteiro). Isso evita ter que re-varrer todos os cards/hotspots da página a
    // cada virada — só o addToCart/removeFromCart precisam disso, quando o carrinho muda de fato.
    if(isInCart(p.uid)) hs.classList.add('selected');
    hs.style.left = p.bbox.left_pct + '%';
    hs.style.top = p.bbox.top_pct + '%';
    hs.style.width = p.bbox.width_pct + '%';
    hs.style.height = p.bbox.height_pct + '%';
    hs.title = p.name;
    // Toque no hotspot agora SELECIONA direto (igual ao Catálogo Rápido) — não precisa
    // abrir o painel só pra escolher o item. Um botão "i" pequeno no canto abre os
    // detalhes/quantidade pra quem quiser ver mais antes de decidir.
    hs.addEventListener('click', (e)=>{
      if(justDragged) return; // veio de um arrasto que terminou em cima do hotspot, não foi um toque de verdade
      e.stopPropagation();
      if(isInCart(p.uid)) removeFromCart(p.uid);
      else addToCart(p, 1);
      trackEvent('product_click', {codigo:p.codigo, nome:p.name, origem:'revista'});
    });
    const info = document.createElement('button');
    info.className = 'hotspot-info';
    info.type = 'button';
    info.setAttribute('aria-label', 'Ver detalhes de ' + p.name);
    info.textContent = 'i';
    info.addEventListener('click', (e)=>{
      if(justDragged) return;
      e.stopPropagation();
      openProduct(p);
      trackEvent('product_click', {codigo:p.codigo, nome:p.name, origem:'revista_detalhe'});
    });
    hs.appendChild(info);
    layer.appendChild(hs);
  });
}

// ============ RENDER / NAVEGAÇÃO ============
// Só as folhas dentro dessa distância de `current` recebem as propriedades 3D caras
// (preserve-3d/will-change). Todas as outras ficam com display:none — é o que evita
// o travamento em celular fraco com 92 páginas simultâneas participando do compositor.
const LEAF_WINDOW = 3;

function render(){
  for(let i=0;i<TOTAL_PAGES;i++){
    const leaf = leaves[i];
    const flipped = i < current;
    // sempre inclui current e current-1 (as duas folhas realmente visíveis/ativas),
    // mesmo que isso ultrapasse levemente a janela padrão.
    const inWindow = Math.abs(i - current) <= LEAF_WINDOW || i === current - 1;
    leaf.classList.toggle('in-window', inWindow);
    if(!inWindow) continue; // display:none — não vale a pena tocar em transform/zIndex
    leaf.style.transform = flipped ? 'rotateY(-180deg)' : 'rotateY(0deg)';
    leaf.style.zIndex = flipped ? i : (TOTAL_PAGES - i);
    leaf.querySelector('.shade').style.opacity = flipped ? .55 : 0;
    // só a folha visível "da frente" (topo do lado não virado) e a última virada (topo do lado esquerdo)
    // devem receber clique/toque — evita que outra folha intercepte hotspots por causa do preserve-3d.
    const isActive = (i === current) || (i === current - 1);
    leaf.classList.toggle('active', isActive);
  }
  const visiblePage = Math.min(current+1, TOTAL_PAGES);
  document.getElementById('pageLabel').textContent = visiblePage + ' / ' + TOTAL_PAGES;
  document.getElementById('progressBar').style.transform = `scaleX(${visiblePage/TOTAL_PAGES})`;
  const info = TOC_BY_PAGE[visiblePage];
  document.getElementById('deptLabel').textContent = info ? (info.brand? info.brand+' · ':'') + info.title : '';
  updateImageWindow();
  buildHotspots(Math.min(current, TOTAL_PAGES-1));
  if(current>0) buildHotspots(current-1);
}

function animateLeaf(leaf, toAngle, onDone){
  // uma única animação de virada por vez — evita que transitionend + o
  // fallback de segurança disparem onDone duas vezes para a MESMA folha,
  // e evita que um clique/arrasto novo comece antes do anterior terminar.
  let done = false;
  const finish = ()=>{
    if(done) return;
    done = true;
    leaf.removeEventListener('transitionend', handler);
    leaf.classList.remove('animating');
    flipLock = false;
    onDone && onDone();
  };
  const handler = (ev)=>{ if(ev.target===leaf && ev.propertyName==='transform') finish(); };
  flipLock = true;
  leaf.classList.add('animating');
  leaf.addEventListener('transitionend', handler);
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ leaf.style.transform = `rotateY(${toAngle}deg)`; }); });
  // fallback caso transitionend não dispare (aba em segundo plano, tela desligada etc.)
  setTimeout(finish, 900);
}

function next(){
  // current só pode chegar até TOTAL_PAGES-1 (a última folha, leaves[TOTAL_PAGES-1]) —
  // depois disso não existe mais nenhuma folha pra virar. Deixar current chegar a
  // TOTAL_PAGES tentaria virar uma folha inexistente e travaria o estado.
  if(flipLock || current >= TOTAL_PAGES - 1) return;
  const leaf = leaves[current];
  playPageFlipSound();
  leaf.querySelector('.shade').style.transition = 'opacity .55s';
  leaf.querySelector('.shade').style.opacity = .55;
  animateLeaf(leaf, -180, ()=>{ current++; render(); });
}
function prev(){
  if(flipLock || current <= 0) return;
  const leaf = leaves[current-1];
  playPageFlipSound();
  leaf.querySelector('.shade').style.transition = 'opacity .55s';
  leaf.querySelector('.shade').style.opacity = 0;
  animateLeaf(leaf, 0, ()=>{ current--; render(); });
}
function goTo(pageNumber){
  if(flipLock) return;
  current = Math.max(0, Math.min(TOTAL_PAGES, pageNumber-1));
  render();
}
window.goTo = goTo;

// ============ ARRASTO (física real) ============
function easeOutCubic(t){ return 1 - Math.pow(1-t, 3); }

// Um toque que começa em cima de um produto (a página fica cheia de hotspots — em
// certas páginas cobrem a maior parte da área visível) precisa continuar podendo
// virar a página se o dedo arrastar. A distinção entre "foi um toque" (abre o
// produto) e "foi um arrasto" (vira a página) só é decidida depois, comparando a
// distância percorrida com COMMIT_DRAG_PX — nada de decidir isso já no pointerdown.
const COMMIT_DRAG_PX = 7;
let justDragged = false; // usado pelos handlers de click (hotspot/setas) pra ignorar o click sintético logo após um arrasto de verdade

function onPointerDown(e){
  if(flipLock) return; // já tem uma virada de página animando — ignora novo toque até terminar
  const rect = bookEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const half = rect.width/2;
  let mode = null, leaf = null;
  if(x >= half && current < TOTAL_PAGES - 1){ mode = 'forward'; leaf = leaves[current]; }
  else if(x < half && current > 0){ mode = 'backward'; leaf = leaves[current-1]; }
  if(!mode) return;
  const t0 = performance.now();
  dragState = { mode, leaf, startX:e.clientX, bookWidth:rect.width, ratio:0, samples:[{x:e.clientX, t:t0}], committed:false, pointerId:e.pointerId };
  // NÃO captura o pointer ainda. setPointerCapture faz o evento 'click' sintético
  // ser disparado no elemento capturador (bookEl) em vez do elemento realmente tocado
  // — se isso rodasse já aqui, um toque simples num hotspot pararia de abrir/selecionar
  // o produto (o listener de click está no hotspot, não no bookEl). Só capturamos
  // depois que o gesto realmente virar um arrasto (ver onPointerMove abaixo).
}
function onPointerMove(e){
  if(!dragState) return;
  const { mode, leaf, startX, bookWidth, samples } = dragState;
  const dx = e.clientX - startX;
  const now = performance.now();

  // Só "comita" pro modo arrasto depois que o dedo andou de verdade — antes disso
  // não mexe em nada visualmente, pra um toque simples (abrir produto) continuar
  // funcionando normalmente vindo do mesmo pointerdown.
  if(!dragState.committed){
    if(Math.abs(dx) < COMMIT_DRAG_PX) return;
    dragState.committed = true;
    ensureAudio();
    leaf.querySelector('.shade').style.transition = 'none';
    stageEl.style.touchAction = 'none';
    stageEl.setPointerCapture && dragState.pointerId!=null && bookEl.setPointerCapture(dragState.pointerId);
  }

  // Velocidade calculada numa janela de tempo real (últimos ~80ms de amostras),
  // não pelo delta do último evento isolado. Isso evita que um único evento de
  // movimento "explosivo" — seja um jitter de touch, seja um lote de eventos
  // entregue de uma vez após um frame perdido num celular fraco — seja lido como
  // um flick intencional. A velocidade só reflete o ritmo real do gesto.
  samples.push({x:e.clientX, t:now});
  while(samples.length > 1 && now - samples[0].t > 80) samples.shift();
  const oldest = samples[0];
  const windowDt = Math.max(1, now - oldest.t);
  dragState.velocity = (e.clientX - oldest.x) / windowDt;

  const dragSpan = bookWidth * 0.78;
  let ratio, angle;
  if(mode === 'forward'){
    ratio = Math.max(0, Math.min(1, -dx / dragSpan));
    angle = -180 * easeOutCubic(ratio);
  } else {
    ratio = Math.max(0, Math.min(1, dx / dragSpan));
    angle = -180 + 180 * easeOutCubic(ratio);
  }
  dragState.ratio = ratio;
  leaf.style.transform = `rotateY(${angle}deg)`;
  leaf.querySelector('.shade').style.opacity = (mode==='forward' ? ratio : 1-ratio) * .55;
}
function onPointerUp(){
  if(!dragState) return;
  if(!dragState.committed){
    // nunca passou do limiar de arrasto — foi só um toque. Não mexe em nada,
    // deixa o evento 'click' nativo do elemento tocado (hotspot, seta, etc.) seguir normal.
    dragState = null;
    return;
  }
  const { mode, leaf, ratio, samples } = dragState;
  // suprime o click sintético que o navegador dispara logo depois de um pointerup —
  // sem isso, soltar o arrasto em cima de um hotspot também abriria o produto.
  justDragged = true;
  setTimeout(()=>{ justDragged = false; }, 250);
  // Se o dedo ficou parado (sem novos eventos de movimento) por um tempinho antes
  // de soltar, não é um flick — é uma pausa/hesitação, mesmo que o gesto que levou
  // até ali tenha sido rápido. Sem isso, um arrasto curto e rápido seguido de uma
  // pequena pausa antes de soltar seria lido incorretamente como flick.
  const stillFor = performance.now() - samples[samples.length-1].t;
  const velocity = stillFor > 40 ? 0 : dragState.velocity;
  // flick só conta se o dedo já arrastou uma distância mínima — evita que um
  // pico de velocidade momentâneo bem no início/fim do gesto vire a página sozinho.
  const flick = Math.abs(velocity) > 0.55 && ratio > 0.06;
  const commit = mode === 'forward'
    ? (flick ? velocity < 0 : ratio > 0.42)
    : (flick ? velocity > 0 : ratio > 0.42);
  window.__lastDrag = { mode, ratio, velocity, flick, commit, stillFor };

  playPageFlipSound();
  leaf.querySelector('.shade').style.transition = 'opacity .5s';
  if(mode === 'forward'){
    if(commit){ animateLeaf(leaf, -180, ()=>{ current++; render(); }); leaf.querySelector('.shade').style.opacity=.55; }
    else { animateLeaf(leaf, 0, render); leaf.querySelector('.shade').style.opacity=0; }
  } else {
    if(commit){ animateLeaf(leaf, 0, ()=>{ current--; render(); }); leaf.querySelector('.shade').style.opacity=0; }
    else { animateLeaf(leaf, -180, render); leaf.querySelector('.shade').style.opacity=.55; }
  }
  dragState = null;
  stageEl.style.touchAction = '';
}

function setupDrag(){
  stageEl = document.getElementById('stage');
  bookEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

// ============ PRODUTO — painel de detalhe ============
let currentProduct = null;
let currentQty = 1;

function openProduct(p){
  currentProduct = p; currentQty = 1;
  document.getElementById('productImg').src = p.photo;
  document.getElementById('productImg').alt = prettyName(p.name);
  document.getElementById('productBrand').textContent = p.brand || p.dept;
  document.getElementById('productName').textContent = prettyName(p.name);
  document.getElementById('productCaixa').textContent = p.caixa || '—';
  document.getElementById('productCodigo').textContent = p.codigo;
  document.getElementById('productSecao').textContent = p.section || p.dept || '—';
  document.getElementById('qtyVal').textContent = currentQty;
  const existing = CART.find(c => c.uid === p.uid);
  const note = document.getElementById('productInCartNote');
  note.classList.toggle('show', !!existing);
  if(existing) document.getElementById('productInCartQty').textContent = existing.qtd;
  openDrawer('productDrawer');
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('qtyMinus').addEventListener('click', ()=>{ currentQty=Math.max(1,currentQty-1); document.getElementById('qtyVal').textContent=currentQty; });
  document.getElementById('qtyPlus').addEventListener('click', ()=>{ currentQty++; document.getElementById('qtyVal').textContent=currentQty; });
  document.getElementById('addToCartBtn').addEventListener('click', ()=>{
    addToCart(currentProduct, currentQty);
    closeDrawer('productDrawer');
  });
  document.getElementById('viewInBookBtn').addEventListener('click', ()=>{
    goTo(currentProduct.page);
    closeDrawer('productDrawer');
  });
});

// ============ CARRINHO / ORÇAMENTO ============
// isInCart/addToCart/removeFromCart identificam o item pelo `uid` interno (ver loadData),
// não pelo `codigo` (EAN) — alguns produtos vieram do catálogo digitalizado com o MESMO EAN
// por erro de OCR (ex: "Doce de Frutas Goiaba" e "...Banana"), e usar `codigo` aqui faria
// selecionar um item marcar o outro como selecionado também.
function isInCart(uid){ return CART.some(c => c.uid === uid); }

// Atualiza o selo de "já selecionado" em todo hotspot da revista que corresponde a um
// item do carrinho — assim o cliente sempre vê, olhando a página, o que já escolheu.
function refreshSelectionUI(){
  const inCartUids = new Set(CART.map(c => c.uid));
  document.querySelectorAll('.hotspot[data-uid]').forEach(hs => {
    hs.classList.toggle('selected', inCartUids.has(hs.dataset.uid));
  });
}

function addToCart(p, qty){
  const existing = CART.find(c => c.uid === p.uid);
  if(existing){ existing.qtd += qty; }
  else{ CART.push({ uid:p.uid, codigo:p.codigo, nome:p.name, caixa:p.caixa, page:p.page, qtd:qty }); }
  trackEvent('add_to_quote', { codigo:p.codigo, nome:p.name, qtd:qty });
  renderCartBadge();
  refreshSelectionUI();
}
function removeFromCart(uid){
  const idx = CART.findIndex(c=>c.uid===uid);
  if(idx>-1) CART.splice(idx,1);
  renderCartBadge();
  renderCartDrawer();
  refreshSelectionUI();
}
function renderCartBadge(){
  const badge = document.getElementById('cartCount');
  const totalItens = CART.reduce((s,c)=>s+c.qtd,0);
  badge.textContent = totalItens;
  badge.style.display = totalItens>0 ? 'flex' : 'none';
}
function renderCartDrawer(){
  const body = document.getElementById('cartItems');
  if(CART.length===0){
    body.innerHTML = '<div class="empty-state">Seu orçamento está vazio.<br>Toque em qualquer produto da revista pra adicionar.</div>';
    document.getElementById('cartFooter').style.display='none';
    return;
  }
  document.getElementById('cartFooter').style.display='block';
  body.innerHTML = CART.map(c=>`
    <div class="cart-item">
      <img src="${pageSrc(c.page)}" alt="${c.nome}">
      <div>
        <div class="ci-name">${c.nome}</div>
        <div class="ci-meta">${c.caixa||''} · ${c.qtd} caixa(s)</div>
      </div>
      <button class="ci-remove" data-uid="${c.uid}" aria-label="Remover">✕</button>
    </div>`).join('');
  body.querySelectorAll('.ci-remove').forEach(btn=>{
    btn.addEventListener('click', ()=>removeFromCart(btn.dataset.uid));
  });
}

function buildWhatsAppMessage(lead){
  let msg = `Olá! Sou ${lead.nome} da ${lead.empresa} (${lead.cidade}).\n`;
  msg += `Gostaria de um orçamento para os itens abaixo, vistos no catálogo digital da Avante:\n\n`;
  CART.forEach(c=>{
    msg += `• ${c.nome} — ${c.qtd} caixa(s) (${c.caixa||''})\n`;
  });
  msg += `\nTelefone para contato: ${lead.telefone}`;
  return msg;
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('cartFab').addEventListener('click', ()=>{ renderCartDrawer(); openDrawer('cartDrawer'); });
  document.getElementById('sendQuoteBtn').addEventListener('click', ()=>{
    openDrawer('leadDrawer');
  });
  document.getElementById('leadForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const btn = document.getElementById('leadSubmitBtn');
    if(btn.disabled) return; // trava duplo toque/clique — evita abrir o WhatsApp duas vezes
    const lead = {
      nome: document.getElementById('leadNome').value.trim(),
      empresa: document.getElementById('leadEmpresa').value.trim(),
      cidade: document.getElementById('leadCidade').value.trim(),
      telefone: document.getElementById('leadTelefone').value.trim(),
    };
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Enviando...';
    // TODO fase 2: também gravar este lead na tabela `clientes` do Supabase (POST) além do WhatsApp.
    trackEvent('quote_sent', { itens: CART.length, cidade: lead.cidade });
    const msg = buildWhatsAppMessage(lead);
    const url = `https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    closeDrawer('leadDrawer');
    closeDrawer('cartDrawer');
    setTimeout(()=>{ btn.disabled = false; btn.textContent = originalLabel; }, 600);
  });

  // ---- chips de dia/período: seleção única por grupo, um toque já marca ----
  let visitDia = null, visitPeriodo = null;
  function wireChipGroup(containerId, dataAttr, onPick){
    const container = document.getElementById(containerId);
    container.addEventListener('click', (e)=>{
      const btn = e.target.closest('.day-chip');
      if(!btn) return;
      container.querySelectorAll('.day-chip').forEach(c=>c.classList.remove('selected'));
      btn.classList.add('selected');
      container.classList.remove('needs-choice');
      onPick(btn.dataset[dataAttr]);
    });
  }
  wireChipGroup('visitDiaChips', 'day', (v)=>{ visitDia = v; });
  wireChipGroup('visitPeriodoChips', 'periodo', (v)=>{ visitPeriodo = v; });

  // ---- telefone formata sozinho enquanto digita: (11) 90000-0000 ----
  document.getElementById('visitTelefone').addEventListener('input', (e)=>{
    let d = e.target.value.replace(/\D/g,'').slice(0,11);
    if(d.length > 10) e.target.value = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    else if(d.length > 6) e.target.value = `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    else if(d.length > 2) e.target.value = `(${d.slice(0,2)}) ${d.slice(2)}`;
    else if(d.length > 0) e.target.value = `(${d}`;
    else e.target.value = '';
  });

  function resetVisitForm(){
    const form = document.getElementById('visitForm');
    form.reset();
    form.classList.remove('sent');
    document.getElementById('visitSuccess').classList.remove('show');
    document.getElementById('visitSubmitBtn').style.display = '';
    visitDia = null; visitPeriodo = null;
    document.querySelectorAll('#visitDiaChips .day-chip, #visitPeriodoChips .day-chip').forEach(c=>c.classList.remove('selected'));
  }
  document.getElementById('visitBtn').addEventListener('click', ()=>{
    resetVisitForm();
    openDrawer('visitDrawer');
  });
  document.getElementById('visitForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    if(!visitDia){
      document.getElementById('visitDiaChips').classList.add('needs-choice');
      document.getElementById('visitDiaChips').scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    const pedido = {
      nome: document.getElementById('visitNome').value.trim(),
      empresa: document.getElementById('visitEmpresa').value.trim(),
      cidade: document.getElementById('visitCidade').value.trim(),
      telefone: document.getElementById('visitTelefone').value.trim(),
      dia: visitDia,
      periodo: visitPeriodo || 'Qualquer',
      pedidoEm: new Date().toISOString(),
      status: 'pendente',
    };
    // salva na mesma origem do painel admin (crm/crm_dashboard.html, aba Agenda) — lá o
    // vendedor vê os pedidos de visita que os próprios clientes fizeram e transforma em
    // um horário confirmado na agenda da semana.
    try{
      const raw = localStorage.getItem('avante_visit_requests');
      const list = raw ? JSON.parse(raw) : [];
      list.push(pedido);
      localStorage.setItem('avante_visit_requests', JSON.stringify(list));
    }catch(err){ console.debug('[visita] não deu pra salvar localmente', err); }
    trackEvent('visit_requested', { cidade: pedido.cidade, dia: pedido.dia, periodo: pedido.periodo });
    document.getElementById('visitSubmitBtn').style.display = 'none';
    document.getElementById('visitSuccess').classList.add('show');
  });
});

// ============ DRAWERS genéricos ============
function openDrawer(id){
  document.getElementById(id).classList.add('open');
  document.getElementById('overlay').classList.add('show');
}
function closeDrawer(id){
  document.getElementById(id).classList.remove('open');
  const anyOpen = ['tocDrawer','productDrawer','cartDrawer','leadDrawer'].some(d=>document.getElementById(d).classList.contains('open'));
  if(!anyOpen) document.getElementById('overlay').classList.remove('show');
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('[data-close-drawer]').forEach(btn=>{
    btn.addEventListener('click', ()=>closeDrawer(btn.dataset.closeDrawer));
  });
  document.getElementById('overlay').addEventListener('click', ()=>{
    ['tocDrawer','productDrawer','cartDrawer','leadDrawer'].forEach(closeDrawer);
  });
});

// ============ ÍNDICE (TOC) ============
function buildToc(){
  const list = document.getElementById('tocList');
  let lastDept = null;
  TOC.forEach((row, idx)=>{
    if(idx>0 && TOC[idx-1].title===row.title && TOC[idx-1].dept===row.dept) return;
    if(row.dept !== lastDept){
      const h = document.createElement('div');
      h.className = 'toc-dept'; h.textContent = row.dept;
      list.appendChild(h);
      lastDept = row.dept;
    }
    const item = document.createElement('div');
    item.className = 'toc-item';
    item.innerHTML = `<img src="${ASSET_BASE}images/thumbs/thumb-${String(row.page).padStart(2,'0')}.jpg" alt="${row.title}"><div><div class="ttl">${row.title}</div><div class="sub">${row.brand?row.brand+' · ':''}pág. ${row.page}</div></div>`;
    item.addEventListener('click', ()=>{ goTo(row.page); closeDrawer('tocDrawer'); });
    list.appendChild(item);
  });
}

// ============ NOME DE PRODUTO ============
// nomes vêm em CAIXA ALTA do catálogo escaneado original — deixamos em title case
// pra ficar com cara de vitrine em vez de etiqueta de estoque.
const NAME_LOWER_WORDS = new Set(['e','de','da','do','das','dos','com','para','em']);
// alguns nomes vieram do catálogo escaneado com código interno (REF/Cód/EAN/DUN/Validade/
// preço de tabela) grudado no final do próprio campo "nome" — igual ao "Cód: X · Pág. Y"
// que já tiramos dos cards, isso é numeração/etiqueta de estoque e não pode aparecer pro
// cliente. Cortamos o nome no primeiro marcador desse tipo, mantendo só a parte do produto.
const NAME_CODE_CUTOFF = /\b(REF|C[oó]d(?:igo)?|EAN|DUN|Validade|Pre[cç]o\s+Tabela|Fra[cç][ãa]o|Ingredientes)\b\s*[:.]?/i;
function cleanProductName(raw){
  if(!raw) return '';
  const m = NAME_CODE_CUTOFF.exec(raw);
  const cut = m ? raw.slice(0, m.index) : raw;
  return cut.replace(/[·:,-]\s*$/, '').trim() || raw.trim();
}
function prettyName(raw){
  if(!raw) return '';
  raw = cleanProductName(raw);
  return raw.toLowerCase().split(' ').map((w,i)=>{
    if(!w) return w;
    if(/\d/.test(w)) return w.toUpperCase(); // preserva medidas/unidades: 90gr, 3x90gr
    if(i>0 && NAME_LOWER_WORDS.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

// ============ BUSCA (dentro do índice) ============
// Busca por produto (nome/marca/código) direto na gaveta do índice — substitui o que
// antes era a busca do Catálogo Rápido, agora que a Revista é o único modo do site.
function renderTocSearch(q){
  const list = document.getElementById('tocList');
  const resEl = document.getElementById('tocSearchResults');
  if(!q){
    list.style.display = '';
    resEl.style.display = 'none';
    resEl.innerHTML = '';
    return;
  }
  list.style.display = 'none';
  resEl.style.display = '';
  const results = PRODUCTS.filter(p =>
    (p.name+' '+(p.brand||'')+' '+(p.section||'')+' '+(p.dept||'')+' '+p.codigo).toLowerCase().includes(q)
  );
  if(!results.length){
    resEl.innerHTML = '<div class="empty-state" style="padding:40px 16px;">Nada encontrado.<br>Tenta outro nome ou marca.</div>';
    return;
  }
  resEl.innerHTML = results.slice(0, 40).map(p => `
    <div class="toc-item" data-uid="${p.uid}">
      <img src="${p.photo}" alt="${prettyName(p.name)}" loading="lazy">
      <div><div class="ttl">${prettyName(p.name)}</div><div class="sub">${p.brand?p.brand+' · ':''}pág. ${p.page}</div></div>
    </div>`).join('');
  resEl.querySelectorAll('.toc-item').forEach(el => {
    el.addEventListener('click', () => {
      const p = PRODUCTS.find(x => x.uid === el.dataset.uid);
      if(p) goTo(p.page);
      closeDrawer('tocDrawer');
    });
  });
}

// ============ INIT ============
async function init(){
  await loadData();
  buildBook();
  fitBook();
  setupDrag();
  render();
  buildToc();
  renderCartBadge();

  document.getElementById('prevBtn').addEventListener('click', prev);
  document.getElementById('nextBtn').addEventListener('click', next);
  document.addEventListener('keydown', e=>{
    if(e.key==='ArrowRight') next();
    if(e.key==='ArrowLeft') prev();
  });
  document.getElementById('tocBtn').addEventListener('click', ()=>openDrawer('tocDrawer'));
  document.getElementById('tocSearch').addEventListener('input', e=>{
    renderTocSearch(e.target.value.trim().toLowerCase());
  });
  document.getElementById('searchTop').addEventListener('keydown', e=>{
    if(e.key!=='Enter') return;
    const q = e.target.value.trim().toLowerCase();
    if(!q) return;
    if(/^\d+$/.test(q)){ goTo(parseInt(q,10)); return; }
    const hit = TOC.find(r=>r.title.toLowerCase().includes(q) || (r.brand||'').toLowerCase().includes(q));
    if(hit) goTo(hit.page);
  });
  const ICON_SPEAKER_ON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 8.5a5 5 0 0 1 0 7"/><path d="M19.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const ICON_SPEAKER_OFF = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l5 5M21 9l-5 5"/></svg>';
  document.getElementById('soundBtn').addEventListener('click', (e)=>{
    soundOn = !soundOn;
    e.currentTarget.innerHTML = soundOn ? ICON_SPEAKER_ON : ICON_SPEAKER_OFF;
    if(soundOn){ ensureAudio(); playPageFlipSound(); }
  });

  document.getElementById('themeBtn').addEventListener('click', ()=>{
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    if(next === 'dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    try{ localStorage.setItem('avante_theme', next); }catch(e){}
    trackEvent('theme_toggle', { tema: next });
  });

  trackEvent('catalog_view', {});
}
init();

// ============ SPLASH (boas-vindas, só na primeira visita) ============
// Não depende de init()/loadData() — o botão já funciona mesmo se os dados do catálogo
// ainda estiverem carregando, pra nunca prender o cliente esperando atrás da splash.
document.addEventListener('DOMContentLoaded', ()=>{
  const splash = document.getElementById('splashScreen');
  const enterBtn = document.getElementById('splashEnterBtn');
  if(!splash || !enterBtn) return;
  if(!splash.classList.contains('skip')) enterBtn.focus(); // acessibilidade: foco já no botão principal
  enterBtn.addEventListener('click', ()=>{
    try{ localStorage.setItem('avante_splash_seen', '1'); }catch(e){}
    trackEvent('splash_enter', {});
    splash.classList.add('hide');
    // espera a transição de opacidade (500ms, ver CSS) antes de tirar do fluxo de vez —
    // assim não sobra nenhuma animação/paint rodando atrás depois que o cliente já entrou.
    setTimeout(()=>{ splash.classList.add('skip'); }, 520);
  });
});

// ============ MENU (drawer do hamburguer) ============
document.addEventListener('DOMContentLoaded', ()=>{
  const menuBtn = document.getElementById('menuBtn');
  const drawer = document.getElementById('navDrawer');
  const scrim = document.getElementById('navScrim');
  const closeBtn = document.getElementById('navCloseBtn');
  const catalogoLink = document.getElementById('navCatalogo');
  if(!menuBtn || !drawer || !scrim) return;

  function openMenu(){
    drawer.classList.add('open'); scrim.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    trackEvent('menu_open', {});
  }
  function closeMenu(){
    drawer.classList.remove('open'); scrim.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  scrim.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeMenu(); });
  if(catalogoLink) catalogoLink.addEventListener('click', (e)=>{ e.preventDefault(); closeMenu(); });
});

// ============ LOGO DO HEADER — reage ao gesto de puxar a tela ============
// Dois efeitos, sem NUNCA chamar preventDefault (tudo passive:true) — assim nunca
// disputa com o "puxar pra atualizar" nativo do navegador nem com o arrasto de
// virar página da revista (que escuta pointer events só dentro de #book, não na
// window inteira):
//  1. rolando a página (mouse/trackpad no PC, dedo no celular) o logo encolhe
//     bem suavemente — dá vida ao header sem chamar atenção demais.
//  2. no touch, se o dedo continuar puxando pra baixo depois de já estar no topo
//     (o gesto clássico de "pull to refresh"), o logo estica e "respinga" de
//     volta ao soltar — é só um floreio visual, o navegador decide sozinho se
//     recarrega a página ou não.
(function headerParallax(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const logo = document.querySelector('.brand-logo');
  if(!logo) return;

  function scrollTopNow(){ return (document.scrollingElement || document.body).scrollTop; }

  let pulling = false, startY = 0, scrollRaf = null;

  function applyScrollParallax(){
    if(pulling) return; // o gesto de puxar manda mais que o scroll normal enquanto ativo
    const y = Math.min(scrollTopNow(), 60);
    logo.style.transform = y ? `scale(${(1 - y/700).toFixed(3)})` : '';
  }
  window.addEventListener('scroll', () => {
    if(scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => { applyScrollParallax(); scrollRaf = null; });
  }, { passive: true });

  window.addEventListener('touchstart', (e) => {
    if(scrollTopNow() > 0) return; // só conta como "puxar" se já estiver no topo
    pulling = true;
    startY = e.touches[0].clientY;
    logo.style.transition = 'none';
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if(!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if(dy <= 0){ logo.style.transform = ''; return; }
    const clamped = Math.min(dy, 70);
    logo.style.transform = `translateY(${(clamped * 0.35).toFixed(1)}px) scale(${(1 + clamped/220).toFixed(3)})`;
  }, { passive: true });

  function releasePull(){
    if(!pulling) return;
    pulling = false;
    logo.style.transition = 'transform .45s cubic-bezier(.34,1.56,.64,1)'; // spring — o "respingo" ao soltar
    logo.style.transform = '';
    setTimeout(() => { logo.style.transition = ''; }, 460);
  }
  window.addEventListener('touchend', releasePull, { passive: true });
  window.addEventListener('touchcancel', releasePull, { passive: true });
})();

// hook leve só pra QA/teste automatizado acompanhar o estado da animação sem mexer na UX
window.__isFlipping = () => flipLock;
window.__getCurrent = () => current;
