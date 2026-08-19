/* AVANTE — IA Vendedora (chat dentro do catálogo)
   Hoje roda 100% local (motor de regras + busca no catálogo), sem precisar de nenhuma
   chave de API — funciona offline, direto no navegador do cliente.
   Quando o backend real (backend/functions/ai-vendedora.js, usando Claude de verdade)
   estiver publicado, é só colar a URL em AI_BACKEND_URL (no topo do app.js) que o mesmo
   chat passa a falar com a IA de verdade, sem mudar nada aqui na tela.
*/

// ============ TEXTO / INTENÇÃO ============
function aiNormalize(s){
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

const AI_GREETING_WORDS = ['oi','ola','opa','eae','e ai','bom dia','boa tarde','boa noite','ei'];
function aiIsGreeting(text){
  const q = aiNormalize(text);
  return AI_GREETING_WORDS.some(g => q === g || q.startsWith(g + ' ') || q.startsWith(g + ','));
}

const AI_ORDER_WORDS = ['quero','manda','adiciona','coloca','bota','fecha','separa','reserva','pode ser','pode mandar','isso mesmo','confirma','sim manda','vou levar','me ve'];
function aiHasOrderIntent(text){
  const q = aiNormalize(text);
  return AI_ORDER_WORDS.some(w => q.includes(w));
}

const AI_CLOSE_WORDS = ['orcamento','fechar pedido','enviar pedido','finalizar','mandar pedido','ver carrinho','ver meu pedido','fechar orcamento'];
function aiWantsClose(text){
  const q = aiNormalize(text);
  return AI_CLOSE_WORDS.some(w => q.includes(w));
}

function aiExtractQty(text){
  const m = aiNormalize(text).match(/(\d+)\s*(caixa|caixas|unidade|unidades|und|un|pct|pacote|pacotes)?/);
  if(m && m[1]) return Math.max(1, parseInt(m[1], 10));
  return 1;
}

// palavras muito comuns de conversa (verbos, pronomes, cortesias) — se entrarem na busca,
// batem por acidente dentro de nomes de produto/ingredientes bem longos (ex: "tem" é
// substring de várias palavras num texto de ingredientes OCR). Ficam de fora da busca.
const AI_STOPWORDS = new Set([
  'tem','tem?','voce','voces','sao','com','para','por','uma','um','que','nao','sim',
  'esse','essa','isso','aqui','ali','la','tudo','algo','coisa','preco','custa','quanto',
  'pode','poderia','gostaria','queria','favor','obrigado','obrigada','valeu','tambem','ola'
]);

// pontua produtos pelo tanto de palavras da mensagem que aparecem — de novo, como palavra
// inteira (não substring) — no nome/marca/seção do produto. Comparar palavra inteira em vez
// de "hay.includes(palavra)" evita falso positivo tipo "tem" casando por acaso no meio de
// uma palavra maior de uma descrição longa de ingredientes.
function aiFindProducts(text){
  const q = aiNormalize(text);
  const words = q.split(/\s+/).filter(w => w.length > 2 && !AI_ORDER_WORDS.includes(w) && !AI_STOPWORDS.has(w));
  if(!words.length) return [];
  const scored = PRODUCTS.map(p => {
    const hayWords = new Set(aiNormalize([p.name, p.brand, p.section, p.dept, p.codigo].join(' ')).split(/\W+/).filter(Boolean));
    let score = 0;
    words.forEach(w => { if(hayWords.has(w)) score++; });
    return { p, score };
  }).filter(x => x.score > 0);
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, 3).map(x => x.p);
}

function aiPick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function aiSleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// ============ RESPOSTAS (curtas, sem ponto final à toa, como gente escrevendo mesmo) ============
const AI_REPLIES = {
  greeting: [
    'oi, seja bem-vindo à Avante, me conta o que você precisa que eu já separo',
    'opa, tudo certo por aqui e você',
    'oi, no que posso te ajudar hoje'
  ],
  added: [
    'beleza, já separei {qty} caixa(s) de {name} pra você',
    'prontinho, coloquei {name} no seu orçamento',
    'feito, {name} já está no carrinho'
  ],
  foundAsk: [
    'achei esse aqui, quer que eu já separe',
    'esse aqui deve ser o que você procura, posso adicionar'
  ],
  multiMatch: [
    'achei algumas opções, qual delas você quer',
    'tenho essas aqui, me fala qual prefere'
  ],
  noMatch: [
    'não achei esse item, tenta me falar o nome ou a marca de outro jeito',
    'não encontrei nada parecido, qual é a marca do produto'
  ],
  closeWithItems: [
    'show, já abri seu orçamento com tudo que você escolheu — confirma os dados que eu te mando no whatsapp',
    'beleza, deixei seu orçamento aberto aqui do lado, só confirmar pra eu te mandar'
  ],
  closeEmpty: [
    'seu orçamento ainda está vazio, me diz um produto que eu já coloco',
    'ainda não tem nada no carrinho, quer que eu sugira algo'
  ],
  fallback: [
    'me conta com mais detalhes o que você tá procurando',
    'pode me falar o nome do produto ou a marca que eu busco pra você'
  ]
};

function aiFill(tpl, vars){
  return tpl.replace('{qty}', vars.qty != null ? vars.qty : '').replace('{name}', vars.name || '');
}

// ============ MOTOR LOCAL (sem API — funciona offline) ============
function aiLocalEngine(text){
  if(aiIsGreeting(text)){
    return { lines: [aiPick(AI_REPLIES.greeting)] };
  }
  if(aiWantsClose(text)){
    renderCartDrawer();
    openDrawer('cartDrawer');
    trackEvent('ai_chat_open_cart', { itens: CART.length });
    return { lines: [aiPick(CART.length ? AI_REPLIES.closeWithItems : AI_REPLIES.closeEmpty)] };
  }
  const matches = aiFindProducts(text);
  if(!matches.length){
    return { lines: [aiPick(AI_REPLIES.noMatch)] };
  }
  if(aiHasOrderIntent(text)){
    const top = matches[0];
    const qty = aiExtractQty(text);
    addToCart(top, qty);
    trackEvent('ai_added_to_cart', { codigo: top.codigo, nome: top.name, qty });
    return {
      lines: [aiFill(aiPick(AI_REPLIES.added), { qty, name: top.name })],
      products: [top],
      addedUids: [top.uid]
    };
  }
  if(matches.length === 1){
    return { lines: [aiPick(AI_REPLIES.foundAsk)], products: matches };
  }
  return { lines: [aiPick(AI_REPLIES.multiMatch)], products: matches };
}

// ============ PONTO DE ENTRADA (troca pro backend real quando AI_BACKEND_URL existir) ============
async function aiGetResponse(text){
  if(typeof AI_BACKEND_URL !== 'undefined' && AI_BACKEND_URL){
    try{
      const res = await fetch(AI_BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, cart: CART })
      });
      if(res.ok){
        const data = await res.json();
        const codes = data.product_codes || [];
        const products = codes.map(c => PRODUCTS.find(p => p.codigo === c)).filter(Boolean);
        (data.add_to_cart || []).forEach(cod => {
          const p = PRODUCTS.find(x => x.codigo === cod);
          if(p) addToCart(p, 1);
        });
        return { lines: [data.reply], products, addedCodes: data.add_to_cart || [] };
      }
    }catch(e){
      console.debug('[ai] backend indisponível, usando motor local', e);
    }
  }
  return aiLocalEngine(text);
}

// ============ UI DO CHAT ============
function aiAddMessage(role, text){
  const wrap = document.getElementById('aiMessages');
  const bubble = document.createElement('div');
  bubble.className = 'msg ' + role;
  bubble.textContent = text;
  if(role === 'ai'){
    // mensagens da atendente ganham avatarzinho ao lado da bolha — o cliente não precisa de um pra si
    const row = document.createElement('div');
    row.className = 'msg-row';
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = AI_AVATAR_LETTER;
    avatar.setAttribute('aria-hidden', 'true');
    row.append(avatar, bubble);
    wrap.appendChild(row);
  } else {
    wrap.appendChild(bubble);
  }
  wrap.scrollTop = wrap.scrollHeight;
}

function aiAddProductCard(p, added){
  const wrap = document.getElementById('aiMessages');
  const row = document.createElement('div');
  row.className = 'msg-row';
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = AI_AVATAR_LETTER;
  avatar.setAttribute('aria-hidden', 'true');
  const div = document.createElement('div');
  div.className = 'msg ai chat-product';
  const displayName = (typeof prettyName === 'function') ? prettyName(p.name) : p.name;
  div.innerHTML = `
    <img src="${p.photo || ('/catalogo/images/thumbs/thumb-' + String(p.page).padStart(2,'0') + '.jpg')}" alt="${displayName}">
    <div class="cp-info">
      <div class="cp-name">${displayName}</div>
      <div class="cp-meta">${p.caixa || ''}</div>
      <button class="btn-sm primary cp-add">${added ? '✓ adicionado' : '+ adicionar'}</button>
    </div>`;
  row.append(avatar, div);
  const btn = div.querySelector('.cp-add');
  btn.addEventListener('click', () => {
    if(isInCart(p.uid)){
      removeFromCart(p.uid);
      btn.textContent = '+ adicionar';
    } else {
      addToCart(p, 1);
      btn.textContent = '✓ adicionado';
      aiAddMessage('ai', aiFill(aiPick(AI_REPLIES.added), { qty: 1, name: p.name }));
      trackEvent('ai_added_to_cart', { codigo: p.codigo, nome: p.name, qty: 1, origem: 'chat_card' });
    }
    refreshSelectionUI();
  });
  wrap.appendChild(row);
  wrap.scrollTop = wrap.scrollHeight;
}

function aiShowTyping(on){
  document.getElementById('aiTyping').classList.toggle('show', on);
  const wrap = document.getElementById('aiMessages');
  wrap.scrollTop = wrap.scrollHeight;
}

let aiGreeted = false;
async function aiHandleUserMessage(text){
  aiAddMessage('user', text);
  trackEvent('ai_chat_message', { text });
  aiShowTyping(true);
  // pequeno atraso pra parecer alguém digitando de verdade, não uma resposta instantânea de robô
  await aiSleep(500 + Math.random() * 500);
  const reply = await aiGetResponse(text);
  aiShowTyping(false);
  (reply.lines || []).forEach(line => aiAddMessage('ai', line));
  (reply.products || []).forEach(p => {
    const alreadyAdded = (reply.addedUids || []).includes(p.uid) || (reply.addedCodes || []).includes(p.codigo);
    aiAddProductCard(p, alreadyAdded);
  });
  refreshSelectionUI();
}

// letra do avatar (bolha redonda com uma letra) — sempre a primeira letra do
// nome configurado no admin (Config > Nome da vendedora IA), "Atendente Avante"
// por padrão. Lido uma vez e reusado nas bolhas de mensagem (evita chamar
// getAiName()/localStorage a cada mensagem digitada).
const AI_DISPLAY_NAME = (typeof getAiName === 'function') ? getAiName() : 'Atendente Avante';
const AI_AVATAR_LETTER = AI_DISPLAY_NAME.trim().charAt(0).toUpperCase() || 'A';

document.addEventListener('DOMContentLoaded', () => {
  const fab = document.getElementById('aiFab');
  const panel = document.getElementById('aiPanel');
  const closeBtn = document.getElementById('aiCloseBtn');
  const form = document.getElementById('aiForm');
  const input = document.getElementById('aiInput');

  const nameEl = document.getElementById('aiNameLabel');
  const avatarEl = document.getElementById('aiAvatarLetter');
  const fabLabelEl = document.getElementById('aiFabLabel');
  if(nameEl) nameEl.textContent = AI_DISPLAY_NAME;
  if(avatarEl) avatarEl.textContent = AI_AVATAR_LETTER;
  if(fabLabelEl) fabLabelEl.textContent = 'Fale com a gente';
  fab.setAttribute('aria-label', 'Falar com a ' + AI_DISPLAY_NAME);

  fab.addEventListener('click', () => {
    panel.classList.add('open');
    trackEvent('ai_chat_open', {});
    if(!aiGreeted){
      aiGreeted = true;
      aiShowTyping(true);
      setTimeout(() => { aiShowTyping(false); aiAddMessage('ai', aiPick(AI_REPLIES.greeting)); }, 500);
    }
    setTimeout(() => input.focus(), 320);
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if(!text) return;
    input.value = '';
    aiHandleUserMessage(text);
  });
});

// hooks leves só pra QA automatizado — não afetam a UX
window.__aiFindProducts = aiFindProducts;
window.__aiHasOrderIntent = aiHasOrderIntent;
