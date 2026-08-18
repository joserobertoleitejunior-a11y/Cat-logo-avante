# IA Vendedora — status e próximos passos

## O que já está no ar (dentro do catálogo, sem precisar de nada extra)

O chat "Fale com a gente" já funciona hoje, direto no navegador, sem chave de API e sem
depender de nenhum servidor — é um motor de regras local (`catalogo/js/ai-vendedora.js`) que:

- entende cumprimento, pedido direto ("quero 2 caixas de X"), pergunta sobre produto, e
  intenção de fechar orçamento
- busca no catálogo (145 SKUs) por nome, marca, seção ou código
- responde curto, sem ponto final à toa, como uma pessoa digitando mesmo
- mostra o produto com foto dentro da própria conversa
- adiciona automaticamente no carrinho quando o cliente confirma
- reaproveita o mesmo carrinho/orçamento do resto do site — o que a IA adiciona aparece
  junto com o que foi selecionado manualmente

Isso já é uma "vendedora" funcional pro visitante do catálogo. A limitação de um motor de
regras (em vez da Claude de verdade) é que ele reconhece um conjunto de padrões de frase,
não qualquer jeito de escrever — funciona bem pra pedidos diretos, mas não segura uma
conversa totalmente livre.

## Fase 2 — trocar o motor local pela Claude de verdade

Já deixei pronto (em `backend/functions/`) o esqueleto de uma function que troca o motor de
regras por uma chamada real à Claude, com a personalidade da "Ana" já escrita
(`_system-prompt.js`). Pra isso sair do papel falta:

1. Você (ou eu, com a chave que você fornecer) publicar essa function num serviço de hospedagem
   (Netlify Functions é o mais direto — mesma stack que já uso nos outros projetos da agência).
2. Colar uma `ANTHROPIC_API_KEY` sua nas variáveis de ambiente desse serviço.
3. Colar a URL publicada em `AI_BACKEND_URL` (topo de `catalogo/js/app.js`) — o chat que já
   está no site passa a usar a Claude de verdade automaticamente, sem eu precisar mexer em
   mais nada na tela.

## Fase 2 — WhatsApp

**Decisão já tomada (você perguntou, eu pesquisei):** vamos de **WhatsApp Business Cloud API**
(oficial da Meta), não Evolution API.

Você perguntou se a Meta não está banindo o Evolution — pesquisei e sim, o risco é real e
alto: como o Evolution API (e ferramentas parecidas baseadas em Baileys/WhatsApp Web) não usa
a API oficial, a Meta consegue detectar esse padrão de uso e o histórico recente mostra
banimentos frequentes, muitas vezes permanentes, do número conectado. Pra um número que é a
identidade oficial da Avante no WhatsApp, esse risco não vale a pena.

- **WhatsApp Business Cloud API** (oficial da Meta) — **caminho escolhido**: risco de
  banimento muito baixo (é o canal que a própria Meta espera que empresas usem), mais robusto
  e escalável, mas exige conta Meta Business verificada e o número passar por aprovação
  oficial — leva mais tempo pra sair do papel.
- ~~Evolution API~~ (auto-hospedada, conecta como o WhatsApp Web) — descartada por esse
  motivo, mesmo sendo mais rápida de colocar no ar.

O rascunho em `backend/functions/webhook-whatsapp.js` ainda está no formato genérico (mais
próximo do Evolution, por ter sido o primeiro caminho testado) — precisa de um ajuste pra
bater com o formato de payload da Cloud API oficial antes de ir pro ar. É rápido de fazer,
só depende da conta Meta Business estar pronta (ver resumo no fim deste arquivo). A lógica de
"recebe mensagem → pergunta pra IA → responde com texto e foto do produto → adiciona no
carrinho" continua a mesma.

## Fase 2 — Instagram

Só existe um caminho aqui: a Graph API oficial da Meta. Pra esta function
(`backend/functions/webhook-instagram.js`) funcionar, precisa antes:

1. A conta do Instagram da Avante ser conta profissional (Business ou Creator).
2. Estar conectada a uma Página do Facebook.
3. Ter uma conta Meta Business verificada.
4. Um app no Meta for Developers com "Instagram Messaging" ativado e o webhook cadastrado.
5. Um token de acesso de página de longa duração.

Isso é um cadastro que só quem tem acesso à conta Business/Instagram da Avante consegue
fazer — não é algo que eu resolvo do meu lado.

## Por que o carrinho/conversa precisa do Supabase pra funcionar de verdade no WhatsApp/Instagram

Cada mensagem que chega no webhook é uma execução isolada (serverless) — ela não "lembra"
sozinha da conversa anterior. Pra manter o histórico e o carrinho de cada cliente entre uma
mensagem e outra, preciso gravar e ler isso de uma tabela no Supabase a cada mensagem. Isso
está esperando a definição da organização/conta do Supabase (already sinalizado na entrega
anterior — o projeto atual bateu o limite de 2 projetos grátis).

## Resumo do que preciso de você pra avançar a fase 2

1. ~~Confirmar qual caminho seguir~~ — já decidido: WhatsApp Business Cloud API (oficial),
   pelo risco baixo de banimento. Falta só a conta Meta Business verificada + número aprovado.
2. Se já tiver conta Meta Business (de outro projeto seu, por exemplo), me passar o acesso
   pra eu configurar o número e o webhook.
3. Confirmar se já existe conta Meta Business + Instagram profissional conectados, caso queira
   avançar com o Instagram nessa fase também.
4. A organização/conta do Supabase pra eu criar o banco de dados (pendência já sinalizada).
5. Uma chave de API da Anthropic seu, se quiser que eu já publique a versão com a Claude de
   verdade no chat do catálogo (o motor local já funciona sem isso, mas é mais limitado).
