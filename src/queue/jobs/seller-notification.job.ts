export interface SellerNotificationJobData {
  leadId: string;
  vehicleUrl: string | null;
  reason?: string;
}

export const SELLER_NOTIFICATION_DELAY_MS = 3 * 60 * 1000; // 3 minutes
