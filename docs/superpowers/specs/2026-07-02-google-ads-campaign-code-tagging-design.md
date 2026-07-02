# Marcação de leads por código de campanha (Google Ads / Shorts)

**Data:** 2026-07-02
**Status:** Aprovado (desenho) — aguardando revisão do spec

## Contexto e objetivo

Vamos rodar campanhas pagas no Google (anúncios em vídeo no YouTube Shorts, um por
veículo/vendedor) com botão "Click to WhatsApp". O botão abre o WhatsApp do mesmo
número já usado, com uma mensagem pré-preenchida contendo **a URL do veículo + o
código do anúncio**.

O objetivo é simples: quando um lead chega por esse caminho, o sistema deve
**notificar o grupo do vendedor exatamente como já faz hoje**, adicionando **uma
marcação com o código da campanha** na notificação. Isso permite ao vendedor (e a
nós) identificar que o lead veio de tráfego pago e de qual anúncio.

Cada campanha é específica de uma concessionária e anuncia apenas veículos dela.
Portanto **o roteamento pro grupo certo já é resolvido pelo mecanismo atual**
(detecção da URL do veículo → e-mail do vendedor → grupo). Nenhuma mudança de
roteamento é necessária.

## Não-objetivos (YAGNI)

- **Sem processo/worker/agente paralelo.** O sistema é um processo único
  (`src/main.ts`) com workers BullMQ sobre o mesmo Postgres/Redis. Um segundo
  processo escutando o mesmo webhook causaria duplicação e corrida de notificação.
  Tudo aqui é aditivo dentro do fluxo existente.
- **Sem tabela de mapeamento código→grupo.** O roteamento continua por veículo.
- **Sem plumbing de gclid/utm de landing page**, sem dashboard de analytics.
- **Sem alterar o template da Cloud API** (`novo_lead_veiculo`). A marcação entra
  só na notificação de **grupo** (texto livre via Evolution), que é o caso de uso.
  Marcar a notificação por telefone exigiria reaprovar o template na Meta — fora
  de escopo.

## Fluxo (ponta a ponta)

```
Botão do Shorts
  → WhatsApp abre com mensagem: "<URL do veículo?camp=CODIGO>"
  → webhook (routes/webhook.ts) → fila `messages`
  → message.worker.ts:
        detecta a URL do veículo            (JÁ EXISTE)
        NOVO: extrai o código da campanha e NORMALIZA a URL (remove o código)
        cria/carrega o lead com a URL limpa (JÁ EXISTE)
        NOVO: grava lead.campaignCode (first-touch)
  → runPostTurn → scheduleSellerNotification → notifySellersGroupForLead (JÁ EXISTE)
        resolve vendedor/grupo pela URL limpa (JÁ EXISTE)
        buildLeadSummary:
        NOVO: adiciona linha "📢 Campanha: CODIGO" quando presente
  → Evolution sendText pro grupo do vendedor (JÁ EXISTE)
```

## Componentes

### 1. Modelo de dados — `prisma/schema.prisma`

Adicionar um campo ao model `Lead` (linhas 71-102):

```prisma
campaignCode  String?
```

- `null` = lead normal → comportamento de hoje **totalmente intacto**.
- A simples presença do código já significa "veio de anúncio pago". Não é preciso
  um campo `source` separado nesta fase.
- **Não** faz parte do índice único `@@unique([phone, pipelineId, vehicleUrl])`
  (linha 97) — a identidade do lead continua sendo o veículo, não a campanha.

Requer uma migration Prisma (`prisma migrate`).

### 2. Extração do código + normalização da URL — `src/queue/workers/message.worker.ts`

Ponto de inserção: logo após a detecção da URL do veículo (linhas 73-84,
`detectAutoscarUrl`) e **antes** de `loadOrCreateConversation` (linha 98).

Requisitos:

1. **Extrair o código.** Fonte primária: query param na URL do veículo
   (nome do param: `camp`). Fallback tolerante: token em texto livre na mensagem
   (ex: `[CODIGO]` ou `camp:CODIGO`), para não depender de formatação perfeita do
   anúncio. Resultado: uma string `campaignCode | null`.
2. **Normalizar a URL — requisito crítico.** Remover o param de campanha (e params
   de tracking conhecidos) da URL detectada **antes** de usá-la como
   `detectedVehicleUrl`. Motivo: a `vehicleUrl` faz parte da chave única do lead
   (schema linha 97) e é usada no lookup do vendedor via Leads API da autoscar.
   Se o `?camp=…` ficar grudado, o mesmo veículo viraria um lead duplicado e o
   match do vendedor pode falhar. A URL que segue pro resto do fluxo deve ser a
   URL limpa do veículo.
3. **Persistir o código (first-touch).** Após `loadOrCreateConversation` criar/
   carregar o lead, gravar `campaignCode` no lead **apenas se ainda estiver vazio**
   (mesmo padrão do `pushName` nas linhas 102-108). O código só aparece na 1ª
   mensagem; gravar no lead o torna disponível na notificação (que roda ~3 min
   depois, em outro worker). Não sobrescrever um código já existente (mantém a
   origem do primeiro toque).

Isolar a lógica de parse numa função pequena e testável, ex:
`parseCampaign(message, detectedUrl) → { cleanUrl, campaignCode }`, em um módulo
próprio (ex: `src/whatsapp/campaign.ts`). Ela não depende de DB nem de rede.

### 3. Exibição na notificação — `src/crm/seller-notification.service.ts`

Em `buildLeadSummary` (linhas 216-280), adicionar uma linha condicional no bloco
de infos do lead (após o veículo, linha 261):

```
if (lead.campaignCode) {
  lines.push(`📢 Campanha: ${lead.campaignCode}`);
}
```

- Mesmo formato de sempre; só entra a linha quando há código.
- Usa `📢` para não colidir com o `📣` do cabeçalho (linha 246).
- `buildLeadSummary` já busca o lead do banco (linha 220) — basta o campo estar
  no select/no model; nenhuma query nova.

## Tratamento de casos-limite

| Caso | Comportamento |
|------|---------------|
| Usuário apaga a mensagem pré-preenchida (sem código, sem URL) | Fluxo de hoje, sem marcação. Loga em nível info. |
| Mensagem tem código mas sem URL de veículo detectável | Roteamento por veículo não dispara (como hoje). O código fica gravado no lead assim que houver lead; se nunca houver veículo, não há notificação de grupo — comportamento atual preservado. |
| URL com `?camp=` mas param vazio (`?camp=`) | `campaignCode = null`; URL normalizada normalmente. |
| Lead recorrente que já tinha `campaignCode` | Mantém o código do primeiro toque; não sobrescreve. |
| Código presente mas com caracteres estranhos | Aceita como string crua (o campo é livre). Aplicar apenas um `trim` e um limite de tamanho defensivo (ex: 64 chars). |

## Testes

- **Unit — `parseCampaign`:** URL com `?camp=X`; URL sem param; código como texto
  separado; mensagem sem nada; param vazio; múltiplos params preservando os
  legítimos; garantir que `cleanUrl` nunca contém o código.
- **Unit — normalização de URL:** a URL limpa bate com a URL orgânica do mesmo
  veículo (mesma chave de lead).
- **Integração — persistência first-touch:** grava na 1ª mensagem; não sobrescreve
  na 2ª.
- **Unit — `buildLeadSummary`:** inclui a linha `📢 Campanha:` quando há código;
  omite quando não há.

## Riscos e pontos a validar no plano

1. **`detectAutoscarUrl` e o param de campanha.** Confirmar se ela retorna a URL
   com a query string; ajustar a ordem de normalização de acordo. A normalização
   deve acontecer antes de `detectTriggerCodeMatch`/`buildShortVehicleUrl`, que
   comparam a URL contra `triggerVehicleUrls`.
2. **Formato final do código no anúncio.** Assumido `?camp=CODIGO` como param na
   URL. Se a montagem real do link do Shorts usar outro nome (`utm_campaign`,
   etc.), é só ajustar o nome do param na função de parse — ponto único de mudança.
