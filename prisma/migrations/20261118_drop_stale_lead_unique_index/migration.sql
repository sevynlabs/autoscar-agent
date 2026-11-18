-- 20260626_change_lead_unique_constraint tried to remove the old
-- (phone, pipelineId) uniqueness with DROP CONSTRAINT, but it was created as a
-- UNIQUE INDEX in 20260318044552_add_crm_models, so the drop was a no-op and
-- databases built from migrations kept rejecting the same phone on a second
-- vehicle. Drop the index itself; IF EXISTS keeps it safe where `db push`
-- already removed it.
DROP INDEX IF EXISTS "Lead_phone_pipelineId_key";
