# Autoscar Agent — Plataforma SDR com IA

## What This Is

Plataforma de atendimento e qualificação de leads automotivos com agente de IA SDR para o portal Autoscar (autoscar.com.br). O agente atende leads vindos de anúncios de veículos específicos via WhatsApp e Instagram, identifica o carro de interesse, busca informações e fotos no portal via web scraping, envia carrossel de fotos no WhatsApp, qualifica o lead com critérios configuráveis (interesse + condição financeira), gerencia o CRM Kanban automaticamente e notifica vendedores no grupo de WhatsApp ao concluir a qualificação. Arquitetura preparada para evoluir de uso interno para SaaS multi-tenant.

## Core Value

O agente de IA deve atender o lead instantaneamente, identificar o veículo de interesse, buscar dados/fotos no portal e qualificar o lead de forma autônoma — sem intervenção humana até o momento de negociação.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Agente SDR com IA (OpenAI) para atendimento e qualificação de leads
- [ ] Web scraping do portal autoscar.com.br (dados e fotos de veículos)
- [ ] Envio de carrossel de fotos do veículo no WhatsApp do lead
- [ ] Integração nativa com Evolution API (WhatsApp — QR code, multi-número)
- [ ] Integração com Instagram DM
- [ ] CRM Kanban com pipeline customizável pelo usuário
- [ ] Agente com autonomia total sobre CRM (criar, editar, mover, excluir cards)
- [ ] Regras de qualificação configuráveis (interesse + crédito/financiamento/troca/à vista)
- [ ] Criação automática de notas com resumo da qualificação
- [ ] Envio automático de lead qualificado para grupo de WhatsApp dos vendedores
- [ ] Multichat — atendimento simultâneo de múltiplos leads
- [ ] Multi-canal — conectar vários números WhatsApp e contas Instagram
- [ ] Dashboard de relatórios e análise de leads
- [ ] Gestão de leads com filtros e busca
- [ ] Multi-usuário com permissões
- [ ] API externa + webhooks para integração com sistemas terceiros
- [ ] Follow-up automático por WhatsApp e SMS
- [ ] Design moderno UI/UX (arrojado, profissional)
- [ ] Configuração de APIs no .env (Evolution API global + OpenAI)

### Out of Scope

- Billing/planos/cobrança — v1 é uso interno, SaaS vem depois
- App mobile nativo — web responsivo é suficiente para v1
- Facebook Messenger — foco WhatsApp + Instagram + SMS para v1
- Telegram — sem demanda atual
- Integração com financeiras/bancos — fora do escopo de qualificação

## Context

- **Portal:** autoscar.com.br — portal de veículos, sem API disponível, precisa de scraping HTML
- **Fluxo principal:** Anúncio de veículo específico → Lead chega no WhatsApp → IA identifica carro → Scraping do portal → Envia carrossel de fotos + info → Qualifica (interesse, crédito, cidade, forma de pagamento) → Cria/atualiza card no Kanban → Preenche dados → Gera nota resumo → Envia pro grupo de vendedores
- **Volume:** 500-2000 leads/mês, equipe de 2-5 vendedores inicialmente
- **WhatsApp:** Evolution API como backend (config global no .env, QR code no painel)
- **IA:** OpenAI API para o agente conversacional
- **Deploy:** VPS própria (Docker)
- **Visão futura:** Evoluir para SaaS multi-tenant com múltiplos clientes/lojas

## Constraints

- **WhatsApp API:** Evolution API — precisa ser integração nativa, não genérica
- **Scraping:** Portal autoscar.com.br pode mudar estrutura — scraping precisa ser resiliente
- **Deploy:** Docker em VPS — precisa ser leve e auto-contido (docker-compose)
- **IA:** OpenAI API — custo por token, precisa otimizar prompts
- **Performance:** 500-2000 leads/mês com atendimento instantâneo exige async/queue

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Interno → SaaS depois | Validar com Autoscar antes de produtizar | — Pending |
| Evolution API nativa | Padrão do mercado BR, QR code fácil, multi-número | — Pending |
| Pipeline customizável | Cada negócio tem fluxo diferente, flexibilidade é essencial | — Pending |
| Scraping HTML | Portal não tem API, scraping é a única opção | — Pending |
| Stack a definir por pesquisa | Sem preferência, melhor opção para o domínio | — Pending |

---
*Last updated: 2026-03-17 after initialization*
