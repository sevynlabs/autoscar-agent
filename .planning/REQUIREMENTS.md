# Requirements: Autoscar Agent

**Defined:** 2026-03-17
**Core Value:** O agente de IA deve atender o lead instantaneamente, identificar o veículo de interesse, buscar dados/fotos no portal e qualificar o lead de forma autônoma — sem intervenção humana até o momento de negociação.

## v1 Requirements

### WhatsApp

- [ ] **WAPP-01**: Usuário pode conectar número WhatsApp via QR code (Evolution API)
- [ ] **WAPP-02**: Usuário pode conectar múltiplos números WhatsApp simultaneamente
- [ ] **WAPP-03**: Agente recebe e responde mensagens WhatsApp em tempo real
- [ ] **WAPP-04**: Agente envia carrossel de 3-5 fotos do veículo no WhatsApp
- [ ] **WAPP-05**: Operador visualiza todas as conversas em inbox multichat
- [ ] **WAPP-06**: Vendedor assume conversa e IA pausa automaticamente (handoff)
- [ ] **WAPP-07**: Agente envia resumo do lead qualificado para grupo de vendedores

### AI Agent

- [ ] **AGENT-01**: Agente identifica veículo de interesse do lead pela mensagem/anúncio
- [ ] **AGENT-02**: Agente busca dados do veículo no portal autoscar.com.br via scraping
- [ ] **AGENT-03**: Agente qualifica lead autonomamente (interesse, crédito, cidade, pagamento)
- [ ] **AGENT-04**: Agente cria card no CRM automaticamente ao iniciar qualificação
- [ ] **AGENT-05**: Agente atualiza dados do lead no CRM conforme conversa avança
- [ ] **AGENT-06**: Agente move card no Kanban conforme etapa de qualificação
- [ ] **AGENT-07**: Agente gera nota resumo da qualificação para vendedor
- [ ] **AGENT-08**: Agente executa follow-up automático por WhatsApp
- [ ] **AGENT-09**: Agente mantém contexto da conversa entre mensagens

### CRM

- [ ] **CRM-01**: Usuário visualiza leads em Kanban com drag-and-drop
- [ ] **CRM-02**: Usuário configura etapas do pipeline (criar, editar, reordenar, excluir)
- [ ] **CRM-03**: Usuário configura regras de qualificação por pipeline
- [ ] **CRM-04**: Usuário busca e filtra leads por nome, telefone, estágio, veículo
- [ ] **CRM-05**: Usuário visualiza histórico de conversa e notas de cada lead
- [ ] **CRM-06**: Usuário edita dados do lead manualmente
- [ ] **CRM-07**: CRM atualiza em tempo real via WebSocket

### Channels

- [ ] **CHAN-01**: Integração nativa com Instagram DM para receber e responder mensagens
- [ ] **CHAN-02**: Follow-up automático por SMS
- [ ] **CHAN-03**: Interface unificada de chat para todos os canais

### Scraper

- [ ] **SCRP-01**: Scraper extrai dados do veículo (modelo, ano, km, preço, fotos)
- [ ] **SCRP-02**: Scraper cacheia resultados para evitar requisições repetidas
- [ ] **SCRP-03**: Scraper valida dados extraídos e alerta em caso de falha

### Platform

- [ ] **PLAT-01**: Usuário faz login com email/senha
- [ ] **PLAT-02**: Admin gerencia usuários e permissões
- [ ] **PLAT-03**: Dashboard com métricas de leads, conversões e performance
- [ ] **PLAT-04**: API externa documentada para integração com sistemas terceiros
- [ ] **PLAT-05**: Webhooks configuráveis para eventos (novo lead, qualificado, etc)
- [x] **PLAT-06**: Configuração de APIs (.env) — Evolution API + OpenAI
- [x] **PLAT-07**: Deploy via Docker Compose em VPS

## v2 Requirements

### Channels

- **CHAN-04**: Integração com Facebook Messenger
- **CHAN-05**: Integração com Telegram

### Platform

- **PLAT-08**: Multi-tenant SaaS (workspaces isolados por cliente)
- **PLAT-09**: Billing e planos de assinatura
- **PLAT-10**: App mobile nativo (iOS/Android)

### AI Agent

- **AGENT-10**: Agente com múltiplos modelos de IA (fallback GPT-4o → GPT-4o-mini)
- **AGENT-11**: Analytics de custo por lead (tokens consumidos)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Billing/planos de assinatura | v1 é uso interno, SaaS vem no v2 |
| App mobile nativo | Web responsivo é suficiente para v1 |
| Facebook Messenger | Foco WhatsApp + Instagram + SMS para v1 |
| Telegram | Sem demanda no contexto atual |
| Integração com financeiras/bancos | Fora do escopo de qualificação |
| AI fine-tuning | Prompt engineering é suficiente |
| Email marketing | Mercado WhatsApp-first, email é irrelevante |
| Inventário local de veículos | Portal autoscar.com.br é a fonte de verdade |
| Chamadas de vídeo/voz | WhatsApp já faz isso nativamente |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WAPP-01 | Phase 1 | Pending |
| WAPP-02 | Phase 1 | Pending |
| WAPP-03 | Phase 1 | Pending |
| SCRP-01 | Phase 1 | Pending |
| SCRP-02 | Phase 1 | Pending |
| SCRP-03 | Phase 1 | Pending |
| PLAT-06 | Phase 1 | Complete |
| PLAT-07 | Phase 1 | Complete |
| AGENT-01 | Phase 2 | Pending |
| AGENT-02 | Phase 2 | Pending |
| AGENT-03 | Phase 2 | Pending |
| AGENT-04 | Phase 2 | Pending |
| AGENT-05 | Phase 2 | Pending |
| AGENT-06 | Phase 2 | Pending |
| AGENT-07 | Phase 2 | Pending |
| AGENT-08 | Phase 2 | Pending |
| AGENT-09 | Phase 2 | Pending |
| WAPP-04 | Phase 2 | Pending |
| WAPP-07 | Phase 2 | Pending |
| CRM-01 | Phase 3 | Pending |
| CRM-02 | Phase 3 | Pending |
| CRM-03 | Phase 3 | Pending |
| CRM-04 | Phase 3 | Pending |
| CRM-05 | Phase 3 | Pending |
| CRM-06 | Phase 3 | Pending |
| CRM-07 | Phase 3 | Pending |
| WAPP-05 | Phase 3 | Pending |
| WAPP-06 | Phase 3 | Pending |
| PLAT-01 | Phase 4 | Pending |
| PLAT-02 | Phase 4 | Pending |
| PLAT-03 | Phase 4 | Pending |
| PLAT-04 | Phase 4 | Pending |
| PLAT-05 | Phase 4 | Pending |
| CHAN-01 | Phase 4 | Pending |
| CHAN-02 | Phase 4 | Pending |
| CHAN-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 36 total (29 originally labeled + 7 PLAT items confirmed in file)
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation — traceability populated*
