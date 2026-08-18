/* AVANTE — Webhook do Instagram (fase 2, RASCUNHO — precisa de decisão + credenciais suas)

   Também NÃO está publicado. Diferente do WhatsApp (onde dá pra usar Evolution API sem
   aprovação de ninguém), o Instagram só tem um caminho: a API oficial da Meta (Graph API).

   O que precisa existir ANTES desta function funcionar:
   1. A conta do Instagram da Avante ser uma conta profissional (Business ou Creator).
   2. Essa conta estar conectada a uma Página do Facebook.
   3. Uma conta Meta Business verificada.
   4. Um app criado no Meta for Developers, com o produto "Instagram Messaging" ativado,
      e o webhook (esta function) registrado e verificado lá.
   5. Um token de acesso de página (Page Access Token) de longa duração.

   Isso não é algo que eu resolvo sozinho — precisa que você (ou alguém com acesso à conta
   Business/Instagram da Avante) faça esse cadastro na Meta. Assim que tiver isso, eu conecto
   o restante (a lógica de IA já é a mesma reaproveitada de ai-vendedora.js).
*/

const { getAIReply } = require('./_ai-core');

const PAGE_ACCESS_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN || '';
const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || ''; // usado só na etapa de verificação do webhook na Meta

async function sendInstagramMessage(recipientId, text, imageUrl){
  const body = {
    recipient: { id: recipientId },
    message: imageUrl
      ? { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } }
      : { text }
  };
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

exports.handler = async (event) => {
  // etapa de verificação do webhook (a Meta chama isso uma vez, via GET, ao cadastrar a URL)
  if(event.httpMethod === 'GET'){
    const params = event.queryStringParameters || {};
    if(params['hub.verify_token'] === VERIFY_TOKEN){
      return { statusCode: 200, body: params['hub.challenge'] };
    }
    return { statusCode: 403, body: 'token de verificação inválido' };
  }

  if(event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const payload = JSON.parse(event.body || '{}');
    const entry = payload.entry?.[0]?.messaging?.[0];
    const from = entry?.sender?.id;
    const text = entry?.message?.text;
    if(!from || !text) return { statusCode: 200, body: 'ignored' };

    // TODO fase 2: carregar histórico/carrinho da conversa (Supabase) antes de chamar a IA
    const aiResult = await getAIReply({ message: text, cart: [] });

    await sendInstagramMessage(from, aiResult.reply);
    for(const p of aiResult.productsToShow || []){
      await sendInstagramMessage(from, `${p.name} — ${p.caixa || ''}`, p.imageUrl);
    }
    // TODO fase 2: salvar o novo estado da conversa/carrinho de volta no Supabase

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('[webhook-instagram] erro:', err);
    return { statusCode: 200, body: 'error handled' };
  }
};
