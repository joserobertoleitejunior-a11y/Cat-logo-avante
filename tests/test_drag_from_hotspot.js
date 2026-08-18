const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport:{width:1000,height:800} });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  page.on('pageerror', e=>console.log('PAGEERROR', e.message));
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  // default agora é Catálogo Rápido; este teste exercita o modo Revista (hotspots da página escaneada)
  await page.click('#modeBookBtn');
  await page.waitForTimeout(400);

  // vai pra página 3 (Casaredo), que tem vários hotspots cobrindo boa parte da página
  await page.fill('#searchTop', '3');
  await page.press('#searchTop', 'Enter');
  await page.waitForTimeout(700);

  const hotspotCount = await page.evaluate(()=>document.querySelectorAll('.leaf.active .hotspot').length);
  console.log('hotspots na página 3:', hotspotCount);

  // pega o bounding box de um hotspot que fique na metade direita da página (zona "forward")
  const hsBox = await page.evaluate(()=>{
    const book = document.getElementById('book').getBoundingClientRect();
    const hotspots = Array.from(document.querySelectorAll('.leaf.active .hotspot'));
    const rightHalf = hotspots.find(h=>{
      const r = h.getBoundingClientRect();
      return (r.left - book.left) > book.width/2;
    });
    if(!rightHalf) return null;
    const r = rightHalf.getBoundingClientRect();
    return { x:r.left + r.width/2, y:r.top + r.height/2 };
  });
  console.log('hotspot escolhido (zona direita) em:', hsBox);
  if(!hsBox){ console.log('FALHOU: nenhum hotspot na metade direita da página'); process.exit(1); }

  const bookBox = await page.locator('#book').boundingBox();

  // 1) ARRASTO começando EM CIMA do hotspot — antes do fix, onPointerDown retornava
  // cedo demais e a página nunca virava.
  await page.mouse.move(hsBox.x, hsBox.y);
  await page.mouse.down();
  for(let i=0;i<10;i++){
    await page.mouse.move(hsBox.x - (bookBox.width*0.7)*(i/9), hsBox.y, {steps:2});
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(900);

  let label = await page.textContent('#pageLabel');
  console.log('depois do arrasto começando no hotspot:', label);
  if(label.trim() !== '4 / 92'){
    console.log('FALHOU: página não virou ao arrastar a partir de um hotspot');
    process.exit(1);
  }
  console.log('OK: arrasto a partir de um hotspot virou a página');

  // 2) TAP simples (sem arrastar) num hotspot ainda deve abrir o produto normalmente
  await page.fill('#searchTop', '3');
  await page.press('#searchTop', 'Enter');
  await page.waitForTimeout(700);
  const hsBox2 = await page.evaluate(()=>{
    const h = document.querySelector('.leaf.active .hotspot');
    const r = h.getBoundingClientRect();
    return { x:r.left + r.width/2, y:r.top + r.height/2 };
  });
  await page.mouse.click(hsBox2.x, hsBox2.y);
  await page.waitForTimeout(300);
  const cartCount = await page.textContent('#cartCount');
  console.log('depois do tap simples no hotspot, carrinho:', cartCount);
  if(cartCount.trim() !== '1'){
    console.log('FALHOU: tap simples no hotspot não selecionou o produto (esperado 1 no carrinho)');
    process.exit(1);
  }
  console.log('OK: tap simples no hotspot selecionou o produto direto (sem abrir o painel)');

  // 3) botão "i" deve abrir o painel de detalhe
  const infoBox = await page.evaluate(()=>{
    const btn = document.querySelector('.leaf.active .hotspot .hotspot-info');
    const r = btn.getBoundingClientRect();
    return { x:r.left + r.width/2, y:r.top + r.height/2 };
  });
  await page.mouse.click(infoBox.x, infoBox.y);
  await page.waitForTimeout(300);
  const drawerOpen = await page.evaluate(()=>document.getElementById('productDrawer').classList.contains('open'));
  console.log('painel de detalhe abriu pelo botão "i"?', drawerOpen);
  if(!drawerOpen){ console.log('FALHOU: botão i não abriu o painel de detalhe'); process.exit(1); }
  console.log('OK: botão "i" abre o painel de detalhe');

  await browser.close();
  console.log('\nTODOS OS TESTES DE ARRASTO/HOTSPOT PASSARAM');
})();
