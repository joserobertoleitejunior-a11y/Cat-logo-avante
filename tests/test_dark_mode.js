const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport:{width:1000,height:800} });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(400);

  let theme = await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  if(theme !== null){ console.log('FALHOU: deveria começar claro (sem tema salvo), mas veio', theme); process.exit(1); }
  console.log('OK: tema inicial claro');

  await page.click('#themeBtn');
  await page.waitForTimeout(300);
  theme = await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  if(theme !== 'dark'){ console.log('FALHOU: clique no themeBtn deveria ativar dark, veio', theme); process.exit(1); }
  console.log('OK: clique ativa tema escuro');

  const saved = await page.evaluate(()=>localStorage.getItem('avante_theme'));
  if(saved !== 'dark'){ console.log('FALHOU: tema não foi salvo no localStorage:', saved); process.exit(1); }
  console.log('OK: tema salvo no localStorage');

  await page.reload({waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  theme = await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  if(theme !== 'dark'){ console.log('FALHOU: tema não persistiu após reload:', theme); process.exit(1); }
  console.log('OK: tema persiste após reload (sem flash de tela clara)');

  // clica de novo -> volta pro claro
  await page.click('#themeBtn');
  await page.waitForTimeout(300);
  theme = await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  if(theme !== null){ console.log('FALHOU: segundo clique deveria voltar ao claro, veio', theme); process.exit(1); }
  console.log('OK: segundo clique volta ao tema claro');

  if(errors.length){ console.log('FALHOU: erros JS:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS no fluxo de tema');

  await browser.close();
  console.log('\nTODOS OS TESTES DE TEMA ESCURO PASSARAM');
})();
