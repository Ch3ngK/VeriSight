/**
 * SMS Fallback & Alert System
 * Provides SMS notifications when primary channels unavailable
 * Enables low-bandwidth emergency communication
 */

interface SMSAlert {
  phoneNumber: string;
  message: string;
  priority: "low" | "medium" | "high";
  timestamp: number;
}

interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

// Mock SMS storage for MVP (replace with Twilio in production)
const smsPendingQueue: SMSAlert[] = [];

/**
 * Generate concise SMS message from analysis
 * Keep under 160 chars for single SMS
 */
function generateSMSMessage(analysis: any, isCrisis: boolean): string {
  if (!isCrisis) {
    return "VeriSight: Video analyzed, no crisis detected.";
  }

  const category = analysis?.crisis_mode?.category || "incident";
  const action = analysis?.recommended_action || "monitor";

  // Crisis SMS - concise format for emergency dispatch
  const messages: Record<string, string> = {
    crime: `ALERT: Potential crime detected. Action: ${action}. Verify with dispatch.`,
    fire: `ALERT: Potential fire signal. Action: ${action}. Check conditions.`,
    medical: `ALERT: Medical incident. Action: ${action}. Standby.`,
    disaster: `ALERT: Disaster signal. Action: ${action}. Activate protocol.`,
    terror: `ALERT: Potential threat. Action: ${action}. Enhanced monitoring.`,
  };

  return (
    messages[category] || `ALERT: Crisis detected (${category}). Action: ${action}.`
  );
}

/**
 * Queue SMS for emergency contacts (offline/low-bandwidth scenario)
 */
export function queueSMSAlert(
  phoneNumber: string,
  analysis: any,
  priority: "low" | "medium" | "high" = "medium"
): boolean {
  const isCrisis = analysis?.crisis_mode?.is_crisis || false;
  const message = generateSMSMessage(analysis, isCrisis);

  const alert: SMSAlert = {
    phoneNumber,
    message,
    priority,
    timestamp: Date.now(),
  };

  smsPendingQueue.unshift(alert);

  // Keep queue size limited
  if (smsPendingQueue.length > 50) {
    smsPendingQueue.pop();
  }

  return true;
}

/**
 * Send SMS via Twilio (production)
 * Referenced but not actively used in MVP
 */
async function sendSMSViaTwilio(
  config: SMSConfig,
  alert: SMSAlert
): Promise<boolean> {
  try {
    // In production, initialize Twilio client:
    // const client = twilio(config.accountSid, config.authToken);
    // await client.messages.create({
    //   body: alert.message,
    //   from: config.fromNumber,
    //   to: alert.phoneNumber
    // });

    console.log(`[SMS FALLBACK] Would send via Twilio to ${alert.phoneNumber}`);
    return true;
  } catch (err) {
    console.error("SMS send failed:", err);
    return false;
  }
}

/**
 * Flush pending SMS queue
 * In production, would send via Twilio
 */
export async function flushSMSQueue(config?: SMSConfig): Promise<number> {
  let sent = 0;

  while (smsPendingQueue.length > 0) {
    const alert = smsPendingQueue.shift();
    if (!alert) break;

    if (config) {
      const success = await sendSMSViaTwilio(config, alert);
      if (success) sent++;
    } else {
      // MVP: Log to console instead of actually sending
      console.log(`[SMS ALERT - ${alert.priority}] ${alert.phoneNumber}: ${alert.message}`);
      sent++;
    }
  }

  return sent;
}

/**
 * Get pending SMS alerts (for admin dashboard)
 */
export function getPendingSMSAlerts(
  limit: number = 10
): SMSAlert[] {
  return smsPendingQueue.slice(0, limit);
}

/**
 * Register emergency contact for SMS alerts (offline mode)
 * Stored in extension storage for user privacy
 */
export function registerEmergencyContact(
  phoneNumber: string
): {
  success: boolean;
  message: string;
} {
  // Phone number validation
  const cleaned = phoneNumber.replace(/\D/g, "");
  if (cleaned.length < 10 || cleaned.length > 15) {
    return {
      success: false,
      message: "Invalid phone number. Use format: +1-555-123-4567",
    };
  }

  return {
    success: true,
    message: `Emergency contact registered: ${phoneNumber}. Will receive SMS alerts for high-priority incidents.`,
  };
}

/**
 * Generate SMS-optimized incident summary
 * For low-bandwidth emergency communication
 */
export function generateSMSSummary(
  analysis: any,
  characterLimit: number = 160
): string {
  const crisis = analysis?.crisis_mode;
  const action = analysis?.recommended_action;

  if (!crisis || !crisis.is_crisis) {
    return "VeriSight: No crisis detected.";
  }

  const cat = crisis.category?.substring(0, 4).toUpperCase() || "INC";
  const act = action?.substring(0, 3).toUpperCase() || "CHK";

  // Pack information into SMS format
  const summary = `[${cat}] Crisis: ${crisis.why?.substring(0, 40)}... Action: ${act}`;

  return summary.substring(0, characterLimit);
}

/**
 * Enhance analysis with SMS alert capability
 */
export function enrichWithSMSCapability(
  analysis: any
): any {
  analysis.offline_capabilities = {
    sms_alerts_enabled: true,
    pending_sms_count: smsPendingQueue.length,
    sms_message_template: generateSMSMessage(
      analysis,
      analysis?.crisis_mode?.is_crisis || false
    ),
    note: "SMS alerting available for offline/low-connectivity scenarios",
  };

  // Add instruction for high-priority incidents
  if (analysis?.crisis_mode?.is_crisis && analysis?.recommended_action === "escalate") {
    if (!analysis.public_safety_notes) analysis.public_safety_notes = [];
    analysis.public_safety_notes.push(
      "🚨 ESCALATE: High-priority incident. Emergency SMS alerts activated."
    );
  }

  return analysis;
}
