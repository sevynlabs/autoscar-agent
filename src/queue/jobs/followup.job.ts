export interface FollowupJobData {
  leadId: string | null;
  instance: string;
  phoneNumber: string;
  followupNumber: number; // 1 = first followup, 2 = second, then stop
}
