const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const errors = [];
  const context = await browser.newContext({ viewport:{width:1000,height:800} });
  const page = await context.newPage();
  page.on('pageerror', e=>errors.push(e.message));

  // primeira visita: nada liberado ainda
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle'});
  await page.waitForTimeout(300);

  const overlayVisible = await page.evaluate(()=>!!document.getElementById('pinGateOverlay'));
  if(!overlayVisible){ console.log('FALHOU: overlay de PIN deveria aparecer na primeira visita'); process.exit(1); }
  console.log('OK: overlay de PIN aparece na primeira visita');

  const contentHidden = await page.evaluate(()=>getComputedStyle(document.getElementById('app')).display === 'none');
  if(!contentHidden){ console.log('FALHOU: conteúdo do catálogo deveria estar escondido atrás do PIN'); process.exit(1); }
  console.log('OK: conteúdo fica escondido atrás do PIN (não vaza no DOM visível)');

  // PIN errado
  await page.fill('#pgInput', '0000');
  await page.click('#pgForm button');
  await page.waitForTimeout(200);
  const errShown = await page.evaluate(()=>document.getElementById('pgErr').classList.contains('show'));
  const stillLocked = await page.evaluate(()=>!!document.getElementById('pinGateOverlay'));
  if(!errShown || !stillLocked){ console.log('FALHOU: PIN errado deveria mostrar erro e manter travado'); process.exit(1); }
  console.log('OK: PIN errado mostra erro e mantém travado');

  // PIN certo
  await page.fill('#pgInput', '4546');
  await page.click('#pgForm button');
  await page.waitForTimeout(200);
  const unlocked = await page.evaluate(()=>!document.getElementById('pinGateOverlay'));
  if(!unlocked){ console.log('FALHOU: PIN certo deveria remover o overlay'); process.exit(1); }
  console.log('OK: PIN certo libera o acesso');

  const flagSaved = await page.evaluate(()=>localStorage.getItem('avante_demo_pin_ok'));
  if(flagSaved !== '1'){ console.log('FALHOU: flag de liberação não foi salva'); process.exit(1); }
  console.log('OK: liberação fica salva no localStorage (não pede de novo)');

  // reload não deve pedir de novo
  await page.reload({waitUntil:'networkidle'});
  await page.waitForTimeout(300);
  const overlayOnReturn = await page.evaluate(()=>!!document.getElementById('pinGateOverlay'));
  if(overlayOnReturn){ console.log('FALHOU: PIN pediu de novo numa visita já liberada'); process.exit(1); }
  console.log('OK: não pede PIN de novo depois de liberado');

  // liberar o admin (crm) destrava sozinho por já estar na mesma origem
  const page2 = await context.newPage();
  await page2.goto('http://localhost:8099/crm/crm_dashboard.html', {waitUntil:'networkidle'});
  await page2.waitForTimeout(300);
  const crmOverlay = await page2.evaluate(()=>!!document.getElementById('pinGateOverlay'));
  if(crmOverlay){ console.log('FALHOU: admin deveria estar liberado também (mesma origem, já destravado pelo catálogo)'); process.exit(1); }
  console.log('OK: liberar o catálogo libera o admin também (mesma origem)');
  await page2.close();

  // link com ?pin= libera direto, sem precisar digitar
  const page3 = await context.newPage();
  await page3.addInitScript(() => localStorage.clear());
  await page3.goto('http://localhost:8099/catalogo/index.html?pin=4546', {waitUntil:'networkidle'});
  await page3.waitForTimeout(300);
  const autoUnlocked = await page3.evaluate(()=>!document.getElementById('pinGateOverlay'));
  if(!autoUnlocked){ console.log('FALHOU: link com ?pin= deveria liberar automaticamente'); process.exit(1); }
  console.log('OK: link com ?pin=4546 libera automaticamente, sem digitar');
  await page3.close();

  if(errors.length){ console.log('FALHOU: erros JS:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS em todo o fluxo do PIN gate');

  await browser.close();
  console.log('\nTODOS OS TESTES DO PIN GATE PASSARAM');
})();
