// Normalizes an incoming WhatsApp message (Meta Cloud API or Evolution) into
// the text the agent should read, plus the click-to-WhatsApp ad referral when
// the message came from a Meta ad. Pure — no DB, no network.

/** Click-to-WhatsApp ad that opened the chat (Meta "referral"). */
export interface AdReferral {
  sourceId: string | null; // ad id
  sourceType: string | null; // "ad" | "post"
  sourceUrl: string | null;
  headline: string | null;
  ctwaClid: string | null; // Meta click id, unique per ad click
}

export interface ParsedInbound {
  /** Message type as reported by the provider (text, button, audio, ...). */
  type: string;
  /** Text handed to the agent, or null when the message must be skipped. */
  text: string | null;
  /** Why the message is skipped (only when text is null). */
  skipReason?: string;
  referral: AdReferral | null;
}

// Messages that are not part of a conversation: never answer them.
const IGNORED_TYPES = new Set(['reaction', 'system', 'ephemeral', 'protocol', 'request_welcome']);

const MEDIA_LABELS: Record<string, string> = {
  audio: 'um áudio',
  voice: 'um áudio',
  image: 'uma imagem',
  video: 'um vídeo',
  document: 'um documento',
  sticker: 'uma figurinha',
  location: 'uma localização',
  contacts: 'um contato',
  unsupported: 'uma mensagem que não conseguimos ler',
};

/**
 * Text the agent receives for a media message it cannot read, so the lead
 * still gets an answer instead of silence. A caption, when present, is kept.
 */
export function mediaPlaceholder(type: string, caption?: string | null): string {
  const label = MEDIA_LABELS[type] ?? 'uma mensagem que não é texto';
  const note = `[O cliente enviou ${label}. Você não consegue ver/ouvir o conteúdo; peça com gentileza que ele escreva a mensagem.]`;
  const cleanCaption = caption?.trim();
  return cleanCaption ? `${cleanCaption}\n${note}` : note;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildReferral(raw: any, fields: {
  sourceId: unknown; sourceType: unknown; sourceUrl: unknown; headline: unknown; ctwaClid: unknown;
}): AdReferral | null {
  if (!raw) return null;
  const referral: AdReferral = {
    sourceId: str(fields.sourceId),
    sourceType: str(fields.sourceType),
    sourceUrl: str(fields.sourceUrl),
    headline: str(fields.headline),
    ctwaClid: str(fields.ctwaClid),
  };
  return Object.values(referral).some(Boolean) ? referral : null;
}

// ---------------------------------------------------------------- Cloud API

/** Parse one entry of `value.messages[]` from a Cloud API webhook. */
export function parseCloudApiMessage(msg: any): ParsedInbound {
  const type: string = msg?.type ?? 'unknown';
  const r = msg?.referral;
  const referral = buildReferral(r, {
    sourceId: r?.source_id,
    sourceType: r?.source_type,
    sourceUrl: r?.source_url,
    headline: r?.headline,
    ctwaClid: r?.ctwa_clid,
  });

  if (IGNORED_TYPES.has(type)) return { type, text: null, skipReason: `ignored type ${type}`, referral };

  let text: string | null = null;
  switch (type) {
    case 'text':
      text = str(msg.text?.body);
      break;
    case 'button': // quick-reply button of a template / ad welcome message
      text = str(msg.button?.text) ?? str(msg.button?.payload);
      break;
    case 'interactive':
      text =
        str(msg.interactive?.button_reply?.title) ??
        str(msg.interactive?.list_reply?.title) ??
        str(msg.interactive?.nfm_reply?.body);
      break;
    case 'image':
    case 'video':
    case 'document':
      text = mediaPlaceholder(type, msg[type]?.caption);
      break;
    default:
      text = mediaPlaceholder(type);
  }

  return text
    ? { type, text, referral }
    : { type, text: null, skipReason: 'empty content', referral };
}

// ---------------------------------------------------------------- Evolution

/** Parse one item of a `messages.upsert` event from Evolution API v2. */
export function parseEvolutionMessage(item: any): ParsedInbound {
  const m = item?.message ?? {};
  const keys = Object.keys(m).filter((k) => k !== 'messageContextInfo');
  const rawType: string = item?.messageType ?? keys[0] ?? 'unknown';

  // externalAdReply sits in the contextInfo of whatever message type carried it.
  const contextInfo =
    item?.contextInfo ??
    m.extendedTextMessage?.contextInfo ??
    keys.map((k) => m[k]?.contextInfo).find(Boolean);
  const ad = contextInfo?.externalAdReply;
  const referral = buildReferral(ad, {
    sourceId: ad?.sourceId,
    sourceType: ad?.sourceType,
    sourceUrl: ad?.sourceUrl,
    headline: ad?.title,
    ctwaClid: ad?.ctwaClid,
  });

  const type = rawType.replace(/Message$/, '');
  if (IGNORED_TYPES.has(type) || type === 'protocol') {
    return { type, text: null, skipReason: `ignored type ${type}`, referral };
  }

  const text =
    str(m.conversation) ??
    str(m.extendedTextMessage?.text) ??
    str(m.buttonsResponseMessage?.selectedDisplayText) ??
    str(m.templateButtonReplyMessage?.selectedDisplayText) ??
    str(m.listResponseMessage?.title) ??
    str(m.interactiveResponseMessage?.body?.text) ??
    null;
  if (text) return { type, text, referral };

  const mediaType = (
    {
      audioMessage: 'audio',
      pttMessage: 'audio',
      imageMessage: 'image',
      videoMessage: 'video',
      documentMessage: 'document',
      documentWithCaptionMessage: 'document',
      stickerMessage: 'sticker',
      locationMessage: 'location',
      liveLocationMessage: 'location',
      contactMessage: 'contacts',
      contactsArrayMessage: 'contacts',
    } as Record<string, string>
  )[keys.find((k) => k.endsWith('Message')) ?? ''];

  if (mediaType) {
    const caption =
      m.imageMessage?.caption ??
      m.videoMessage?.caption ??
      m.documentMessage?.caption ??
      m.documentWithCaptionMessage?.message?.documentMessage?.caption;
    return { type: mediaType, text: mediaPlaceholder(mediaType, caption), referral };
  }

  return { type, text: null, skipReason: 'empty content', referral };
}
