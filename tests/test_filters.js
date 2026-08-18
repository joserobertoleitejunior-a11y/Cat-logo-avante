const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport:{width:1200,height:860} });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  await page.click('#modeFastBtn');
  await page.waitForTimeout(400);

  const totalCards = await page.evaluate(()=>document.querySelectorAll('.card').length);
  console.log('cards totais:', totalCards);

  // filtro de marca
  const brandOptions = await page.evaluate(()=>Array.from(document.querySelectorAll('#brandFilter option')).map(o=>o.value).filter(Boolean));
  console.log('marcas disponíveis:', brandOptions.length);
  if(brandOptions.length < 2){ console.log('FALHOU: poucas marcas no filtro'); process.exit(1); }
  await page.selectOption('#brandFilter', brandOptions[0]);
  await page.waitForTimeout(300);
  const filteredByBrand = await page.evaluate(()=>document.querySelectorAll('.card').length);
  console.log(`cards com marca "${brandOptions[0]}":`, filteredByBrand);
  if(filteredByBrand === 0 || filteredByBrand >= totalCards){ console.log('FALHOU: filtro de marca não reduziu corretamente'); process.exit(1); }
  console.log('OK: filtro de marca funciona');
  await page.selectOption('#brandFilter', '');
  await page.waitForTimeout(300);

  // sort
  await page.selectOption('#sortFilter', 'name');
  await page.waitForTimeout(300);
  const namesSorted = await page.evaluate(()=>Array.from(document.querySelectorAll('.cname')).slice(0,5).map(e=>e.textContent));
  const isSorted = JSON.stringify(namesSorted) === JSON.stringify([...namesSorted].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  console.log('primeiros 5 nomes ordenados A-Z:', namesSorted);
  if(!isSorted){ console.log('FALHOU: ordenação por nome não está correta'); process.exit(1); }
  console.log('OK: ordenação por nome A-Z funciona');
  await page.selectOption('#sortFilter', 'page');
  await page.waitForTimeout(300);

  // só selecionados
  await page.click('.card .btn-sm.primary'); // seleciona o primeiro
  await page.waitForTimeout(300);
  await page.click('#onlySelected');
  await page.waitForTimeout(300);
  const onlySelCount = await page.evaluate(()=>document.querySelectorAll('.card').length);
  console.log('cards com "só selecionados" ligado:', onlySelCount);
  if(onlySelCount !== 1){ console.log('FALHOU: "só selecionados" deveria mostrar exatamente 1 card, mostrou', onlySelCount); process.exit(1); }
  console.log('OK: "só selecionados" filtra corretamente');

  // desmarcar o item deve sumir o card na hora (sem precisar re-clicar no checkbox)
  await page.click('.card .btn-sm.primary');
  await page.waitForTimeout(300);
  const afterDeselect = await page.evaluate(()=>document.querySelectorAll('.card').length);
  console.log('cards depois de desmarcar (com filtro ainda ligado):', afterDeselect);
  if(afterDeselect !== 0){ console.log('FALHOU: card desmarcado deveria sumir da grade na hora'); process.exit(1); }
  console.log('OK: desmarcar item some da grade instantaneamente com o filtro ligado');

  if(errors.length){ console.log('FALHOU: erros JS:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS');

  await browser.close();
  console.log('\nTODOS OS TESTES DE FILTROS PASSARAM');
})();
