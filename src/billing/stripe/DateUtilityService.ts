/**
 * Date Utility Service - extracted from stripe.ts
 * Handles date/time conversions and calculations for Stripe
 */

export class DateUtilityService {
  /**
   * Convert Unix timestamp to ISO date string
   */
  toDateTime(secs: number): string {
    const date = new Date(secs * 1000);
    return date.toISOString();
  }

  /**
   * Calculate trial end date for Stripe
   */
  getTrialEnd(trialDays: number): number | null {
    if (!trialDays || trialDays <= 0) return null;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    return Math.floor(trialEnd.getTime() / 1000); // Convert to Unix timestamp
  }
}