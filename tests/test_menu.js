const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const errors = [];
  const page = await browser.newPage({ viewport:{width:1000,height:800} });
  await page.addInitScript(() => { localStorage.setItem('avante_splash_seen','1'); localStorage.setItem('avante_demo_pin_ok','1'); });
  page.on('pageerror', e=>errors.push(e.message));

  await page.goto('http://localhost:8099/catalogo/index.html', {waitUntil:'networkidle'});
  await page.waitForTimeout(300);

  const closedInitially = await page.evaluate(()=>!document.getElementById('navDrawer').classList.contains('open'));
  if(!closedInitially){ console.log('FALHOU: menu deveria começar fechado'); process.exit(1); }
  console.log('OK: menu começa fechado');

  await page.click('#menuBtn');
  await page.waitForTimeout(350);
  const openedAfterClick = await page.evaluate(()=>document.getElementById('navDrawer').classList.contains('open'));
  if(!openedAfterClick){ console.log('FALHOU: menu deveria abrir ao clicar no hamburguer'); process.exit(1); }
  console.log('OK: menu abre ao clicar no hamburguer');

  const linksText = await page.evaluate(()=>document.getElementById('navDrawer').textContent);
  if(!linksText.includes('WhatsApp') || !linksText.includes('Instagram') || !linksText.includes('94546-0722')){
    console.log('FALHOU: menu não tem os links esperados. Conteúdo:', linksText);
    process.exit(1);
  }
  console.log('OK: menu tem WhatsApp, Instagram e telefone');

  const instaHref = await page.evaluate(()=>{
    const links = [...document.querySelectorAll('#navDrawer a')];
    const a = links.find(l => l.textContent.includes('Instagram'));
    return a ? a.href : null;
  });
  if(instaHref !== 'https://www.instagram.com/avantedistribuicao/'){ console.log('FALHOU: link do Instagram errado:', instaHref); process.exit(1); }
  console.log('OK: link do Instagram aponta pro perfil real (@avantedistribuicao)');

  // fecha clicando no scrim
  await page.click('#navScrim', { position:{x:600,y:400} });
  await page.waitForTimeout(350);
  const closedAfterScrim = await page.evaluate(()=>!document.getElementById('navDrawer').classList.contains('open'));
  if(!closedAfterScrim){ console.log('FALHOU: menu deveria fechar ao clicar fora'); process.exit(1); }
  console.log('OK: menu fecha ao clicar fora (scrim)');

  // abre de novo e fecha com Escape
  await page.click('#menuBtn');
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  const closedAfterEsc = await page.evaluate(()=>!document.getElementById('navDrawer').classList.contains('open'));
  if(!closedAfterEsc){ console.log('FALHOU: menu deveria fechar com Esc'); process.exit(1); }
  console.log('OK: menu fecha com Esc');

  // não deve ter nenhuma logomarca desenhada (svg) no header, só texto
  const headerSvgCount = await page.evaluate(()=>document.querySelector('header .brand').querySelectorAll('svg').length);
  if(headerSvgCount !== 1){ console.log('FALHOU: esperado só o ícone do hamburguer (1 svg) no header, veio', headerSvgCount); process.exit(1); }
  console.log('OK: header não tem logomarca desenhada, só o ícone do menu + texto');

  const logoInfo = await page.evaluate(()=>{
    const img = document.querySelector('.brand-logo');
    return img ? { src: img.getAttribute('src'), naturalWidth: img.naturalWidth, alt: img.alt } : null;
  });
  if(!logoInfo || !logoInfo.src.includes('logo-avante.png') || logoInfo.naturalWidth < 50){
    console.log('FALHOU: logo real da AVANTE não carregou no cabeçalho:', logoInfo);
    process.exit(1);
  }
  console.log('OK: cabeçalho usa a logo real extraída do catálogo (não um ícone inventado):', logoInfo.src);

  if(errors.length){ console.log('FALHOU: erros JS:', errors); process.exit(1); }
  console.log('OK: nenhum erro JS em todo o fluxo do menu');

  await browser.close();
  console.log('\nTODOS OS TESTES DO MENU PASSARAM');
})();
