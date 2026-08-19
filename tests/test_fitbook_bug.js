const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(500);

  let box = await page.locator('#book').boundingBox();
  console.log('tamanho inicial do livro:', box.width, box.height);

  // simula rotação de tela / teclado abrindo e fechando — a revista é o único modo
  // agora, sempre visível, mas o livro ainda precisa recalcular o próprio tamanho
  // corretamente a cada mudança de viewport.
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);

  box = await page.locator('#book').boundingBox();
  console.log('tamanho do livro depois do resize:', box.width, box.height);

  if(box.width < 200){
    console.log('FALHOU: livro encolheu pro tamanho mínimo (bug reproduzido)');
    process.exit(1);
  } else {
    console.log('OK: livro manteve tamanho correto após resize');
  }

  await browser.close();
})();
