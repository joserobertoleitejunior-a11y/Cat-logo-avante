# AVANTE — CRM Multicanal, Bots (WhatsApp/Instagram/Catálogo) e Agenda de Visitas

> Complemento do `PLANO_PROJETO_AVANTE.md` — VIBE CODING PROCESS

---

## 0. O que mudou no escopo

Você pediu pra somar três coisas ao que já estava desenhado:

1. **CRM** — não só o pedido, mas o relacionamento com o lead/cliente inteiro.
2. **Bot em 3 canais** — WhatsApp, Instagram e o próprio catálogo (site).
3. **Agendamento de visita de consultor** — alguém da Avante vai até o lojista.

A decisão de arquitetura mais importante aqui: **os três canais não podem ser three sistemas separados**. Se o WhatsApp tiver um histórico, o Instagram outro, e o site um terceiro, o consultor perde o fio da meada e o cliente tem que se repetir. Por isso o desenho abaixo trata os três canais como **portas de entrada diferentes pro mesmo CRM** — um único contato, uma única linha do tempo, não importa por onde ele chegou.

Te mandei junto um protótipo (`crm_dashboard.html`) já com essa lógica funcionando com dados de exemplo: pipeline em kanban, ficha de contato com timeline unificada (WhatsApp + Instagram + Site no mesmo lugar), agenda semanal de visitas e status de cada canal.

---

## 1. Modelo de dados do CRM

```
contato {
  id, nome, empresa, cidade, telefone, instagram_handle,
  canal_origem,            // wa | ig | site
  consultor_responsavel,
  status,                  // lead | ativo | perdido
  criado_em
}

interacao {
  id, contato_id,
  canal,                   // wa | ig | site | crm (nota interna)
  tipo,                    // mensagem_recebida | mensagem_enviada | nota | pedido | agendamento
  conteudo,
  timestamp
}

deal / pipeline_stage {
  id, contato_id,
  estagio,   // Novo lead → Em conversa → Proposta enviada → Visita agendada → Cliente ativo → Perdido
  valor_estimado,
  atualizado_em
}

visita {
  id, contato_id, consultor_id,
  data_hora, endereco,
  status,    // pendente | confirmado | realizado | cancelado
  origem     // quem pediu: bot_whatsapp | bot_instagram | site | consultor manualmente
}
```

Isso é uma extensão natural da tabela `produtos` que já ficou combinada no plano anterior — mesmo banco (Firestore ou Supabase), mesmo projeto, só mais coleções/tabelas. Não é um CRM externo (tipo RD Station/Pipedrive) — é construído do zero, do jeito que o item 6 do seu `PADROES-AGENCIA.md` já prevê ("núcleo fixo, construído uma vez"), porque:
- fica tudo no mesmo lugar que o catálogo e o pedido (sem sincronizar dois sistemas),
- não tem mensalidade de CRM de terceiro,
- e como o modelo já nasce pensado pra multi-tenant (seção 6 do seu padrão), no futuro dá pra reaproveitar pra outro cliente da agência sem reescrever.

---

## 2. Arquitetura multicanal — como os 3 canais viram 1 CRM

```
WhatsApp (Evolution API) ──┐
Instagram (Meta Graph API) ─┼──►  Webhook único (Netlify Function)  ──► grava em `contato` + `interacao`
Site / Catálogo (chat)  ────┘            │
                                          ▼
                                    Claude (Anthropic) decide a resposta
                                    consultando a tabela `produtos`
                                          │
                                          ▼
                              responde no MESMO canal de origem
                              (wa → Evolution / ig → Graph API / site → websocket ou polling)
```

Pontos técnicos por canal:

- **WhatsApp** — já mapeado no plano anterior: Evolution API, self-hosted, webhook validado por assinatura antes de processar (seção 4 do seu padrão de segurança).
- **Instagram Direct** — usa a **Instagram Messaging API** (parte da Meta Graph API). Pré-requisitos que são decisão de negócio, não técnica: a conta do Instagram da Avante precisa ser **conta profissional vinculada a uma Página do Facebook**, e o app que vocês criarem no Meta for Developers passa por uma **revisão da Meta** pra liberar a permissão de enviar/receber mensagem automaticamente (isso não é imediato — costuma levar alguns dias, vale já iniciar esse cadastro cedo).
- **Chat do catálogo (site)** — o mais simples de implementar tecnicamente, porque é código nosso de ponta a ponta: um widget de chat dentro do `Catálogo Rápido`, que já sabe qual produto o cliente está olhando na hora (contexto automático) — vantagem que os outros dois canais não têm de graça.

O motor de resposta (o "cérebro" do bot) é o **mesmo Claude configurado uma vez**, com acesso à base de produtos — só muda o "conector de saída" pra cada canal. Isso evita ter 3 bots com personalidade/regra de negócio diferentes.

---

## 3. Agendamento de visita de consultor

Fluxo pensado pra nascer em qualquer um dos 3 canais:

1. **Gatilho**: cliente pede ("quero que alguém venha me mostrar o catálogo") **ou** o bot identifica intenção de compra grande/recorrente e sugere proativamente ("faz sentido um consultor passar aí?").
2. **Bot oferece horários livres** do consultor da região do cliente (a agenda já existe no CRM — não é um Google Calendar solto, é a tabela `visita` consultada em tempo real).
3. **Cliente escolhe** (ou o bot escala pra um humano se o pedido for específico demais).
4. **Confirmação automática**: mensagem de volta no mesmo canal + a visita aparece no painel do consultor (a tela de Agenda do protótipo).
5. **Lembrete automático** 1 dia antes, disparado pelo WhatsApp mesmo que o agendamento tenha nascido no Instagram ou no site — porque WhatsApp é o canal que a maioria confere de fato.
6. **Pós-visita**: consultor marca "realizado" no CRM, com nota — isso vira histórico permanente na ficha do contato.

Regra importante de segurança/negócio: o bot **nunca confirma sozinho um horário sem checar conflito de agenda** — é uma escrita transacional na tabela `visita`, não uma resposta "solta" gerada pela IA. Isso evita o clássico bug de bot de agendamento (dois clientes recebendo confirmação pro mesmo horário).

---

## 4. O que precisa ser decidido/providenciado por vocês (não é código)

- **Conta comercial do Instagram** vinculada a uma Página do Facebook da Avante (se ainda não existir).
- **Cadastro do app no Meta for Developers** + início do processo de revisão da permissão de mensagens — isso tem fila, vale começar independente de quando o resto for implementado.
- **Nomes/telefones dos consultores** que vão aparecer na agenda e receber as visitas atribuídas.
- **Regra de atribuição de consultor por região/cliente** (é automático por CEP/cidade, ou manual?).

---

## 5. Fases atualizadas (substituindo a seção 5 do plano anterior)

1. ~~Fase 1 — Catálogo digital público~~ ✅ feito (revista + catálogo rápido).
2. ~~Fase 2 — Base de dados de produtos~~ ✅ primeira leva feita (145 SKUs + planilha de pendências).
3. **Fase 3 — CRM base**: tabelas de contato/interação/pipeline, painel interno (o protótipo já mostra a cara disso).
4. **Fase 4 — Bot WhatsApp** conectado ao CRM (monta pedido + já registra tudo na ficha do contato).
5. **Fase 5 — Agenda de visitas** funcionando de ponta a ponta a partir do WhatsApp.
6. **Fase 6 — Chat no site** (Catálogo Rápido) usando o mesmo motor.
7. **Fase 7 — Instagram**, condicionada à revisão do app pela Meta (por isso vale iniciar o cadastro já, em paralelo às fases anteriores).
8. **Fase 8 — Observabilidade**: Sentry cobrindo os 3 pontos de entrada, alerta se qualquer canal cair.

---

## 6. Protótipo entregue agora

`crm_dashboard.html` — abre sozinho no navegador, com dados de exemplo (6 contatos fictícios espalhados pelos 3 canais):

- **Pipeline**: kanban por estágio (Novo lead → Cliente ativo/Perdido), cada card mostra o canal de origem.
- **Contatos**: lista com busca e filtro por canal.
- **Ficha do contato**: ao clicar em qualquer card/linha, abre a timeline unificada — dá pra ver uma conversa que começou no Instagram e virou visita agendada, tudo num só lugar.
- **Agenda**: grade semanal por consultor, com o botão de novo agendamento (ainda mock — é onde entraria o formulário real).
- **Canais**: status de conexão de cada canal (WhatsApp já contemplado no plano anterior, Instagram e chat do site como próximos).

É só a interface pra você bater o olho na ideia e me dizer o que muda — nenhum dado é real ainda.
