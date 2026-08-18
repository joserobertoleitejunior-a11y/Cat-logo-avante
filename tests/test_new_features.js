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

  // ---------- SELEÇÃO NO CATÁLOGO RÁPIDO ----------
  await page.click('#modeFastBtn');
  await page.waitForTimeout(400);

  const firstCard = page.locator('.card').first();
  const cod = await firstCard.getAttribute('data-codigo');
  ok('primeiro card tem data-codigo: ' + cod);

  let selectedBefore = await page.evaluate((c) => document.querySelector(`.card[data-codigo="${c}"]`).classList.contains('selected'), cod);
  selectedBefore === false ? ok('card começa não-selecionado') : fail('card já começa selecionado (inesperado)');

  await firstCard.locator('.btn-sm.primary').click();
  await page.waitForTimeout(200);
  let selectedAfter = await page.evaluate((c) => document.querySelector(`.card[data-codigo="${c}"]`).classList.contains('selected'), cod);
  selectedAfter === true ? ok('um toque seleciona o card (classe .selected aplicada)') : fail('card não ficou selecionado após o toque');

  let btnText = await firstCard.locator('.btn-sm.primary').textContent();
  btnText.includes('No orçamento') ? ok('botão muda de texto pra "No orçamento": ' + btnText.trim()) : fail('texto do botão não mudou: ' + btnText);

  const cartCountAfterSelect = await page.textContent('#cartCount');
  cartCountAfterSelect.trim() === '1' ? ok('carrinho atualizado com 1 item pela seleção direta') : fail('carrinho não bateu: ' + cartCountAfterSelect);

  // toca de novo — deve desselecionar (toggle)
  await firstCard.locator('.btn-sm.primary').click();
  await page.waitForTimeout(200);
  let selectedToggleOff = await page.evaluate((c) => document.querySelector(`.card[data-codigo="${c}"]`).classList.contains('selected'), cod);
  selectedToggleOff === false ? ok('segundo toque desseleciona (toggle completo)') : fail('não desselecionou no segundo toque');

  // ---------- SELEÇÃO REFLETE NO HOTSPOT DA REVISTA ----------
  await firstCard.locator('.btn-sm.primary').click(); // seleciona de novo
  await page.waitForTimeout(200);
  const pagAttr = await page.evaluate((c) => {
    // acha a página desse produto via PRODUCTS
    const p = PRODUCTS.find(x => x.codigo === c);
    return p ? p.page : null;
  }, cod);
  await page.click('#modeBookBtn');
  await page.waitForTimeout(300);
  await page.fill('#searchTop', String(pagAttr));
  await page.press('#searchTop', 'Enter');
  await page.waitForTimeout(700);
  const hotspotSelected = await page.evaluate((c) => {
    const hs = document.querySelector(`.hotspot[data-codigo="${c}"]`);
    return hs ? hs.classList.contains('selected') : null;
  }, cod);
  hotspotSelected === true ? ok('hotspot na revista mostra selo de selecionado (checkmark)') : fail('hotspot não mostrou selo de selecionado: ' + hotspotSelected);

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
