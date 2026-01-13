import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../index.js';
import { sendPromptFeedbackEmail } from '../services/email.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

            // Check if subscription is in trial period
            const isTrialing = stripeSubscription.status === 'trialing';
            const trialEnd = stripeSubscription.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null;

            await prisma.subscription.upsert({
              where: { userId },
              create: {
                userId,
                tier: 'PRO',
                status: isTrialing ? 'TRIALING' : 'ACTIVE',
                stripeSubscriptionId: stripeSubscription.id,
                stripeCustomerId: stripeSubscription.customer as string,
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: trialEnd || new Date(stripeSubscription.current_period_end * 1000),
              },
              update: {
                tier: 'PRO',
                status: isTrialing ? 'TRIALING' : 'ACTIVE',
                stripeSubscriptionId: stripeSubscription.id,
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: trialEnd || new Date(stripeSubscription.current_period_end * 1000),
              },
            });

            console.log(`[Stripe] Checkout completed for user ${userId}, trialing: ${isTrialing}`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const dbSubscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
          });

          if (dbSubscription) {
            // Map Stripe status to our status enum
            let status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING';
            switch (subscription.status) {
              case 'trialing':
                status = 'TRIALING';
                break;
              case 'active':
                status = 'ACTIVE';
                break;
              case 'past_due':
                status = 'PAST_DUE';
                break;
              case 'canceled':
              case 'unpaid':
              case 'incomplete_expired':
                status = 'CANCELLED';
                break;
              default:
                status = 'ACTIVE';
            }

            // If trial just ended and subscription is now active, update accordingly
            const wasTrialing = dbSubscription.status === 'TRIALING';
            const nowActive = subscription.status === 'active';
            if (wasTrialing && nowActive) {
              console.log(`[Stripe] Trial ended, subscription now active for ${dbSubscription.userId}`);
            }

            await prisma.subscription.update({
              where: { id: dbSubscription.id },
              data: {
                status,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              },
            });
          }
          break;
        }

        case 'customer.subscription.trial_will_end': {
          // Fired 3 days before trial ends - good time to send reminder email
          const subscription = event.data.object as Stripe.Subscription;
          const dbSubscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
            include: { user: true },
          });

          if (dbSubscription?.user) {
            const trialEndDate = subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null;

            console.log(
              `[Stripe] Trial ending soon for ${dbSubscription.user.email}, ` +
              `ends: ${trialEndDate?.toISOString()}`
            );

            // TODO: Send trial ending reminder email
            // await sendTrialEndingEmail(dbSubscription.user.email, trialEndDate);
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

            console.log(`[Stripe] Subscription deleted for user ${dbSubscription.userId}`);
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = invoice.subscription as string;

          if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
            // Recurring payment succeeded
            console.log(`[Stripe] Recurring payment succeeded for subscription ${subscriptionId}`);
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

              console.log(`[Stripe] Payment failed for user ${dbSubscription.userId}`);
            }
          }
          break;
        }

        default:
          console.log(`[Stripe] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

// Resend webhook for email events (bounces, complaints, etc.)
interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    bounce?: {
      message: string;
      type: string; // 'hard' | 'soft'
    };
    complaint?: {
      feedback_type: string;
    };
  };
}

router.post('/resend', express.json(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = req.body as ResendWebhookEvent;

    console.log('[Resend Webhook] Event received:', event.type);

    switch (event.type) {
      case 'email.bounced': {
        const { to, bounce } = event.data;
        const recipientEmail = to[0];

        console.log(`[Resend] Email bounced for ${recipientEmail}:`, bounce?.message);

        // Find user by email and disable email prompts on hard bounce
        if (bounce?.type === 'hard') {
          const user = await prisma.user.findUnique({
            where: { email: recipientEmail },
            include: { preferences: true },
          });

          if (user?.preferences) {
            await prisma.userPreferences.update({
              where: { userId: user.id },
              data: {
                emailPromptsEnabled: false,
                // Store bounce reason for admin review
              },
            });
            console.log(`[Resend] Disabled email prompts for ${recipientEmail} due to hard bounce`);
          }
        }
        break;
      }

      case 'email.complained': {
        const { to } = event.data;
        const recipientEmail = to[0];

        console.log(`[Resend] Spam complaint from ${recipientEmail}`);

        // Disable all email communications on spam complaint
        const user = await prisma.user.findUnique({
          where: { email: recipientEmail },
          include: { preferences: true },
        });

        if (user?.preferences) {
          await prisma.userPreferences.update({
            where: { userId: user.id },
            data: {
              emailPromptsEnabled: false,
              // Could add a field for email opt-out status
            },
          });
          console.log(`[Resend] Disabled email prompts for ${recipientEmail} due to spam complaint`);
        }
        break;
      }

      case 'email.delivered': {
        console.log(`[Resend] Email delivered to ${event.data.to[0]}`);
        // Could track delivery stats here
        break;
      }

      case 'email.opened': {
        // Track email opens for engagement metrics
        console.log(`[Resend] Email opened by ${event.data.to[0]}`);
        break;
      }

      case 'email.clicked': {
        // Track link clicks for engagement metrics
        console.log(`[Resend] Link clicked by ${event.data.to[0]}`);
        break;
      }

      default:
        console.log(`[Resend] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Resend Webhook] Error:', error);
    next(error);
  }
});

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

    // Send feedback email using the email service
    await sendPromptFeedbackEmail(
      emailPrompt.user.email,
      emailPrompt.user.displayName || 'Learner',
      emailPrompt.topic.name,
      emailPrompt.questionText,
      text.trim(),
      isCorrect,
      feedback,
      emailPrompt.user.id
    );

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

export default router;
