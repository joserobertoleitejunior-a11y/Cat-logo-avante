const { chromium } = require('playwright');

function log(...a){ console.log(...a); }

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const results = [];
  const fail = (msg) => { results.push('FAIL: ' + msg); };
  const ok = (msg) => { results.push('OK: ' + msg); };

  async function newPage(viewport){
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type()!=='error') return;
      // ERR_TUNNEL_CONNECTION_FAILED no Google Fonts é uma restrição de rede deste sandbox
      // de teste (sem acesso a fonts.googleapis.com) — não existe no navegador real do
      // cliente, e o CSS já tem fallback de fonte (Georgia/system-ui) pra não travar nada
      // mesmo se a fonte falhar. Ignorado aqui pra não confundir com um bug de verdade.
      if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(m.text())) return;
      errors.push('console: ' + m.text());
    });
    // capture window.open calls without actually opening
    await page.addInitScript(() => {
      window.__opened = [];
      const orig = window.open;
      window.open = (url, ...rest) => { window.__opened.push(url); return { closed:false }; };
    });
    return { page, errors };
  }

  // ---------- DESKTOP ----------
  {
    const { page, errors } = await newPage({ width: 1200, height: 860 });
    await page.goto('http://localhost:8099/catalogo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const title = await page.title();
    title.includes('AVANTE') ? ok('título correto') : fail('título incorreto: ' + title);

    // imagens carregadas dentro da janela (lazy loading)
    let loadedImgs = await page.evaluate(() => document.querySelectorAll('.face.front img[src]').length);
    (loadedImgs > 0 && loadedImgs <= 11) ? ok(`lazy-load ok no início (${loadedImgs} imgs com src, esperado <=11)`) : fail(`lazy-load suspeito: ${loadedImgs} imgs com src`);

    // avançar 5 páginas clicando
    for (let i=0;i<5;i++){
      await page.click('#nextBtn');
      await page.waitForTimeout(950);
    }
    let pageLabel = await page.textContent('#pageLabel');
    pageLabel.trim() === '6 / 92' ? ok('avançou 5 páginas via clique: ' + pageLabel) : fail('label errado após 5 clicks: ' + pageLabel);

    loadedImgs = await page.evaluate(() => document.querySelectorAll('.face.front img[src]').length);
    (loadedImgs > 0 && loadedImgs <= 15) ? ok(`lazy-load ok após navegação (${loadedImgs} imgs)`) : fail(`lazy-load descontrolado após navegação: ${loadedImgs} imgs`);

    // voltar 2
    await page.click('#prevBtn'); await page.waitForTimeout(950);
    await page.click('#prevBtn'); await page.waitForTimeout(950);
    pageLabel = await page.textContent('#pageLabel');
    pageLabel.trim() === '4 / 92' ? ok('voltou 2 páginas: ' + pageLabel) : fail('label errado após voltar: ' + pageLabel);

    // ir para página 3 (Casaredo) via busca
    await page.fill('#searchTop', '3');
    await page.press('#searchTop', 'Enter');
    await page.waitForTimeout(700);
    pageLabel = await page.textContent('#pageLabel');
    pageLabel.trim() === '3 / 92' ? ok('busca por número de página ok') : fail('busca por página falhou: ' + pageLabel);

    // hotspot deve existir na página 3 (Casaredo tem produtos com EAN)
    const hotspotCount = await page.evaluate(() => document.querySelectorAll('.leaf .hotspot').length);
    hotspotCount > 0 ? ok(`hotspots presentes: ${hotspotCount}`) : fail('nenhum hotspot encontrado na página 3');

    // clicar num hotspot -> seleciona direto (não abre mais o painel; isso agora é o botão "i")
    if(hotspotCount>0){
      await page.click('.leaf.active .hotspot');
      await page.waitForTimeout(300);
      const selectedDirect = await page.evaluate(() => document.querySelector('.leaf.active .hotspot').classList.contains('selected'));
      selectedDirect ? ok('toque no hotspot seleciona direto (selo de check aplicado)') : fail('hotspot não ficou selecionado após o toque');
      const cartAfterHotspotTap = await page.textContent('#cartCount');
      cartAfterHotspotTap.trim() === '1' ? ok('carrinho atualizado pelo toque direto no hotspot') : fail('carrinho não bateu após toque no hotspot: ' + cartAfterHotspotTap);
      // desfaz a seleção direta pra não interferir no resto do teste (fluxo abaixo usa o botão "i")
      await page.click('.leaf.active .hotspot');
      await page.waitForTimeout(300);

      await page.click('.leaf.active .hotspot .hotspot-info');
      await page.waitForTimeout(400);
      const drawerOpen = await page.evaluate(() => document.getElementById('productDrawer').classList.contains('open'));
      drawerOpen ? ok('botão "i" do hotspot abre o painel de produto') : fail('painel de produto NÃO abriu pelo botão "i"');
      const pname = await page.textContent('#productName');
      pname.trim().length > 0 ? ok('nome do produto preenchido: ' + pname.trim()) : fail('nome do produto vazio');

      // adicionar ao carrinho
      await page.click('#qtyPlus'); await page.click('#qtyPlus'); // qty = 3
      const qty = await page.textContent('#qtyVal');
      qty.trim() === '3' ? ok('stepper de quantidade ok (3)') : fail('stepper quantidade errado: ' + qty);
      await page.click('#addToCartBtn');
      await page.waitForTimeout(300);
      const cartCount = await page.textContent('#cartCount');
      cartCount.trim() === '3' ? ok('badge do carrinho atualizado: ' + cartCount) : fail('badge do carrinho errado: ' + cartCount);
    }

    // abrir carrinho, ir pro lead form, preencher e enviar
    await page.click('#cartFab');
    await page.waitForTimeout(300);
    const cartOpen = await page.evaluate(() => document.getElementById('cartDrawer').classList.contains('open'));
    cartOpen ? ok('drawer do carrinho abriu') : fail('drawer do carrinho não abriu');

    await page.click('#sendQuoteBtn');
    await page.waitForTimeout(300);
    await page.fill('#leadNome', 'Marcos Teste');
    await page.fill('#leadEmpresa', 'Mercadinho Teste');
    await page.fill('#leadCidade', 'Campo Limpo Paulista');
    await page.fill('#leadTelefone', '11999998888');
    await page.click('#leadForm button[type=submit]');
    await page.waitForTimeout(300);
    const opened = await page.evaluate(() => window.__opened);
    (opened.length===1 && opened[0].includes('wa.me') && opened[0].includes('Marcos%20Teste'))
      ? ok('link do WhatsApp gerado corretamente: ' + opened[0].slice(0,80)+'...')
      : fail('link do WhatsApp incorreto: ' + JSON.stringify(opened));

    // TOC + busca de produto (substitui o Catálogo Rápido, que não existe mais —
    // a Revista é o único modo do site)
    await page.click('#tocBtn');
    await page.waitForTimeout(300);
    const tocOpen = await page.evaluate(() => document.getElementById('tocDrawer').classList.contains('open'));
    tocOpen ? ok('índice abriu') : fail('índice não abriu');
    const tocItems = await page.evaluate(() => document.querySelectorAll('#tocList .toc-item').length);
    tocItems > 10 ? ok('índice populado: ' + tocItems + ' itens') : fail('índice com poucos itens: ' + tocItems);

    await page.fill('#tocSearch', 'casaredo');
    await page.waitForTimeout(300);
    const listHidden = await page.evaluate(() => document.getElementById('tocList').style.display === 'none');
    const results = await page.evaluate(() => document.querySelectorAll('#tocSearchResults .toc-item').length);
    (listHidden && results > 0) ? ok('busca no índice filtrou: ' + results + ' resultado(s)') : fail('busca no índice não filtrou corretamente: results=' + results);

    await page.click('#tocSearchResults .toc-item');
    await page.waitForTimeout(500);
    const tocClosedAfterClick = await page.evaluate(() => !document.getElementById('tocDrawer').classList.contains('open'));
    tocClosedAfterClick ? ok('clique no resultado da busca fechou o índice e navegou') : fail('índice não fechou após clicar num resultado');

    await page.screenshot({ path: '/home/claude/avante/revista2/_shot_desktop_book.png' });

    if(errors.length){ errors.forEach(e=>fail('JS error desktop: '+e)); } else { ok('nenhum erro JS no fluxo desktop'); }
    await page.close();
  }

  // ---------- ARRASTO REAL (drag physics) ----------
  {
    const { page, errors } = await newPage({ width: 1000, height: 800 });
    await page.goto('http://localhost:8099/catalogo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const bookBox = await page.locator('#book').boundingBox();
    const startX = bookBox.x + bookBox.width*0.8;
    const y = bookBox.y + bookBox.height/2;

    // Drag completo (deve virar a página)
    await page.mouse.move(startX, y);
    await page.mouse.down();
    for(let i=0;i<10;i++){
      await page.mouse.move(startX - (bookBox.width*0.75)*(i/9), y, {steps:2});
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    await page.waitForTimeout(800);
    let pageLabel = await page.textContent('#pageLabel');
    pageLabel.trim() === '2 / 92' ? ok('arrasto completo virou a página: ' + pageLabel) : fail('arrasto completo não virou a página: ' + pageLabel);

    // Drag curto (não deve virar - volta pro lugar)
    const bookBox2 = await page.locator('#book').boundingBox();
    const startX2 = bookBox2.x + bookBox2.width*0.8;
    await page.mouse.move(startX2, y);
    await page.mouse.down();
    await page.mouse.move(startX2 - bookBox2.width*0.12, y, {steps:3});
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(800);
    pageLabel = await page.textContent('#pageLabel');
    pageLabel.trim() === '2 / 92' ? ok('arrasto curto voltou (spring-back): ' + pageLabel) : fail('arrasto curto deveria ter voltado, mas: ' + pageLabel);

    if(errors.length){ errors.forEach(e=>fail('JS error drag: '+e)); } else { ok('nenhum erro JS no fluxo de arrasto'); }
    await page.close();
  }

  // ---------- MOBILE ----------
  {
    const { page, errors } = await newPage({ width: 390, height: 780 });
    await page.goto('http://localhost:8099/catalogo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/home/claude/avante/revista2/_shot_mobile_book.png' });

    const bookBox = await page.locator('#book').boundingBox();
    (bookBox.width <= 390 && bookBox.height <= 780) ? ok(`livro cabe na tela mobile (${Math.round(bookBox.width)}x${Math.round(bookBox.height)})`) : fail(`livro fora da tela mobile: ${JSON.stringify(bookBox)}`);

    if(errors.length){ errors.forEach(e=>fail('JS error mobile: '+e)); } else { ok('nenhum erro JS no mobile'); }
    await page.close();
  }

  await browser.close();

  console.log('\n===== RESULTADO =====');
  results.forEach(r => console.log(r));
  const failures = results.filter(r => r.startsWith('FAIL'));
  console.log(`\n${results.length - failures.length}/${results.length} passaram`);
  if(failures.length){ console.log('\nFALHAS:'); failures.forEach(f=>console.log(' -', f)); process.exit(1); }
})();
