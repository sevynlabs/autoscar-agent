# Campaign Code Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag leads that arrive from Google Ads / YouTube Shorts Click-to-WhatsApp ads with the campaign code carried in the pre-filled message, and show that code in the seller-group notification — without changing routing or adding any parallel process.

**Architecture:** Additive change to the existing single-process BullMQ flow. A new pure function extracts the campaign code from the message/URL and returns a normalized (code-stripped) vehicle URL. The message worker persists the code on the `Lead` (first-touch), and `buildLeadSummary` renders one extra line. Routing to the seller's group is unchanged — it stays keyed on the clean vehicle URL.

**Tech Stack:** TypeScript (ESM, `"type": "module"`), Prisma 6 + PostgreSQL, BullMQ, `tsx` for running TS. No test framework in the repo — pure logic is verified with a `tsx` assertion script; wiring is verified with `tsc --noEmit`.

## Global Constraints

- **ESM imports:** every relative import MUST use a `.js` extension (e.g. `import { x } from '../whatsapp/campaign.js'`), matching the existing codebase.
- **No test framework:** do not add vitest/jest. Verify pure logic with a `tsx` assertion script under `scripts/`; verify wiring with `npx tsc --noEmit`.
- **`campaignCode` is nullable** and MUST NOT be part of the `@@unique([phone, pipelineId, vehicleUrl])` index. `null` = today's behavior, fully intact.
- **No routing changes.** Seller/group routing stays keyed on the clean vehicle URL. The campaign code is a tag only.
- **Marca só em grupo.** The code is rendered only in `buildLeadSummary` (Evolution free-text group notification). Do NOT touch the Cloud API template `novo_lead_veiculo`.
- **URL normalization is mandatory:** the campaign/tracking params MUST be stripped from the URL before it becomes `vehicleUrl`, so the ad lead and the organic lead for the same vehicle share one identity and the autoscar seller lookup keeps working.

---

### Task 1: Add `campaignCode` to the `Lead` model

**Files:**
- Modify: `prisma/schema.prisma:71-102` (model `Lead`)

**Interfaces:**
- Consumes: nothing.
- Produces: a nullable scalar `campaignCode: string | null` on `Lead`, available on every Prisma `Lead` result and settable via `prisma.lead.update`/`create`.

- [ ] **Step 1: Add the field**

In `prisma/schema.prisma`, inside `model Lead`, add the field near `vehicleUrl` (line 80). Do NOT add it to the `@@unique` index.

```prisma
  vehicleUrl    String?
  campaignCode  String?
```

- [ ] **Step 2: Create the migration and regenerate the client**

Run: `npx prisma migrate dev --name add_lead_campaign_code`
Expected: a new migration folder under `prisma/migrations/…add_lead_campaign_code/` is created, applied to the dev DB, and the Prisma Client is regenerated.

> If no dev database is reachable in this environment, instead run `npx prisma generate` (so the client types include `campaignCode`) and create the migration SQL manually to be applied later with `npx prisma migrate deploy`. The migration SQL is:
> ```sql
> ALTER TABLE "Lead" ADD COLUMN "campaignCode" TEXT;
> ```

- [ ] **Step 3: Verify the client picked up the field**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors). The generated client now knows `campaignCode`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add campaignCode field to Lead"
```

---

### Task 2: Pure campaign-code parser

**Files:**
- Create: `src/whatsapp/campaign.ts`
- Test: `scripts/test-campaign.ts`

**Interfaces:**
- Consumes: nothing (pure, no DB/network).
- Produces:
  - `extractCampaign(vehicleUrl: string | null | undefined, message: string): { cleanUrl: string | null; campaignCode: string | null }`
  - `sanitizeCode(raw: string | null | undefined): string | null`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-campaign.ts`:

```ts
import assert from 'node:assert/strict';
import { extractCampaign } from '../src/whatsapp/campaign.js';

// 1. Code as query param → extracted, URL cleaned
let r = extractCampaign('https://autoscar.com.br/carros/civic-2020?camp=SHORTS-CUR-01', 'oi');
assert.equal(r.campaignCode, 'SHORTS-CUR-01');
assert.equal(r.cleanUrl, 'https://autoscar.com.br/carros/civic-2020');

// 2. Clean URL of an ad lead equals the organic URL (no duplicate leads)
const organic = extractCampaign('https://autoscar.com.br/carros/civic-2020', 'oi');
assert.equal(r.cleanUrl, organic.cleanUrl);
assert.equal(organic.campaignCode, null);

// 3. Code via free-text fallback when there is no URL
r = extractCampaign(null, 'quero saber camp: PROMO99');
assert.equal(r.campaignCode, 'PROMO99');
assert.equal(r.cleanUrl, null);

// 4. No code present
r = extractCampaign('https://autoscar.com.br/carros/onix', 'ola');
assert.equal(r.campaignCode, null);
assert.equal(r.cleanUrl, 'https://autoscar.com.br/carros/onix');

// 5. Empty camp param → no code
r = extractCampaign('https://autoscar.com.br/carros/onix?camp=', 'ola');
assert.equal(r.campaignCode, null);

// 6. Preserve legit params, strip tracking params
r = extractCampaign('https://autoscar.com.br/carros/onix?camp=X&cor=azul&utm_source=google', 'x');
assert.equal(r.campaignCode, 'X');
assert.equal(r.cleanUrl, 'https://autoscar.com.br/carros/onix?cor=azul');

// 7. Length cap at 64 chars
r = extractCampaign('https://autoscar.com.br/carros/onix?camp=' + 'A'.repeat(100), 'x');
assert.equal(r.campaignCode?.length, 64);

console.log('campaign parse: all assertions passed');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/test-campaign.ts`
Expected: FAIL — cannot find module `../src/whatsapp/campaign.js` (file not created yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/whatsapp/campaign.ts`:

```ts
// Query params we strip from a vehicle URL before it becomes the lead's
// vehicleUrl. `camp` carries our campaign code; the rest are ad/tracking noise.
const TRACKING_PARAMS = [
  'camp',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
];

const CODE_RE = /[A-Za-z0-9_-]{1,64}/;

/** Normalize a raw code string: trim, keep the first safe token, cap at 64. */
export function sanitizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(CODE_RE);
  if (!match) return null;
  return match[0].slice(0, 64);
}

/**
 * Extract the campaign code from an ad's pre-filled WhatsApp message and
 * return a vehicle URL with the campaign/tracking params stripped.
 *
 * Priority: the `camp` query param on the vehicle URL. Fallback: a
 * `camp: CODE` / `camp=CODE` token in the free-text message. Pure — no DB,
 * no network.
 */
export function extractCampaign(
  vehicleUrl: string | null | undefined,
  message: string,
): { cleanUrl: string | null; campaignCode: string | null } {
  let cleanUrl: string | null = vehicleUrl ?? null;
  let campaignCode: string | null = null;

  if (vehicleUrl) {
    try {
      const url = new URL(vehicleUrl);
      campaignCode = sanitizeCode(url.searchParams.get('camp'));
      for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
      cleanUrl = url.toString();
    } catch {
      // Not a parseable URL — leave it untouched.
      cleanUrl = vehicleUrl;
    }
  }

  if (!campaignCode) {
    const match = message.match(/camp[\s:=]+([A-Za-z0-9_-]{1,64})/i);
    if (match) campaignCode = sanitizeCode(match[1]);
  }

  return { cleanUrl, campaignCode };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx scripts/test-campaign.ts`
Expected: PASS — prints `campaign parse: all assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add src/whatsapp/campaign.ts scripts/test-campaign.ts
git commit -m "feat: add campaign code parser with URL normalization"
```

---

### Task 3: Wire the parser into the message worker

**Files:**
- Modify: `src/queue/workers/message.worker.ts` (add import; insert after line 94; insert after line 108)

**Interfaces:**
- Consumes: `extractCampaign` from Task 2; `campaignCode` field from Task 1; existing `detectedVehicleUrl`, `message`, `conversation.lead`, `prisma`.
- Produces: `conversation.lead.campaignCode` populated (first-touch) for downstream notification; `detectedVehicleUrl` normalized (code stripped) before lead creation.

- [ ] **Step 1: Add the import**

At the top of `src/queue/workers/message.worker.ts`, add alongside the other imports:

```ts
import { extractCampaign } from '../../whatsapp/campaign.js';
```

- [ ] **Step 2: Extract the code and normalize the URL before creating the lead**

Insert immediately after the Priority-3 detection block (after line 94, before the `// 3. Load or create conversation` comment at line 96):

```ts
        // Extract the campaign code from the ad's pre-filled message and
        // normalize the vehicle URL (strip campaign/tracking params) so the
        // lead identity and the autoscar seller lookup stay keyed on the
        // clean vehicle URL.
        const { cleanUrl, campaignCode } = extractCampaign(detectedVehicleUrl, message);
        detectedVehicleUrl = cleanUrl;
        if (campaignCode) {
          console.log(JSON.stringify({
            level: 'info',
            msg: '[worker] campaign code detected',
            campaignCode,
          }));
        }
```

- [ ] **Step 3: Persist the code first-touch after the lead is loaded/created**

Insert immediately after the `pushName` persistence block (after line 108, before the `// 4. Check if agent responds` comment):

```ts
        // Persist the campaign code on first touch only — the code appears
        // only in the first message, and the notification runs ~3 min later
        // in another worker, so it must live on the lead.
        if (campaignCode && conversation.lead && !conversation.lead.campaignCode) {
          await prisma.lead.update({
            where: { id: conversation.lead.id },
            data: { campaignCode },
          }).catch(() => { /* non-critical */ });
          conversation.lead.campaignCode = campaignCode;
        }
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS. (Confirms `extractCampaign` import resolves, `detectedVehicleUrl` is reassignable, and `conversation.lead.campaignCode` exists on the Prisma type.)

- [ ] **Step 5: Commit**

```bash
git add src/queue/workers/message.worker.ts
git commit -m "feat: tag leads with campaign code and normalize vehicle URL in worker"
```

---

### Task 4: Show the campaign code in the group notification

**Files:**
- Modify: `src/crm/seller-notification.service.ts:243-262` (`buildLeadSummary`)

**Interfaces:**
- Consumes: `lead.campaignCode` (Task 1), already loaded by the existing `findUnique` at line 220 (scalar fields are included automatically).
- Produces: one extra line `📢 Campanha: <code>` in the group summary when a code is present.

- [ ] **Step 1: Add the conditional line**

In `buildLeadSummary`, right after the vehicle line (line 261, `lines.push(\`🚗 Veículo: ...\`)`), add:

```ts
  if (lead.campaignCode) {
    lines.push(`📢 Campanha: ${lead.campaignCode}`);
  }
```

(`📢` intentionally differs from the header's `📣` on line 246.)

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS. `lead.campaignCode` is a known scalar on the `findUnique` result.

- [ ] **Step 3: Commit**

```bash
git add src/crm/seller-notification.service.ts
git commit -m "feat: show campaign code in seller group notification"
```

---

### Task 5: Full-build verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Re-run the parser assertions**

Run: `npx tsx scripts/test-campaign.ts`
Expected: PASS — `campaign parse: all assertions passed`.

- [ ] **Step 3: Manual smoke reasoning (documented, no code)**

Confirm by re-reading the diff that:
- A message with `…/carros/x?camp=ABC` creates the lead with `vehicleUrl = https://autoscar.com.br/carros/x` (no `?camp`) and `campaignCode = ABC`.
- The same vehicle without a code resolves to the identical `vehicleUrl` (no duplicate lead).
- The group summary shows `📢 Campanha: ABC`; a lead with no code shows no such line and behaves exactly as before.

---

## Rollout notes (post-merge, not a code task)

- Apply the migration to production: `npx prisma migrate deploy` (or run the `ALTER TABLE` SQL from Task 1, consistent with how `scripts/add-seller-email-mappings.sql` is applied).
- Build each Shorts ad's Click-to-WhatsApp link so the pre-filled message contains the vehicle URL with `?camp=<CODE>` (one distinct code per campaign, e.g. per dealer/vehicle). If the ad tooling forces a different param name than `camp`, change the single reference in `src/whatsapp/campaign.ts` (`searchParams.get('camp')` and the `TRACKING_PARAMS` list).
