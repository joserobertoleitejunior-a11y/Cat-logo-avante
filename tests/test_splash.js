const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const errors = [];
  const page = await browser.newPage({ viewport:{width:1000,height:800} });
  await page.addInitScript(() => localStorage.setItem('avante_demo_pin_ok','1'));
  page.on('pageerror', e=>errors.push(e.message));

  // primeira visita: localStorage limpo
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.evaluate(()=>localStorage.removeItem('avante_splash_seen'));
  await page.reload({waitUntil:'networkidle'});
  await page.waitForTimeout(400);

  const splashVisible = await page.evaluate(()=>{
    const el = document.getElementById('splashScreen');
    return !el.classList.contains('skip') && getComputedStyle(el).display !== 'none';
  });
  if(!splashVisible){ console.log('FALHOU: splash deveria aparecer na primeira visita'); process.exit(1); }
  console.log('OK: splash aparece na primeira visita');

  const focused = await page.evaluate(()=>document.activeElement.id);
  if(focused !== 'splashEnterBtn'){ console.log('FALHOU: foco deveria estar no botão de entrar, está em:', focused); process.exit(1); }
  console.log('OK: foco vai pro botão principal (acessibilidade)');

  // o catálogo por trás já deve estar carregado mesmo com a splash em cima
  const pageLabelBehind = await page.textContent('#pageLabel');
  if(!pageLabelBehind.includes('92')){ console.log('FALHOU: catálogo não carregou por trás da splash:', pageLabelBehind); process.exit(1); }
  console.log('OK: catálogo carrega normalmente por trás da splash (não fica bloqueado esperando)');

  await page.click('#splashEnterBtn');
  await page.waitForTimeout(700);
  const splashGoneClass = await page.evaluate(()=>document.getElementById('splashScreen').classList.contains('skip'));
  const splashDisplay = await page.evaluate(()=>getComputedStyle(document.getElementById('splashScreen')).display);
  if(!splashGoneClass || splashDisplay !== 'none'){ console.log('FALHOU: splash não sumiu de vez depois do clique'); process.exit(1); }
  console.log('OK: splash some completamente (display:none) depois do clique, sem ficar rodando animação atrás');

  const flagSaved = await page.evaluate(()=>localStorage.getItem('avante_splash_seen'));
  if(flagSaved !== '1'){ console.log('FALHOU: flag de "já viu a splash" não foi salva'); process.exit(1); }
  console.log('OK: flag salva no localStorage');

  // catálogo continua 100% funcional depois de dispensar a splash
  // (default agora é Catálogo Rápido; entra no modo Revista pra testar a navegação de página)
  await page.click('#modeBookBtn');
  await page.waitForTimeout(400);
  await page.click('#nextBtn');
  await page.waitForTimeout(900);
  const label2 = await page.textContent('#pageLabel');
  if(label2.trim() !== '2 / 92'){ console.log('FALHOU: navegação não funciona depois da splash:', label2); process.exit(1); }
  console.log('OK: catálogo funciona normalmente depois de fechar a splash');

  // segunda visita (reload): não deve aparecer de novo, nem piscar
  await page.reload({waitUntil:'networkidle'});
  await page.waitForTimeout(300);
  const splashOnReturn = await page.evaluate(()=>{
    const el = document.getElementById('splashScreen');
    return getComputedStyle(el).display;
  });
  if(splashOnReturn !== 'none'){ console.log('FALHOU: splash apareceu de novo numa visita de retorno'); process.exit(1); }
  console.log('OK: splash não aparece de novo em visita de retorno (direto pro catálogo)');

  if(errors.length){ console.log('FALHOU: erros JS:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS em todo o fluxo da splash');

  await browser.close();
  console.log('\nTODOS OS TESTES DA SPLASH PASSARAM');
})();
