import prisma from '../db/prisma.js';
import { emitLeadMoved } from '../realtime/emitter.js';
import { scheduleSellerNotification } from '../crm/seller-notification.service.js';

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
  console.log(JSON.stringify({
    level: 'info',
    msg: '[post-turn] START',
    leadId,
  }));

  if (!leadId) {
    console.log(JSON.stringify({ level: 'info', msg: '[post-turn] No leadId, exiting' }));
    return;
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { stage: true },
  });
  if (!lead || !lead.pipelineId) {
    console.log(JSON.stringify({ level: 'info', msg: '[post-turn] Lead not found', leadId }));
    return;
  }

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
  const hasVehicle = !!lead.vehicleUrl?.trim();
  const canForward = !!(lead.name?.trim() && hasUsablePhone);

  console.log(JSON.stringify({
    level: 'info',
    msg: '[post-turn] Lead state',
    leadId,
    stageName,
    isDisqualified,
    isQualified,
    inPreQualStage,
    hasUsablePhone,
    hasVehicle,
    canForward,
    hasName: !!lead.name?.trim(),
    phone: lead.phone,
    contactPhone: lead.contactPhone,
    sellerNotifiedAt: lead.sellerNotifiedAt,
  }));

  if (!canForward) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[post-turn] Cannot forward - missing name or phone',
      leadId,
    }));
    return;
  }

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
      await scheduleSellerNotification(lead.id, { reason: 'disqualified-reverted' }).catch(() => {});
    }
    return;
  }

  // Name + phone present → move to Qualificado and forward to the seller.
  if (inPreQualStage) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[post-turn] In pre-qual stage, looking for Qualificado',
      leadId,
    }));
    const qualifiedStage = await prisma.stage.findFirst({
      where: {
        pipelineId: lead.pipelineId,
        name: { contains: 'qualificado', mode: 'insensitive', not: { contains: 'des' } },
      },
    });
    console.log(JSON.stringify({
      level: 'info',
      msg: '[post-turn] Qualificado stage lookup',
      leadId,
      qualifiedStageId: qualifiedStage?.id,
      qualifiedStageName: qualifiedStage?.name,
      currentStageId: lead.stageId,
      willMove: qualifiedStage && qualifiedStage.id !== lead.stageId,
    }));
    if (qualifiedStage && qualifiedStage.id !== lead.stageId) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stageId: qualifiedStage.id } });
      emitLeadMoved({ id: lead.id, stageId: qualifiedStage.id });
      console.log(JSON.stringify({
        level: 'info',
        msg: '[post-turn] Moved to Qualificado, scheduling seller notification',
        leadId,
      }));
      const result = await scheduleSellerNotification(lead.id, { reason: 'qualified' }).catch((err: Error) => {
        console.log(JSON.stringify({
          level: 'error',
          msg: '[post-turn] scheduleSellerNotification failed',
          leadId,
          error: err.message,
        }));
        return { scheduled: false, reason: 'exception' };
      });
      console.log(JSON.stringify({
        level: 'info',
        msg: '[post-turn] scheduleSellerNotification result',
        leadId,
        result,
      }));
      return;
    }
  }

  // Notify on first entry into Qualificado stage (if agent moved it there)
  if (isQualified && !lead.sellerNotifiedAt) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[post-turn] Already qualified but not notified, scheduling seller notification',
      leadId,
    }));
    const result = await scheduleSellerNotification(lead.id, { reason: 'qualified-first-entry' }).catch((err: Error) => {
      console.log(JSON.stringify({
        level: 'error',
        msg: '[post-turn] scheduleSellerNotification failed',
        leadId,
        error: err.message,
      }));
      return { scheduled: false, reason: 'exception' };
    });
    console.log(JSON.stringify({
      level: 'info',
      msg: '[post-turn] scheduleSellerNotification result',
      leadId,
      result,
    }));
  } else if (isQualified && lead.sellerNotifiedAt) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[post-turn] Already notified, skipping',
      leadId,
      sellerNotifiedAt: lead.sellerNotifiedAt,
    }));
  } else {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[post-turn] Not in qualifying conditions',
      leadId,
      isQualified,
      sellerNotifiedAt: lead.sellerNotifiedAt,
    }));
  }
}
