const { chromium } = require('playwright');

function log(...a){ console.log(...a); }

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const results = [];
  const fail = (msg) => { results.push('FAIL: ' + msg); };
  const ok = (msg) => { results.push('OK: ' + msg); };

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type()!=='error') return;
    if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(m.text())) return;
    errors.push('console: ' + m.text());
  });
  await page.goto('http://localhost:8099/catalogo/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ---------- SELEÇÃO NO HOTSPOT DA REVISTA (único modo do site) ----------
  // página 3 (Casaredo) tem vários hotspots
  await page.fill('#searchTop', '3');
  await page.press('#searchTop', 'Enter');
  await page.waitForTimeout(700);

  const firstHotspot = page.locator('.leaf.in-window.active .hotspot').first();
  const uid = await firstHotspot.getAttribute('data-uid');
  ok('primeiro hotspot visível tem data-uid: ' + uid);

  let selectedBefore = await page.evaluate((u) => document.querySelector(`.hotspot[data-uid="${u}"]`).classList.contains('selected'), uid);
  selectedBefore === false ? ok('hotspot começa não-selecionado') : fail('hotspot já começa selecionado (inesperado)');

  await firstHotspot.click();
  await page.waitForTimeout(200);
  let selectedAfter = await page.evaluate((u) => document.querySelector(`.hotspot[data-uid="${u}"]`).classList.contains('selected'), uid);
  selectedAfter === true ? ok('um toque seleciona o hotspot (selo de check aparece)') : fail('hotspot não ficou selecionado após o toque');

  const cartCountAfterSelect = await page.textContent('#cartCount');
  cartCountAfterSelect.trim() === '1' ? ok('carrinho atualizado com 1 item pela seleção direta') : fail('carrinho não bateu: ' + cartCountAfterSelect);

  // toca de novo — deve desselecionar (toggle)
  await firstHotspot.click();
  await page.waitForTimeout(200);
  let selectedToggleOff = await page.evaluate((u) => document.querySelector(`.hotspot[data-uid="${u}"]`).classList.contains('selected'), uid);
  selectedToggleOff === false ? ok('segundo toque desseleciona (toggle completo)') : fail('não desselecionou no segundo toque');
  await firstHotspot.click(); // seleciona de novo, pro resto do teste

  // ---------- BUSCA NO ÍNDICE LEVA ATÉ O PRODUTO ----------
  const prodName = await page.evaluate((u) => {
    const p = PRODUCTS.find(x => x.uid === u);
    return p ? p.name : null;
  }, uid);
  await page.click('#tocBtn');
  await page.waitForTimeout(200);
  await page.fill('#tocSearch', prodName.split(' ')[0]);
  await page.waitForTimeout(300);
  const searchHasResult = await page.evaluate((u) => !!document.querySelector(`#tocSearchResults .toc-item[data-uid="${u}"]`), uid);
  searchHasResult ? ok('busca no índice encontra o produto pelo nome') : fail('busca no índice não encontrou o produto: ' + prodName);
  await page.click('.btn-x[data-close-drawer="tocDrawer"]');

  if(errors.length){ errors.forEach(e=>fail('JS error (seleção): '+e)); errors.length = 0; } else { ok('nenhum erro JS no fluxo de seleção'); }

  // ---------- IA VENDEDORA — CHAT ----------
  await page.click('#aiFab');
  await page.waitForTimeout(1200); // espera a saudação (tem delay de "digitando")
  const panelOpen = await page.evaluate(() => document.getElementById('aiPanel').classList.contains('open'));
  panelOpen ? ok('painel do chat abriu') : fail('painel do chat não abriu');

  const greetingCount = await page.evaluate(() => document.querySelectorAll('#aiMessages .msg.ai').length);
  greetingCount >= 1 ? ok('IA mandou mensagem de saudação (' + greetingCount + ' msg)') : fail('nenhuma saudação apareceu');

  // pede um produto específico com intenção de pedido clara
  await page.fill('#aiInput', 'quero 2 caixas de biscoito casaredo agua e sal');
  await page.click('.ai-send');
  await page.waitForTimeout(1600); // delay de "digitando" + processamento

  const aiMsgsAfter = await page.evaluate(() => Array.from(document.querySelectorAll('#aiMessages .msg')).map(m=>({cls:m.className, text:m.textContent})));
  log('mensagens do chat:', JSON.stringify(aiMsgsAfter, null, 2));

  const hasUserMsg = aiMsgsAfter.some(m => m.cls.includes('user') && m.text.includes('biscoito casaredo'));
  hasUserMsg ? ok('mensagem do usuário apareceu no chat') : fail('mensagem do usuário não apareceu');

  const hasProductCard = aiMsgsAfter.some(m => m.cls.includes('chat-product'));
  hasProductCard ? ok('IA mostrou card de produto com imagem inline no chat') : fail('nenhum card de produto apareceu no chat');

  const cartCountAfterAI = await page.textContent('#cartCount');
  const cartTotal = parseInt(cartCountAfterAI.trim() || '0', 10);
  cartTotal >= 2 ? ok('IA adicionou automaticamente ao carrinho (badge=' + cartTotal + ', esperado >=2 pois já tinha 1 selecionado)') : fail('IA não adicionou ao carrinho: badge=' + cartCountAfterAI);

  // testa saudação
  await page.fill('#aiInput', 'oi');
  await page.click('.ai-send');
  await page.waitForTimeout(1400);
  const msgsAfterGreeting = await page.evaluate(() => document.querySelectorAll('#aiMessages .msg.ai').length);
  msgsAfterGreeting > greetingCount + 1 ? ok('IA respondeu à saudação "oi"') : fail('IA não respondeu à saudação corretamente (count=' + msgsAfterGreeting + ')');

  // testa produto que não existe
  await page.fill('#aiInput', 'vocês tem foguete espacial');
  await page.click('.ai-send');
  await page.waitForTimeout(1400);
  const lastMsg = await page.evaluate(() => {
    const all = document.querySelectorAll('#aiMessages .msg.ai');
    return all[all.length-1].textContent;
  });
  log('resposta pra item inexistente:', lastMsg);
  ok('IA respondeu a um item inexistente sem travar: "' + lastMsg.slice(0,60) + '..."');

  if(errors.length){ errors.forEach(e=>fail('JS error (chat IA): '+e)); } else { ok('nenhum erro JS no fluxo do chat IA'); }

  await page.screenshot({ path: '/home/claude/avante/revista2/_test_ai_chat.png' });

  await browser.close();

  console.log('\n===== RESULTADO (novas features) =====');
  results.forEach(r => console.log(r));
  const failures = results.filter(r => r.startsWith('FAIL'));
  console.log(`\n${results.length - failures.length}/${results.length} passaram`);
  if(failures.length){ console.log('\nFALHAS:'); failures.forEach(f=>console.log(' -', f)); process.exit(1); }
})();
