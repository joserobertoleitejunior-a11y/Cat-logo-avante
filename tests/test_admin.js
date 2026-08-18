const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  // mesmo contexto (não browser.newPage() direto) pra simular duas abas do MESMO navegador
  // real, compartilhando localStorage — é assim que o vendedor usaria: catálogo numa aba,
  // painel admin em outra, ambos na mesma origem.
  const context = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('avante_demo_pin_ok','1'));
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });

  await page.goto('http://localhost:8099/crm/crm_dashboard.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(400);

  // ---------- LOGIN ----------
  let loginVisible = await page.evaluate(()=>document.getElementById('loginScreen').style.display !== 'none');
  if(!loginVisible){ console.log('FALHOU: tela de login deveria aparecer primeiro'); process.exit(1); }
  console.log('OK: tela de login aparece antes de tudo');

  // senha errada
  await page.selectOption('#loginVendor', 'marcos');
  await page.fill('#loginSenha', 'senhaerrada');
  await page.click('#loginBtn');
  await page.waitForTimeout(200);
  const errShown = await page.evaluate(()=>document.getElementById('loginErr').style.display === 'block');
  if(!errShown){ console.log('FALHOU: senha errada deveria mostrar erro'); process.exit(1); }
  console.log('OK: senha errada mostra erro');

  // senha certa
  await page.fill('#loginSenha', '1234');
  await page.click('#loginBtn');
  await page.waitForTimeout(400);
  const appVisible = await page.evaluate(()=>document.getElementById('adminApp').style.display !== 'none');
  if(!appVisible){ console.log('FALHOU: login correto deveria mostrar o painel'); process.exit(1); }
  const whoName = await page.textContent('#whoName');
  if(whoName.trim() !== 'Marcos'){ console.log('FALHOU: nome do vendedor logado errado:', whoName); process.exit(1); }
  console.log('OK: login correto mostra o painel com o nome certo:', whoName.trim());

  // ---------- DASHBOARD ----------
  const kpiCount = await page.evaluate(()=>document.querySelectorAll('.kpi-card').length);
  if(kpiCount !== 4){ console.log('FALHOU: esperado 4 KPIs, veio', kpiCount); process.exit(1); }
  console.log('OK: dashboard mostra 4 KPIs');

  // ---------- NAVEGAÇÃO ENTRE ABAS ----------
  const tabs = ['pipeline','contatos','agenda','logistica','coach','config','canais','dashboard'];
  for(const tab of tabs){
    await page.click(`.tab-btn[data-view="${tab}"]`);
    await page.waitForTimeout(150);
    const active = await page.evaluate((t)=>document.getElementById('view-'+t).classList.contains('active'), tab);
    if(!active){ console.log(`FALHOU: aba ${tab} não ativou`); process.exit(1); }
  }
  console.log('OK: todas as abas navegam corretamente');

  // ---------- TEMA CLARO/ESCURO ----------
  await page.click('#themeToggleBtn');
  await page.waitForTimeout(200);
  let theme = await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  if(theme !== 'light'){ console.log('FALHOU: tema deveria virar light'); process.exit(1); }
  await page.reload({waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  theme = await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  if(theme !== 'light'){ console.log('FALHOU: tema light não persistiu após reload'); process.exit(1); }
  const stillLoggedIn = await page.evaluate(()=>document.getElementById('adminApp').style.display !== 'none');
  if(!stillLoggedIn){ console.log('FALHOU: sessão deveria persistir após reload'); process.exit(1); }
  console.log('OK: tema light persiste e sessão continua logada após reload');
  await page.click('#themeToggleBtn'); // volta pro dark
  await page.waitForTimeout(200);

  // ---------- NOVO CLIENTE ----------
  await page.click('.tab-btn[data-view="contatos"]');
  await page.waitForTimeout(200);
  const contactsBefore = await page.evaluate(()=>document.querySelectorAll('#contactsBody tr').length);
  await page.click('#newClientBtn');
  await page.waitForTimeout(200);
  await page.fill('#ncNome', 'Teste Cliente');
  await page.fill('#ncEmpresa', 'Empório Teste');
  await page.fill('#ncCidade', 'Jundiaí');
  await page.fill('#ncTelefone', '11912345678');
  await page.click('#ncSaveBtn');
  await page.waitForTimeout(300);
  const contactsAfter = await page.evaluate(()=>document.querySelectorAll('#contactsBody tr').length);
  if(contactsAfter !== contactsBefore + 1){ console.log('FALHOU: novo cliente não foi adicionado à tabela'); process.exit(1); }
  console.log('OK: novo cliente cadastrado aparece na tabela');

  // ---------- CONFIG ----------
  await page.click('.tab-btn[data-view="config"]');
  await page.waitForTimeout(200);
  await page.fill('#cfgWhats', '5511900001111');
  await page.click('#cfgSaveBtn');
  await page.waitForTimeout(200);
  const cfgSaved = await page.evaluate(()=>JSON.parse(localStorage.getItem('avante_site_cfg')||'{}'));
  if(cfgSaved.whatsapp !== '5511900001111'){ console.log('FALHOU: config não salvou o whatsapp corretamente:', cfgSaved); process.exit(1); }
  console.log('OK: config do site salva no localStorage');

  // ---------- BRIDGE: catálogo -> admin (pedido de visita) ----------
  const page2 = await context.newPage();
  await page2.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  await page2.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page2.waitForTimeout(400);
  await page2.click('#visitBtn');
  await page2.waitForTimeout(200);
  await page2.fill('#visitNome', 'Bridge Teste');
  await page2.fill('#visitEmpresa', 'Bridge Empresa');
  await page2.fill('#visitCidade', 'Bridge Cidade');
  await page2.fill('#visitTelefone', '11955556666');
  await page2.selectOption('#visitDia', 'Segunda');
  await page2.click('#visitSubmitBtn');
  await page2.waitForTimeout(300);
  // confirma que o número de whatsapp configurado no admin foi refletido no catálogo
  const usedNumber = await page2.evaluate(()=>{
    const cfg = JSON.parse(localStorage.getItem('avante_site_cfg')||'{}');
    return cfg.whatsapp;
  });
  if(usedNumber !== '5511900001111'){ console.log('FALHOU: catálogo não está lendo o número configurado pelo admin:', usedNumber); process.exit(1); }
  console.log('OK: catálogo lê o número de WhatsApp configurado no admin (mesma origem)');
  await page2.close();

  await page.bringToFront();
  await page.click('.tab-btn[data-view="agenda"]');
  await page.waitForTimeout(200);
  const pendingText = await page.evaluate(()=>document.getElementById('pendingVisitsList').textContent);
  if(!pendingText.includes('Bridge Teste')){ console.log('FALHOU: pedido de visita do catálogo não apareceu no admin. Conteúdo:', pendingText); process.exit(1); }
  console.log('OK: pedido de visita feito no catálogo aparece no admin (agenda)');

  // confirmar visita -> deve sumir da lista de pendentes e ir pra agenda semanal
  await page.click('[data-action="confirmar-visita"]');
  await page.waitForTimeout(300);
  const pendingAfter = await page.evaluate(()=>document.getElementById('pendingVisitsList').textContent);
  if(pendingAfter.includes('Bridge Teste')){ console.log('FALHOU: visita confirmada ainda aparece como pendente'); process.exit(1); }
  console.log('OK: confirmar visita remove da lista de pendentes');

  // ---------- IA COACH ----------
  await page.click('.tab-btn[data-view="coach"]');
  await page.waitForTimeout(200);
  const coachMsgs1 = await page.evaluate(()=>document.querySelectorAll('.coach-msg').length);
  if(coachMsgs1 < 1){ console.log('FALHOU: coach deveria mandar mensagem de boas-vindas'); process.exit(1); }
  await page.fill('#coachInput', 'cliente disse que ta caro');
  await page.click('#coachForm button[type=submit]');
  await page.waitForTimeout(600);
  const coachMsgs2 = await page.evaluate(()=>document.querySelectorAll('.coach-msg').length);
  if(coachMsgs2 < coachMsgs1 + 2){ console.log('FALHOU: coach não respondeu à pergunta'); process.exit(1); }
  console.log('OK: IA Coach responde perguntas');

  // ---------- LOGÍSTICA ----------
  await page.click('.tab-btn[data-view="logistica"]');
  await page.waitForTimeout(200);
  const mapLinks = await page.evaluate(()=>document.querySelectorAll('.btn-map').length);
  if(mapLinks === 0){ console.log('FALHOU: nenhum link de mapa na logística'); process.exit(1); }
  console.log('OK: logística mostra links de mapa:', mapLinks);

  // ---------- LOGOUT ----------
  await page.click('#logoutBtn');
  await page.waitForTimeout(200);
  const loggedOut = await page.evaluate(()=>document.getElementById('loginScreen').style.display !== 'none');
  if(!loggedOut){ console.log('FALHOU: logout deveria voltar pra tela de login'); process.exit(1); }
  console.log('OK: logout volta pra tela de login');

  if(errors.length){ console.log('FALHOU: erros JS/console:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS em toda a sessão');

  await browser.close();
  console.log('\nTODOS OS TESTES DO PAINEL ADMIN PASSARAM');
})();
