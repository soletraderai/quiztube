import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Generate unsubscribe token from user ID (simple hash)
function generateUnsubscribeToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'teachy-secret';
  return crypto.createHmac('sha256', secret).update(userId).digest('hex').slice(0, 32);
}

// Create transporter based on environment
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: Use Resend or other provider
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Development: Use Mailhog
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: false,
    ignoreTLS: true,
  });
};

const transporter = createTransporter();

const fromAddress = process.env.EMAIL_FROM || 'Teachy <noreply@teachy.app>';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: 'Verify your Teachy email',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a1a; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
            .content { background: #fff; border: 3px solid #000; padding: 32px; box-shadow: 4px 4px 0 #000; }
            .button { display: inline-block; background: #FFDE59; color: #1a1a1a; padding: 16px 32px; text-decoration: none; font-weight: bold; border: 3px solid #000; box-shadow: 4px 4px 0 #000; margin: 24px 0; }
            .button:hover { box-shadow: 6px 6px 0 #000; }
            .footer { text-align: center; margin-top: 32px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Teachy</div>
            </div>
            <div class="content">
              <h1>Verify your email</h1>
              <p>Thanks for signing up! Please verify your email address by clicking the button below.</p>
              <a href="${verificationUrl}" class="button">Verify Email</a>
              <p>If you didn't create an account, you can safely ignore this email.</p>
              <p>This link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Teachy. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: 'Reset your Teachy password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a1a; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
            .content { background: #fff; border: 3px solid #000; padding: 32px; box-shadow: 4px 4px 0 #000; }
            .button { display: inline-block; background: #FFDE59; color: #1a1a1a; padding: 16px 32px; text-decoration: none; font-weight: bold; border: 3px solid #000; box-shadow: 4px 4px 0 #000; margin: 24px 0; }
            .footer { text-align: center; margin-top: 32px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Teachy</div>
            </div>
            <div class="content">
              <h1>Reset your password</h1>
              <p>We received a request to reset your password. Click the button below to choose a new password.</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>If you didn't request a password reset, you can safely ignore this email.</p>
              <p>This link will expire in 1 hour.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Teachy. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
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
) => {
  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: 'Your Teachy Weekly Summary',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a1a; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
            .content { background: #fff; border: 3px solid #000; padding: 32px; box-shadow: 4px 4px 0 #000; }
            .stats { display: flex; justify-content: space-around; margin: 24px 0; text-align: center; }
            .stat { padding: 16px; }
            .stat-value { font-size: 32px; font-weight: bold; color: #1a1a1a; }
            .stat-label { color: #666; font-size: 14px; }
            .button { display: inline-block; background: #FFDE59; color: #1a1a1a; padding: 16px 32px; text-decoration: none; font-weight: bold; border: 3px solid #000; box-shadow: 4px 4px 0 #000; margin: 24px 0; }
            .footer { text-align: center; margin-top: 32px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Teachy</div>
            </div>
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
              <p>&copy; ${new Date().getFullYear()} Teachy. All rights reserved.</p>
              <p><a href="${frontendUrl}/settings">Manage email preferences</a></p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
};

export const sendEmailPrompt = async (
  email: string,
  displayName: string,
  topicName: string,
  question: string,
  promptId: string,
  userId: string
) => {
  const unsubscribeToken = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `${frontendUrl}/unsubscribe?userId=${userId}&token=${unsubscribeToken}`;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: `Quick question: ${topicName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a1a; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
            .content { background: #fff; border: 3px solid #000; padding: 32px; box-shadow: 4px 4px 0 #000; }
            .topic { background: #FFDE59; display: inline-block; padding: 4px 12px; font-size: 14px; font-weight: bold; margin-bottom: 16px; }
            .question { font-size: 18px; margin: 24px 0; }
            .instructions { background: #f5f5f5; padding: 16px; margin: 24px 0; border-left: 4px solid #000; }
            .footer { text-align: center; margin-top: 32px; color: #666; font-size: 14px; }
            .footer a { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Teachy</div>
            </div>
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
              <p>&copy; ${new Date().getFullYear()} Teachy. All rights reserved.</p>
              <p><a href="${frontendUrl}/settings">Manage email prompts</a> | <a href="${unsubscribeUrl}">Unsubscribe</a></p>
            </div>
          </div>
        </body>
      </html>
    `,
    headers: {
      'X-Teachy-Prompt-Id': promptId,
    },
  });
};
