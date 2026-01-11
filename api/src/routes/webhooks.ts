import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import express from 'express';
import { prisma } from '../index.js';

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

    // Evaluate the answer using AI (placeholder)
    // TODO: Implement AI evaluation
    const isCorrect = true; // Placeholder

    await prisma.emailPrompt.update({
      where: { id: promptId },
      data: {
        repliedAt: new Date(),
        userResponse: text.trim(),
        isCorrect,
        feedbackSentAt: new Date(),
      },
    });

    // TODO: Send feedback email

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

export default router;
