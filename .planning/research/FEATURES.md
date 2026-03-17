# Features Research: Autoscar Agent

## Domain
AI SDR / Automotive Lead Management / WhatsApp-first CRM

## Competitive Landscape
Kommo, RD Station, HubSpot, Respond.io, Botpress, WhatsApp-first platforms in Brazilian automotive market.

---

## Table Stakes (must have or users leave)

### Communication
| Feature | Complexity | Dependencies |
|---------|-----------|--------------|
| WhatsApp multichat inbox | High | Evolution API |
| Conversation history per lead | Medium | Database |
| Multi-number WhatsApp connection | Medium | Evolution API |
| AI-to-human handoff | Medium | Agent + routing |
| Salesperson notification (group WA) | Low | Evolution API |

### CRM
| Feature | Complexity | Dependencies |
|---------|-----------|--------------|
| Lead card auto-creation | Medium | Agent + DB |
| Kanban pipeline with drag-and-drop | High | Frontend |
| Pipeline stage movement | Medium | CRM logic |
| Lead notes | Low | Database |
| Lead filters and search | Medium | Database + UI |

### Platform
| Feature | Complexity | Dependencies |
|---------|-----------|--------------|
| Multi-user with roles | Medium | Auth system |
| Basic dashboard/reports | Medium | Analytics |
| Mobile-responsive UI | Medium | Frontend |

---

## Differentiators (competitive advantage)

| Feature | Complexity | Why It Differentiates |
|---------|-----------|----------------------|
| AI SDR with autonomous qualification judgment | High | Not just chatbot — makes qualification decisions like a human SDR |
| autoscar.com.br scraping for vehicle data | High | No competitor injects real-time portal data into conversations |
| WhatsApp photo carousel of scraped vehicle | Medium | Sends actual vehicle photos, not just links |
| Configurable qualification rules | Medium | Each business defines what "qualified" means |
| AI-generated qualification summary notes | Medium | Saves vendedor time reading conversation history |
| Instagram DM integration | Medium | Second biggest channel for automotive leads in BR |
| AI agent with full CRM autonomy | High | Agent creates, moves, updates, deletes cards via tool-calls |
| Follow-up automation (WhatsApp + SMS) | Medium | Automated re-engagement without human intervention |
| External webhook + API | Medium | Connects to any external system |
| Web scraping resilience (auto-repair) | High | Survives portal HTML changes without breaking |

---

## Anti-Features (deliberately NOT building)

| Feature | Reason |
|---------|--------|
| Built-in billing/plans | SaaS later — v1 is internal use |
| Native mobile app | Web responsive is sufficient for v1 |
| Facebook Messenger | Focus WhatsApp + Instagram + SMS |
| Telegram | No demand in current context |
| Bank/financing API integration | Out of scope for qualification |
| AI fine-tuning UI | Use prompt engineering, not fine-tuning |
| Email marketing | WhatsApp-first market, email is noise |
| Local inventory database | Scrape portal as source of truth, don't duplicate |
| In-platform video/voice calls | WhatsApp handles this natively |
| Hallucinated vehicle data | Agent must ONLY use scraped real data |

---

## MVP Build Order (recommended)

1. **WhatsApp multichat** — Core communication channel
2. **AI SDR + scraping** — The differentiating intelligence
3. **Photo carousel** — Visual engagement
4. **Kanban CRM** — Lead organization
5. **Qualification rules** — Business logic
6. **Summary notes + notification** — Vendedor handoff
7. **Basic dashboard** — Visibility

## Competitive Moat

No other platform combines: WhatsApp-native + AI judgment + domain-specific scraping + Brazilian automotive market context. This is the core advantage.

---
*Researched: 2026-03-17*
