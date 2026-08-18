/* AVANTE — IA Vendedora real (fase 2)
   Netlify Function (funciona igual como Supabase Edge Function com pequenos ajustes de import).
   Isso é o "cérebro" real da IA — usa a Claude de verdade pra conversar, entender o pedido
   e decidir o que adicionar no carrinho.

   COMO ATIVAR:
   1. `npm install @anthropic-ai/sdk` no projeto do backend.
   2. Colar a ANTHROPIC_API_KEY nas variáveis de ambiente do Netlify (ou Supabase, se virar Edge Function).
   3. Publicar esta function — o Netlify te dá uma URL tipo
      https://SEU-SITE.netlify.app/.netlify/functions/ai-vendedora
   4. Colar essa URL na constante AI_BACKEND_URL, no topo de catalogo/js/app.js.
   A partir daí o mesmo chat que já funciona no catálogo passa a falar com a Claude de verdade,
   sem precisar mudar mais nada no frontend — o formato de resposta já é compatível.
*/

const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SYSTEM_PROMPT = require('./_system-prompt'); // mesma personalidade usada no WhatsApp e Instagram

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST'){
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { message, cart, catalogContext } = JSON.parse(event.body || '{}');
    // catalogContext = lista compacta (nome, marca, código, caixa) dos produtos mais prováveis,
    // já pré-filtrada no frontend por palavra-chave — evita mandar as 145 SKUs inteiras
    // pra Claude a cada mensagem (mais rápido e mais barato).
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Catálogo disponível (filtrado):\n${JSON.stringify(catalogContext || [])}\n\n` +
                 `Carrinho atual do cliente: ${JSON.stringify(cart || [])}\n\n` +
                 `Cliente disse: "${message}"`
      }]
    });
    const raw = resp.content[0].text;
    // valida que veio um JSON de verdade antes de devolver pro frontend
    JSON.parse(raw);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: raw };
  } catch (err) {
    console.error('[ai-vendedora] erro:', err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: 'deu um probleminha aqui, pode repetir', product_codes: [], add_to_cart: [] })
    };
  }
};
