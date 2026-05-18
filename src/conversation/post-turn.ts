import prisma from '../db/prisma.js';
import { emitLeadMoved } from '../realtime/emitter.js';
import { notifySellersGroupForLead } from '../crm/seller-notification.service.js';

/**
 * Deterministic post-turn enforcement — shared by the WhatsApp message worker
 * and the web chat (/atendimento) so both channels qualify + notify the
 * sellers group identically. Never trust the LLM to qualify or notify.
 *
 *  - If the lead is fully filled (name + vehicle) and still in Novo/Em
 *    Qualificacao, auto-move to Qualificado so the LLM can't forget.
 *  - If the lead is in a terminal stage (Qualificado / Desqualificado) and has
 *    not been notified yet, fire the sellers-group notification with the full
 *    summary including vehicle link + conversation link.
 *  - The agent is NEVER allowed to disqualify: revert + notify if it happens.
 */
export async function runPostTurn(leadId: string | undefined): Promise<void> {
  if (!leadId) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { stage: true },
  });
  if (!lead || !lead.pipelineId) return;

  const stageName = lead.stage?.name?.toLowerCase() ?? '';
  const isDisqualified = stageName.includes('desqualificado');
  const isQualified = stageName.includes('qualificado') && !isDisqualified;
  const inPreQualStage =
    stageName === 'novo' ||
    stageName === 'new' ||
    stageName.includes('em qualifica');

  // HARD RULE: only act when we have BOTH name AND a usable phone. Without
  // them the lead is NOT qualified and NOT forwarded to the seller — nothing
  // is written. (On WhatsApp `phone` is the real number; on the web chat it's
  // a web:<uuid> session key, so the collected `contactPhone` is required.)
  const hasUsablePhone = !!(
    lead.contactPhone?.trim() ||
    (lead.phone && !lead.phone.startsWith('web:'))
  );
  const canForward = !!(lead.name?.trim() && hasUsablePhone);
  if (!canForward) return;

  // Safeguard: agent is NEVER allowed to disqualify. Revert to Qualificado.
  if (isDisqualified) {
    const qualifiedStage = await prisma.stage.findFirst({
      where: {
        pipelineId: lead.pipelineId,
        name: { contains: 'qualificado', mode: 'insensitive', not: { contains: 'des' } },
      },
    });
    if (qualifiedStage) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stageId: qualifiedStage.id } });
      emitLeadMoved({ id: lead.id, stageId: qualifiedStage.id });
      await notifySellersGroupForLead(lead.id).catch(() => {});
    }
    return;
  }

  // Name + phone present → move to Qualificado and forward to the seller.
  if (inPreQualStage) {
    const qualifiedStage = await prisma.stage.findFirst({
      where: {
        pipelineId: lead.pipelineId,
        name: { contains: 'qualificado', mode: 'insensitive', not: { contains: 'des' } },
      },
    });
    if (qualifiedStage && qualifiedStage.id !== lead.stageId) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stageId: qualifiedStage.id } });
      emitLeadMoved({ id: lead.id, stageId: qualifiedStage.id });
      await notifySellersGroupForLead(lead.id).catch(() => {});
      return;
    }
  }

  // Notify on first entry into Qualificado stage (if agent moved it there)
  if (isQualified && !lead.sellerNotifiedAt) {
    await notifySellersGroupForLead(lead.id).catch(() => {});
  }
}
