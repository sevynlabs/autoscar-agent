export interface FollowupWorkflowJobData {
  type: 'scan'; // cron triggers a scan of all leads in follow-up stage
}

export interface FollowupLeadJobData {
  type: 'send';
  leadId: string;
  instance: string;
  phoneNumber: string;
  attemptNumber: number;
  vehicleInfo?: string;
}
