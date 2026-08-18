const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  // default agora é Catálogo Rápido; entra na Revista pra medir o livro antes do bug de resize
  await page.click('#modeBookBtn');
  await page.waitForTimeout(300);

  let box = await page.locator('#book').boundingBox();
  console.log('tamanho inicial do livro:', box.width, box.height);

  // vai pro catálogo rápido
  await page.click('#modeFastBtn');
  await page.waitForTimeout(300);

  // simula uma mudança de viewport (rotação de tela / teclado abrindo) enquanto
  // a revista está escondida (display:none) -- isso é o que reproduzia o bug
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);

  // volta pra revista
  await page.click('#modeBookBtn');
  await page.waitForTimeout(300);

  box = await page.locator('#book').boundingBox();
  console.log('tamanho do livro depois de ir/voltar do catálogo rápido + resize:', box.width, box.height);

  if(box.width < 200){
    console.log('FALHOU: livro encolheu pro tamanho mínimo (bug reproduzido)');
    process.exit(1);
  } else {
    console.log('OK: livro manteve tamanho correto');
  }

  await browser.close();
})();
