import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || '';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || '';

export interface SOSEmailParams {
  toName:       string;
  toEmail:      string;
  fromName:     string;
  trackingUrl:  string;
  timestamp:    string;
  priorityLevel: number;
}

export const emailService = {
  isConfigured(): boolean {
    return !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
  },

  async sendSOSAlert(params: SOSEmailParams): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[EmailJS] Not configured — skipping email. Add VITE_EMAILJS_* env vars.');
      return false;
    }
    try {
      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          to_name:        params.toName,
          to_email:       params.toEmail,
          from_name:      params.fromName,
          tracking_url:   params.trackingUrl,
          timestamp:      params.timestamp,
          priority_level: `Priority ${params.priorityLevel}`,
        },
        PUBLIC_KEY
      );
      console.log(`[EmailJS] Alert sent to ${params.toEmail}`);
      return true;
    } catch (error) {
      console.error('[EmailJS] Send failed:', error);
      return false;
    }
  },
};
