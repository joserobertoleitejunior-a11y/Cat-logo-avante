const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport:{width:1200,height:860} });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(500);

  // troca pro catálogo rápido e volta, várias vezes rápido, pra testar cliques repetidos
  // durante a transição (cenário que quebraria se leaving/entering ficassem "grudados")
  for(let i=0;i<4;i++){
    await page.click('#modeFastBtn');
    await page.waitForTimeout(80);
    await page.click('#modeBookBtn');
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);

  const finalState = await page.evaluate(()=>({
    revistaActive: document.getElementById('revistaView').classList.contains('active'),
    fastActive: document.getElementById('fastView').classList.contains('active'),
    stuckLeaving: document.querySelectorAll('.view.leaving').length,
    stuckEntering: document.querySelectorAll('.view.entering').length,
  }));
  console.log('estado final após cliques rápidos:', finalState);
  if(!finalState.revistaActive || finalState.fastActive){ console.log('FALHOU: estado final errado'); process.exit(1); }
  if(finalState.stuckLeaving > 0 || finalState.stuckEntering > 0){ console.log('FALHOU: classes de transição grudadas'); process.exit(1); }
  console.log('OK: cliques rápidos entre modos não deixam classe de transição grudada');

  // testa uma troca normal com tempo de sobra e confirma que o catálogo rápido fica
  // realmente usável (clicável) depois da transição
  await page.click('#modeFastBtn');
  await page.waitForTimeout(400);
  const cardsVisible = await page.evaluate(()=>document.querySelectorAll('.card').length);
  if(cardsVisible < 100){ console.log('FALHOU: catálogo rápido não renderizou direito após transição'); process.exit(1); }
  await page.click('.card .btn-sm.primary');
  await page.waitForTimeout(200);
  const cartCount = await page.textContent('#cartCount');
  if(cartCount.trim() !== '1'){ console.log('FALHOU: clique no card não funcionou logo após a transição'); process.exit(1); }
  console.log('OK: catálogo rápido totalmente interativo logo após a transição');

  await page.click('#modeBookBtn');
  await page.waitForTimeout(400);
  const bookBox = await page.locator('#book').boundingBox();
  if(bookBox.width < 200){ console.log('FALHOU: livro não voltou ao tamanho certo após transição'); process.exit(1); }
  console.log('OK: livro volta ao tamanho certo após transição de volta pra Revista');

  if(errors.length){ console.log('FALHOU: erros JS:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS');

  await browser.close();
  console.log('\nTODOS OS TESTES DE TRANSIÇÃO DE MODO PASSARAM');
})();
