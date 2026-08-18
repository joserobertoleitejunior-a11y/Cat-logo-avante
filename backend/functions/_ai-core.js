/* AVANTE — núcleo compartilhado da IA vendedora (fase 2)
   Usado pelas três frentes de venda: o chat do catálogo, o WhatsApp e o Instagram —
   assim a Ana responde do mesmo jeito e conhece o mesmo catálogo em qualquer canal,
   e uma venda começada no WhatsApp pode continuar no site sem perder contexto
   (uma vez que o carrinho estiver gravado no Supabase, fase 2).

   Este arquivo concentra a chamada à Claude; os três webhooks (ai-vendedora.js,
   webhook-whatsapp.js, webhook-instagram.js) só cuidam de "traduzir" a entrada/saída
   pro formato de cada canal.
*/

const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = require('./_system-prompt'); // mesmo texto usado em ai-vendedora.js

async function getAIReply({ message, cart, catalogContext }){
  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Catálogo disponível (filtrado):\n${JSON.stringify(catalogContext || [])}\n\n` +
               `Carrinho atual: ${JSON.stringify(cart || [])}\n\nCliente disse: "${message}"`
    }]
  });
  const parsed = JSON.parse(resp.content[0].text);
  return {
    reply: parsed.reply,
    productsToShow: parsed.product_codes || [],
    addToCart: parsed.add_to_cart || []
  };
}

module.exports = { getAIReply };
