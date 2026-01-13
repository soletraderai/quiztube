import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Initialize Resend client (production) or nodemailer (development fallback)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Fallback nodemailer transporter for development (Mailhog)
const createFallbackTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: false,
    ignoreTLS: true,
  });
};

const fallbackTransporter = !resend ? createFallbackTransporter() : null;

const fromAddress = process.env.EMAIL_FROM || 'Teachy <noreply@teachy.app>';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

// Generate unsubscribe token from user ID (simple hash)
function generateUnsubscribeToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'teachy-secret';
  return crypto.createHmac('sha256', secret).update(userId).digest('hex').slice(0, 32);
}

// Email sending result type
interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// Unified email sending function
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>
): Promise<EmailResult> {
  try {
    if (resend) {
      // Production: Use Resend
      const result = await resend.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
        headers,
      });

      if (result.error) {
        console.error('[Email] Resend error:', result.error);
        return { success: false, error: result.error.message };
      }

      return { success: true, id: result.data?.id };
    } else if (fallbackTransporter) {
      // Development: Use Mailhog
      const result = await fallbackTransporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        headers,
      });

      return { success: true, id: result.messageId };
    } else {
      console.error('[Email] No email provider configured');
      return { success: false, error: 'No email provider configured' };
    }
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Shared email template styles
const emailStyles = `
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .header { text-align: center; margin-bottom: 32px; }
  .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
  .content { background: #fff; border: 3px solid #000; padding: 32px; box-shadow: 4px 4px 0 #000; }
  .button { display: inline-block; background: #FFDE59; color: #1a1a1a; padding: 16px 32px; text-decoration: none; font-weight: bold; border: 3px solid #000; box-shadow: 4px 4px 0 #000; margin: 24px 0; }
  .button:hover { box-shadow: 6px 6px 0 #000; }
  .footer { text-align: center; margin-top: 32px; color: #666; font-size: 14px; }
  .footer a { color: #666; }
  .stats { margin: 24px 0; text-align: center; }
  .stat { display: inline-block; padding: 16px 24px; }
  .stat-value { font-size: 32px; font-weight: bold; color: #1a1a1a; }
  .stat-label { color: #666; font-size: 14px; }
  .topic { background: #FFDE59; display: inline-block; padding: 4px 12px; font-size: 14px; font-weight: bold; margin-bottom: 16px; }
  .question { font-size: 18px; margin: 24px 0; }
  .instructions { background: #f5f5f5; padding: 16px; margin: 24px 0; border-left: 4px solid #000; }
`;

function wrapInTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${emailStyles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Teachy</div>
          </div>
          ${content}
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Teachy. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export const sendVerificationEmail = async (email: string, token: string): Promise<EmailResult> => {
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

  const html = wrapInTemplate(`
    <div class="content">
      <h1>Verify your email</h1>
      <p>Thanks for signing up! Please verify your email address by clicking the button below.</p>
      <a href="${verificationUrl}" class="button">Verify Email</a>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>This link will expire in 24 hours.</p>
    </div>
  `);

  return sendEmail(email, 'Verify your Teachy email', html);
};

export const sendPasswordResetEmail = async (email: string, token: string): Promise<EmailResult> => {
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  const html = wrapInTemplate(`
    <div class="content">
      <h1>Reset your password</h1>
      <p>We received a request to reset your password. Click the button below to choose a new password.</p>
      <a href="${resetUrl}" class="button">Reset Password</a>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    </div>
  `);

  return sendEmail(email, 'Reset your Teachy password', html);
};

export const sendWeeklySummaryEmail = async (
  email: string,
  displayName: string,
  stats: {
    sessionsCompleted: number;
    timeSpentMinutes: number;
    topicsCovered: number;
    recommendations: string[];
  }
): Promise<EmailResult> => {
  const html = wrapInTemplate(`
    <div class="content">
      <h1>Hi ${displayName}, here's your weekly summary</h1>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${stats.sessionsCompleted}</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat">
          <div class="stat-value">${Math.round(stats.timeSpentMinutes)}</div>
          <div class="stat-label">Minutes</div>
        </div>
        <div class="stat">
          <div class="stat-value">${stats.topicsCovered}</div>
          <div class="stat-label">Topics</div>
        </div>
      </div>

      ${stats.recommendations.length > 0 ? `
        <h2>Recommended Next Steps</h2>
        <ul>
          ${stats.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      ` : ''}

      <a href="${frontendUrl}/dashboard" class="button">Continue Learning</a>
    </div>
    <div class="footer">
      <p><a href="${frontendUrl}/settings">Manage email preferences</a></p>
    </div>
  `);

  return sendEmail(email, 'Your Teachy Weekly Summary', html);
};

export const sendEmailPrompt = async (
  email: string,
  displayName: string,
  topicName: string,
  question: string,
  promptId: string,
  userId: string
): Promise<EmailResult> => {
  const unsubscribeToken = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `${frontendUrl}/unsubscribe?userId=${userId}&token=${unsubscribeToken}`;

  const html = wrapInTemplate(`
    <div class="content">
      <span class="topic">${topicName}</span>
      <p class="question">${question}</p>

      <div class="instructions">
        <strong>How to answer:</strong>
        <p>Just reply to this email with your answer.</p>
        <p>Reply "skip" to skip this question.</p>
      </div>
    </div>
    <div class="footer">
      <p><a href="${frontendUrl}/settings">Manage email prompts</a> | <a href="${unsubscribeUrl}">Unsubscribe</a></p>
    </div>
  `);

  return sendEmail(
    email,
    `Quick question: ${topicName}`,
    html,
    { 'X-Teachy-Prompt-Id': promptId }
  );
};

// Send feedback email after user responds to a prompt
export const sendPromptFeedbackEmail = async (
  email: string,
  displayName: string,
  topicName: string,
  originalQuestion: string,
  userAnswer: string,
  isCorrect: boolean,
  feedback: string,
  userId: string
): Promise<EmailResult> => {
  const unsubscribeToken = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `${frontendUrl}/unsubscribe?userId=${userId}&token=${unsubscribeToken}`;

  const html = wrapInTemplate(`
    <div class="content">
      <span class="topic">${topicName}</span>
      <h2>${isCorrect ? '✓ Correct!' : '✗ Not quite'}</h2>

      <div style="background: #f5f5f5; padding: 16px; margin: 16px 0; border-left: 4px solid ${isCorrect ? '#22c55e' : '#ef4444'};">
        <strong>Question:</strong>
        <p>${originalQuestion}</p>
        <strong>Your answer:</strong>
        <p>${userAnswer}</p>
      </div>

      <div style="margin: 24px 0;">
        <strong>Feedback:</strong>
        <p>${feedback}</p>
      </div>

      <a href="${frontendUrl}/dashboard" class="button">Continue Learning</a>
    </div>
    <div class="footer">
      <p><a href="${frontendUrl}/settings">Manage email prompts</a> | <a href="${unsubscribeUrl}">Unsubscribe</a></p>
    </div>
  `);

  return sendEmail(email, `Feedback: ${topicName}`, html);
};

// Validate unsubscribe token
export function validateUnsubscribeToken(userId: string, token: string): boolean {
  const expectedToken = generateUnsubscribeToken(userId);
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  );
}
