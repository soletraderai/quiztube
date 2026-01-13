import { Router, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Only initialize Stripe if a real key is provided
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey && stripeKey !== 'sk_test_placeholder'
  ? new Stripe(stripeKey)
  : null;

const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly',
  yearly: process.env.STRIPE_PRICE_YEARLY || 'price_yearly',
};

// Trial period in days (default 14 days for new users)
const TRIAL_PERIOD_DAYS = parseInt(process.env.STRIPE_TRIAL_PERIOD_DAYS || '14', 10);

// GET /api/subscriptions/status
router.get('/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    // Check if user is in trial period
    const isTrialing = subscription?.status === 'TRIALING';
    const trialEndsAt = isTrialing ? subscription?.currentPeriodEnd : null;

    // Calculate days remaining in trial
    let trialDaysRemaining = 0;
    if (isTrialing && trialEndsAt) {
      const now = new Date();
      const diffMs = trialEndsAt.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Check if user has ever had a trial (to prevent double trials)
    const hasHadTrial = subscription?.stripeSubscriptionId !== null ||
                        subscription?.status === 'TRIALING' ||
                        subscription?.status === 'CANCELLED';

    res.json({
      tier: subscription?.tier || 'FREE',
      status: subscription?.status || 'ACTIVE',
      currentPeriodEnd: subscription?.currentPeriodEnd,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
      isTrialing,
      trialEndsAt,
      trialDaysRemaining,
      eligibleForTrial: !hasHadTrial,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/checkout
router.post('/checkout', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!stripe) {
      throw new AppError(503, 'Payment processing is not configured', 'STRIPE_NOT_CONFIGURED');
    }

    const { priceType } = req.body; // 'monthly' or 'yearly'

    const priceId = priceType === 'yearly' ? PRICES.yearly : PRICES.monthly;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { subscription: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    // Check if user is eligible for trial (never had a subscription before)
    const hasHadSubscription = user.subscription?.stripeSubscriptionId !== null ||
                               user.subscription?.status === 'CANCELLED' ||
                               user.subscription?.status === 'TRIALING';
    const eligibleForTrial = !hasHadSubscription;

    // Get or create Stripe customer
    let customerId = user.subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.displayName,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      // Upsert subscription with customer ID
      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          tier: 'FREE',
          status: 'ACTIVE',
          stripeCustomerId: customerId,
        },
        update: { stripeCustomerId: customerId },
      });
    }

    // Build checkout session options
    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        userId: user.id,
        hasTrial: eligibleForTrial ? 'true' : 'false',
      },
      // Always collect payment method for post-trial billing
      payment_method_collection: 'always',
    };

    // Add 14-day free trial for eligible users
    if (eligibleForTrial && TRIAL_PERIOD_DAYS > 0) {
      sessionOptions.subscription_data = {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: {
          userId: user.id,
        },
      };
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionOptions);

    res.json({
      url: session.url,
      hasFreeTrial: eligibleForTrial,
      trialDays: eligibleForTrial ? TRIAL_PERIOD_DAYS : 0,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/portal
router.post('/portal', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!stripe) {
      throw new AppError(503, 'Payment processing is not configured', 'STRIPE_NOT_CONFIGURED');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription?.stripeCustomerId) {
      throw new AppError(400, 'No subscription found', 'NO_SUBSCRIPTION');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings`,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/dev-upgrade - Development mode subscription upgrade
router.post('/dev-upgrade', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(403, 'Not available in production', 'NOT_ALLOWED');
    }

    const { billingType } = req.body;
    const isYearly = billingType === 'yearly';

    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now);
    if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Update subscription to PRO
    await prisma.subscription.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        tier: 'PRO',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        stripeCustomerId: `dev_customer_${req.user!.id}`,
        stripeSubscriptionId: `dev_sub_${Date.now()}`,
      },
      update: {
        tier: 'PRO',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        stripeSubscriptionId: `dev_sub_${Date.now()}`,
      },
    });

    res.json({
      success: true,
      message: 'Subscription upgraded to PRO (development mode)',
      billingType,
      periodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/dev-cancel - Development mode subscription cancellation
router.post('/dev-cancel', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(403, 'Not available in production', 'NOT_ALLOWED');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription || subscription.tier !== 'PRO') {
      throw new AppError(400, 'No active Pro subscription found', 'NO_SUBSCRIPTION');
    }

    // Set cancelAtPeriodEnd to true - user keeps access until period end
    await prisma.subscription.update({
      where: { userId: req.user!.id },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    res.json({
      success: true,
      message: 'Subscription will cancel at period end',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/dev-reactivate - Development mode subscription reactivation
router.post('/dev-reactivate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(403, 'Not available in production', 'NOT_ALLOWED');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription || subscription.tier !== 'PRO') {
      throw new AppError(400, 'No Pro subscription found', 'NO_SUBSCRIPTION');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new AppError(400, 'Subscription is not scheduled for cancellation', 'NOT_CANCELLED');
    }

    // Reactivate subscription by setting cancelAtPeriodEnd to false
    await prisma.subscription.update({
      where: { userId: req.user!.id },
      data: {
        cancelAtPeriodEnd: false,
      },
    });

    res.json({
      success: true,
      message: 'Subscription reactivated successfully',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/verify - Verify checkout session
router.post('/verify', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!stripe) {
      throw new AppError(503, 'Payment processing is not configured', 'STRIPE_NOT_CONFIGURED');
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      throw new AppError(400, 'Session ID is required', 'MISSING_SESSION_ID');
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== 'paid') {
      throw new AppError(400, 'Payment not completed', 'PAYMENT_NOT_COMPLETED');
    }

    // The webhook should have already updated the subscription,
    // but verify and update if needed
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (subscription?.tier !== 'PRO') {
      // Update if webhook hasn't processed yet
      await prisma.subscription.update({
        where: { userId: req.user!.id },
        data: {
          tier: 'PRO',
          status: 'ACTIVE',
          stripeSubscriptionId: session.subscription as string,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    res.json({ success: true, message: 'Subscription verified' });
  } catch (error) {
    next(error);
  }
});

export default router;
