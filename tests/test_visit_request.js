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

  // tenta enviar sem escolher dia — deve bloquear e sinalizar o grupo de chips
  await page.fill('#visitNome', 'Marcos Teste');
  await page.fill('#visitEmpresa', 'Mercadinho Teste');
  await page.fill('#visitCidade', 'Campo Limpo Paulista');
  await page.fill('#visitTelefone', '11999998888');
  await page.click('#visitSubmitBtn');
  await page.waitForTimeout(200);
  const blockedNoDay = await page.evaluate(()=>{
    const saved = JSON.parse(localStorage.getItem('avante_visit_requests')||'[]');
    return saved.length === 0 && document.getElementById('visitDiaChips').classList.contains('needs-choice');
  });
  if(!blockedNoDay){ console.log('FALHOU: deveria bloquear o envio sem escolher o dia'); process.exit(1); }
  console.log('OK: bloqueia envio sem escolher o dia');

  // telefone formata sozinho enquanto digita
  const telFormatado = await page.inputValue('#visitTelefone');
  if(telFormatado !== '(11) 99999-8888'){ console.log('FALHOU: telefone não formatou como esperado:', telFormatado); process.exit(1); }
  console.log('OK: telefone formata automaticamente:', telFormatado);

  await page.click('[data-day="Quinta"]');
  await page.click('[data-periodo="Tarde"]');
  await page.click('#visitSubmitBtn');
  await page.waitForTimeout(300);

  const successVisible = await page.evaluate(()=>document.getElementById('visitSuccess').classList.contains('show'));
  if(!successVisible){ console.log('FALHOU: confirmação de pedido de visita não apareceu'); process.exit(1); }
  console.log('OK: confirmação aparece depois de enviar');

  const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('avante_visit_requests')||'[]'));
  console.log('pedidos salvos:', saved);
  if(saved.length !== 1 || saved[0].nome !== 'Marcos Teste' || saved[0].dia !== 'Quinta' || saved[0].periodo !== 'Tarde'){
    console.log('FALHOU: pedido não foi salvo corretamente no localStorage');
    process.exit(1);
  }
  console.log('OK: pedido de visita (com dia e período) salvo no localStorage pro painel admin ler');

  if(errors.length){ console.log('FALHOU: erros JS:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS');

  await browser.close();
  console.log('\nTODOS OS TESTES DE PEDIDO DE VISITA PASSARAM');
})();
