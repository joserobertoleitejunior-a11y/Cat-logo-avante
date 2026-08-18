const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport:{width:1000,height:800} });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.evaluate(()=>{}).catch(()=>{});
  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  await page.evaluate(()=>localStorage.removeItem('avante_visit_requests'));

  await page.click('#visitBtn');
  await page.waitForTimeout(300);
  const drawerOpen = await page.evaluate(()=>document.getElementById('visitDrawer').classList.contains('open'));
  if(!drawerOpen){ console.log('FALHOU: drawer de visita não abriu'); process.exit(1); }
  console.log('OK: drawer de pedir visita abre');

  await page.fill('#visitNome', 'Marcos Teste');
  await page.fill('#visitEmpresa', 'Mercadinho Teste');
  await page.fill('#visitCidade', 'Campo Limpo Paulista');
  await page.fill('#visitTelefone', '11999998888');
  await page.selectOption('#visitDia', 'Quinta');
  await page.click('#visitSubmitBtn');
  await page.waitForTimeout(300);

  const noteVisible = await page.evaluate(()=>document.getElementById('visitSentNote').style.display === 'block');
  if(!noteVisible){ console.log('FALHOU: confirmação de pedido de visita não apareceu'); process.exit(1); }
  console.log('OK: confirmação aparece depois de enviar');

  const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('avante_visit_requests')||'[]'));
  console.log('pedidos salvos:', saved);
  if(saved.length !== 1 || saved[0].nome !== 'Marcos Teste' || saved[0].dia !== 'Quinta'){
    console.log('FALHOU: pedido não foi salvo corretamente no localStorage');
    process.exit(1);
  }
  console.log('OK: pedido de visita salvo no localStorage pro painel admin ler');

  if(errors.length){ console.log('FALHOU: erros JS:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS');

  await browser.close();
  console.log('\nTODOS OS TESTES DE PEDIDO DE VISITA PASSARAM');
})();
