/**
 * Email Notification Service - extracted from webhooks.ts
 * Handles email notifications for webhook events
 */

import { log } from '../../../lib/logger';
import {
  sendSubscriptionConfirmationEmail,
  sendPaymentFailedEmail
} from '../../../services/email/emailService';

export class EmailNotificationService {
  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmation(
    userId: string,
    email: string,
    subscriptionDetails: any
  ): Promise<void> {
    try {
      await sendSubscriptionConfirmationEmail(userId, email, subscriptionDetails);
    } catch (err) {
      log.error({ err, userId }, 'Failed to send subscription confirmation email');
    }
  }

  /**
   * Send payment failed notification email
   */
  async sendPaymentFailedNotification(
    userId: string,
    email: string,
    paymentDetails: any
  ): Promise<void> {
    try {
      await sendPaymentFailedEmail(userId, email, paymentDetails);
    } catch (err) {
      log.error({ err, userId }, 'Failed to send payment failed email');
    }
  }
}