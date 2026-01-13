import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';
import { prisma } from '../index.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Create email transporter
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
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

const router = Router();

// Only initialize Stripe if a real key is provided
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey && stripeKey !== 'sk_test_placeholder'
  ? new Stripe(stripeKey)
  : null;

// Stripe webhook - needs raw body
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe is not configured' });
      }

      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !webhookSecret) {
        return res.status(400).json({ error: 'Missing signature or webhook secret' });
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.status(400).json({ error: 'Invalid signature' });
      }

      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;

          if (userId && session.subscription) {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );

            await prisma.subscription.update({
              where: { userId },
              data: {
                tier: 'PRO',
                status: 'ACTIVE',
                stripeSubscriptionId: stripeSubscription.id,
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
              },
            });
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const dbSubscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
          });

          if (dbSubscription) {
            await prisma.subscription.update({
              where: { id: dbSubscription.id },
              data: {
                status: subscription.status === 'active' ? 'ACTIVE' :
                        subscription.status === 'past_due' ? 'PAST_DUE' :
                        subscription.status === 'canceled' ? 'CANCELLED' : 'ACTIVE',
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              },
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const dbSubscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
          });

          if (dbSubscription) {
            await prisma.subscription.update({
              where: { id: dbSubscription.id },
              data: {
                tier: 'FREE',
                status: 'CANCELLED',
                stripeSubscriptionId: null,
                currentPeriodStart: null,
                currentPeriodEnd: null,
              },
            });
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = invoice.subscription as string;

          if (subscriptionId) {
            const dbSubscription = await prisma.subscription.findFirst({
              where: { stripeSubscriptionId: subscriptionId },
            });

            if (dbSubscription) {
              await prisma.subscription.update({
                where: { id: dbSubscription.id },
                data: { status: 'PAST_DUE' },
              });
            }
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

// Email inbound webhook (Resend)
router.post('/email-inbound', express.json(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, subject, text, headers } = req.body;

    // Extract prompt ID from headers or subject
    const promptId = headers?.['x-teachy-prompt-id'];

    if (!promptId) {
      console.log('Email received without prompt ID, ignoring');
      return res.json({ received: true });
    }

    // Detect out-of-office replies
    const outOfOfficePatterns = [
      /out of office/i,
      /auto-reply/i,
      /automatic reply/i,
      /vacation/i,
      /away from/i,
    ];

    const isAutoReply = outOfOfficePatterns.some(pattern =>
      pattern.test(subject) || pattern.test(text)
    );

    if (isAutoReply) {
      console.log('Out of office reply detected, ignoring');
      return res.json({ received: true });
    }

    // Find the email prompt
    const emailPrompt = await prisma.emailPrompt.findUnique({
      where: { id: promptId },
      include: { user: true, topic: true },
    });

    if (!emailPrompt) {
      console.log('Email prompt not found:', promptId);
      return res.json({ received: true });
    }

    // Check if user wants to skip
    const isSkip = /^skip$/i.test(text.trim());

    if (isSkip) {
      await prisma.emailPrompt.update({
        where: { id: promptId },
        data: {
          repliedAt: new Date(),
          userResponse: 'SKIPPED',
        },
      });
      return res.json({ received: true });
    }

    // Evaluate the answer using AI
    let isCorrect = false;
    let feedback = 'Your answer has been recorded.';

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `Evaluate this answer and provide feedback:

Question: ${emailPrompt.questionText}
Expected concepts: ${emailPrompt.correctAnswer}
User's Answer: ${text.trim()}

Respond in JSON format:
{
  "isCorrect": true or false (true if the answer demonstrates understanding of the key concepts),
  "feedback": "Brief, encouraging feedback (2-3 sentences)"
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        isCorrect = parsed.isCorrect === true;
        feedback = parsed.feedback || feedback;
      }
    } catch (aiError) {
      console.error('AI evaluation failed:', aiError);
      // Fallback: mark as correct if answer is substantial
      isCorrect = text.trim().length > 20;
      feedback = 'Thanks for your answer! Keep practicing to reinforce your understanding.';
    }

    await prisma.emailPrompt.update({
      where: { id: promptId },
      data: {
        repliedAt: new Date(),
        userResponse: text.trim(),
        isCorrect,
        feedbackSentAt: new Date(),
      },
    });

    // Log activity towards daily commitment
    // Estimate 2 minutes for answering an email prompt
    const userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: emailPrompt.user.id },
    });
    const userTimezone = userPreferences?.timezone || 'America/New_York';

    // Get today in user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const localDateStr = formatter.format(now);
    const [year, month, day] = localDateStr.split('-').map(Number);
    const today = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    const targetMinutes = userPreferences?.dailyCommitmentMinutes || 15;

    const dailyRecord = await prisma.dailyRecord.upsert({
      where: {
        userId_date: {
          userId: emailPrompt.user.id,
          date: today,
        },
      },
      update: {
        timeSpentMinutes: { increment: 2 }, // 2 minutes for answering email
        questionsAnswered: { increment: 1 },
      },
      create: {
        userId: emailPrompt.user.id,
        date: today,
        timeSpentMinutes: 2,
        questionsAnswered: 1,
        sessionsCompleted: 0,
      },
    });

    // Update commitment status if met
    const commitmentMet = dailyRecord.timeSpentMinutes >= targetMinutes;
    if (commitmentMet !== dailyRecord.commitmentMet) {
      await prisma.dailyRecord.update({
        where: { id: dailyRecord.id },
        data: { commitmentMet },
      });
    }

    // Send feedback email
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: emailPrompt.user.email,
        subject: `Feedback: ${emailPrompt.topic.name}`,
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
                .result { padding: 16px; margin-bottom: 16px; border: 2px solid #000; }
                .correct { background: #d4edda; }
                .incorrect { background: #fff3cd; }
                .topic { background: #FFDE59; display: inline-block; padding: 4px 12px; font-size: 14px; font-weight: bold; margin-bottom: 16px; }
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
                  <span class="topic">${emailPrompt.topic.name}</span>

                  <div class="result ${isCorrect ? 'correct' : 'incorrect'}">
                    <strong>${isCorrect ? '✓ Great answer!' : '○ Keep practicing!'}</strong>
                  </div>

                  <h3>Question</h3>
                  <p>${emailPrompt.questionText}</p>

                  <h3>Your Answer</h3>
                  <p>${text.trim()}</p>

                  <h3>Feedback</h3>
                  <p>${feedback}</p>

                  <a href="${frontendUrl}/review" class="button">Continue Learning</a>
                </div>
                <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Teachy. All rights reserved.</p>
                  <p><a href="${frontendUrl}/settings">Manage email prompts</a></p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send feedback email:', emailError);
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

export default router;
