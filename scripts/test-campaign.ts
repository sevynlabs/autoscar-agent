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
