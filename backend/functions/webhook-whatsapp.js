/* AVANTE — Webhook do WhatsApp (fase 2, RASCUNHO — precisa de decisão + credenciais suas)

   Isso NÃO está publicado nem ativo. É o esqueleto de como a IA vendedora conversaria
   dentro do WhatsApp de verdade — falta escolher o caminho e plugar as credenciais.

   Existem dois jeitos de conectar, com trade-offs bem diferentes:

   OPÇÃO A — Evolution API (self-hosted, não precisa de aprovação da Meta)
     - Você sobe uma instância da Evolution API (ela conecta via WhatsApp Web multi-device).
     - Mais rápido de colocar no ar, mas depende de um número real conectado via QR code,
       igual o WhatsApp Web — se a instância cair ou o número desconectar, o bot para.
     - Bom pra validar rápido / MVP.

   OPÇÃO B — WhatsApp Business Cloud API (oficial, da própria Meta)
     - Mais robusto e escalável, mas exige: conta Meta Business verificada, número de telefone
       registrado oficialmente pro Business API, e passar pela revisão da Meta.
     - Demora mais pra sair do papel, mas é o caminho "definitivo".

   O código abaixo já está escrito pro formato de webhook da Evolution API (Opção A), por ser
   o caminho mais rápido — mas a lógica de "receber mensagem → perguntar pra IA → responder
   com texto + imagem do produto → adicionar no carrinho da sessão" é a mesma nos dois casos,
   só muda a função que efetivamente envia a mensagem de volta.

   POR QUE PRECISA DE SUPABASE PRA ISSO FUNCIONAR DE VERDADE:
   Cada invocação desta function é isolada (serverless) — ela não "lembra" da conversa
   anterior sozinha. Pra manter o contexto de cada cliente (o que ele já pediu, em que
   ponto da conversa está), preciso gravar e ler o histórico de uma tabela `conversas_whatsapp`
   no Supabase a cada mensagem. Isso está bloqueado até você me indicar a organização/conta
   do Supabase pra eu criar o projeto (já expliquei isso na entrega anterior).
*/

const { getAIReply } = require('./_ai-core'); // reaproveitaria a mesma lógica de ai-vendedora.js
// const { getConversationState, saveConversationState } = require('./_supabase'); // fase 2, após liberar o Supabase

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || ''; // ex: https://sua-instancia.evolution-api.com
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'avante';

async function sendWhatsAppMessage(to, text, imageUrl){
  const endpoint = imageUrl
    ? `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`
    : `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
  const body = imageUrl
    ? { number: to, mediatype: 'image', media: imageUrl, caption: text }
    : { number: to, text };
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
    body: JSON.stringify(body)
  });
}

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const payload = JSON.parse(event.body || '{}');
    // formato de payload varia conforme a versão da Evolution API — ajustar depois de ver
    // um payload real de teste.
    const from = payload?.data?.key?.remoteJid;
    const text = payload?.data?.message?.conversation || payload?.data?.message?.extendedTextMessage?.text;
    if(!from || !text) return { statusCode: 200, body: 'ignored' };

    // TODO fase 2: carregar o histórico/carrinho dessa conversa no Supabase antes de chamar a IA
    const aiResult = await getAIReply({ message: text, cart: [] /* viria do Supabase */ });

    await sendWhatsAppMessage(from, aiResult.reply);
    for(const p of aiResult.productsToShow || []){
      await sendWhatsAppMessage(from, `${p.name} — ${p.caixa || ''}`, p.imageUrl);
    }
    // TODO fase 2: salvar o novo estado da conversa/carrinho de volta no Supabase

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('[webhook-whatsapp] erro:', err);
    return { statusCode: 200, body: 'error handled' };
  }
};
