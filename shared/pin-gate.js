/*
  PIN GATE — padrão da agência pra deploys de DEMONSTRAÇÃO (Vercel, Netlify etc.)
  ==============================================================================
  Isso NÃO é autenticação de verdade. É só uma cortina simples pra impedir que o
  link de demo apareça pra qualquer um que ache a URL antes do projeto ter login
  de verdade (Supabase, etc.). O PIN fica em texto puro aqui embaixo de propósito
  — colocar um hash não protege nada a mais num app 100% client-side, só atrapalha
  quem for editar. Quando o projeto tiver backend/autenticação real, REMOVA este
  arquivo e as tags <script> que o carregam.

  COMO USAR EM UM NOVO PROJETO:
  1. Copie este arquivo pra pasta shared/ do projeto.
  2. Coloque <script src="../shared/pin-gate.js"></script> como o PRIMEIRO elemento
     dentro de <body>, antes de qualquer outro conteúdo (inclusive splash/loading).
  3. Troque o PIN e o nome do projeto nas constantes abaixo.
  4. Pra mandar um link que já libera sozinho (sem o cliente digitar o PIN),
     use ?pin=SEUPIN no final da URL.

  ESTADO: cada domínio (origem) tem sua própria liberação, salva no localStorage.
  Se catálogo e admin forem publicados na MESMA origem (ex.: mesmoprojeto.vercel.app/
  catalogo e /crm), destravar um destrava o outro automaticamente.
*/
(function () {
  'use strict';

  // ======= CONFIG — troque aqui =======
  var PIN = '4546';
  var PROJETO = 'AVANTE Distribuição';
  var STORAGE_KEY = 'avante_demo_pin_ok';
  // =====================================

  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('pin') === PIN) {
      localStorage.setItem(STORAGE_KEY, '1');
    }
  } catch (e) {}

  var jaLiberado = false;
  try { jaLiberado = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) {}
  if (jaLiberado) return; // nada a fazer, segue o carregamento normal

  // trava visualmente tudo que já existe/vier a existir no body, exceto o overlay
  var style = document.createElement('style');
  style.textContent =
    'html.pin-gate-lock body > *:not(#pinGateOverlay){display:none!important}' +
    'html.pin-gate-lock{background:#0B2A52}' +
    '#pinGateOverlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;' +
    'justify-content:center;background:linear-gradient(160deg,#0B2A52 0%,#123863 55%,#0B2A52 100%);' +
    'font-family:Georgia,\'Times New Roman\',serif;padding:24px;box-sizing:border-box;}' +
    '#pinGateOverlay .pg-card{width:100%;max-width:340px;text-align:center;color:#F4E9D8;}' +
    '#pinGateOverlay .pg-badge{width:56px;height:56px;border-radius:14px;margin:0 auto 18px;' +
    'background:linear-gradient(145deg,#E8AE30,#C9902A);display:flex;align-items:center;justify-content:center;' +
    'font-weight:bold;font-size:20px;color:#0B2A52;box-shadow:0 8px 24px rgba(0,0,0,.35);}' +
    '#pinGateOverlay h1{font-size:19px;margin:0 0 6px;font-weight:700;}' +
    '#pinGateOverlay p{font-family:Arial,Helvetica,sans-serif;font-size:13px;opacity:.75;margin:0 0 22px;line-height:1.5;}' +
    '#pinGateOverlay input{width:100%;box-sizing:border-box;text-align:center;letter-spacing:8px;font-size:22px;' +
    'padding:12px 10px;border-radius:10px;border:1px solid rgba(244,233,216,.3);background:rgba(255,255,255,.06);' +
    'color:#F4E9D8;font-family:Arial,Helvetica,sans-serif;margin-bottom:12px;}' +
    '#pinGateOverlay input:focus{outline:none;border-color:#E8AE30;}' +
    '#pinGateOverlay button{width:100%;padding:12px;border-radius:10px;border:none;background:#E8AE30;' +
    'color:#0B2A52;font-weight:700;font-size:14px;font-family:Arial,Helvetica,sans-serif;cursor:pointer;' +
    'transition:transform .15s ease,background .15s ease;}' +
    '#pinGateOverlay button:hover{background:#F4C24E;}' +
    '#pinGateOverlay button:active{transform:scale(.97);}' +
    '#pinGateOverlay .pg-err{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#F2A0A0;' +
    'height:16px;margin-top:10px;opacity:0;transition:opacity .15s ease;}' +
    '#pinGateOverlay .pg-err.show{opacity:1;}' +
    '#pinGateOverlay .pg-shake{animation:pgShake .32s;}' +
    '@keyframes pgShake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}' +
    '30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}';
  document.head.appendChild(style);
  document.documentElement.classList.add('pin-gate-lock');

  var overlay = document.createElement('div');
  overlay.id = 'pinGateOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Acesso restrito — ' + PROJETO);
  overlay.innerHTML =
    '<div class="pg-card">' +
      '<div class="pg-badge">AD</div>' +
      '<h1>' + PROJETO + '</h1>' +
      '<p>Prévia de demonstração — peça o código de acesso pra equipe.</p>' +
      '<form id="pgForm" autocomplete="off">' +
        '<input id="pgInput" type="tel" inputmode="numeric" maxlength="8" placeholder="••••" aria-label="Código de acesso" autofocus>' +
        '<button type="submit">Entrar</button>' +
        '<div class="pg-err" id="pgErr">Código incorreto, tenta de novo.</div>' +
      '</form>' +
    '</div>';
  document.body.appendChild(overlay);

  var input = overlay.querySelector('#pgInput');
  var form = overlay.querySelector('#pgForm');
  var err = overlay.querySelector('#pgErr');
  var card = overlay.querySelector('.pg-card');

  setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (input.value.trim() === PIN) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
      document.documentElement.classList.remove('pin-gate-lock');
      overlay.remove();
    } else {
      err.classList.add('show');
      card.classList.remove('pg-shake');
      void card.offsetWidth; // reinicia a animação
      card.classList.add('pg-shake');
      input.value = '';
      input.focus();
    }
  });
})();
