/**
 * Stripe Product Setup Script
 *
 * Run this script ONCE to create the Teachy Pro product and prices in Stripe.
 *
 * Usage:
 *   npx ts-node scripts/setup-stripe-products.ts
 *
 * Or with tsx:
 *   npx tsx scripts/setup-stripe-products.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey || stripeKey === 'sk_test_placeholder') {
  console.error('❌ STRIPE_SECRET_KEY not configured in .env');
  process.exit(1);
}

const stripe = new Stripe(stripeKey);

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products for Teachy...\n');

  try {
    // Check if product already exists
    const existingProducts = await stripe.products.list({ limit: 100 });
    const existingPro = existingProducts.data.find(p => p.name === 'Teachy Pro');

    let product: Stripe.Product;

    if (existingPro) {
      console.log('📦 Product "Teachy Pro" already exists:', existingPro.id);
      product = existingPro;
    } else {
      // Create the Teachy Pro product
      product = await stripe.products.create({
        name: 'Teachy Pro',
        description: 'Unlock unlimited learning sessions, AI-powered insights, timed challenges, and advanced analytics.',
        metadata: {
          app: 'teachy',
          tier: 'pro',
        },
      });
      console.log('✅ Created product "Teachy Pro":', product.id);
    }

    // Check for existing prices
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });

    const existingMonthly = existingPrices.data.find(
      p => p.recurring?.interval === 'month' && p.unit_amount === 999
    );
    const existingYearly = existingPrices.data.find(
      p => p.recurring?.interval === 'year' && p.unit_amount === 9990
    );

    let monthlyPrice: Stripe.Price;
    let yearlyPrice: Stripe.Price;

    // Create monthly price ($9.99/month)
    if (existingMonthly) {
      console.log('💵 Monthly price already exists:', existingMonthly.id);
      monthlyPrice = existingMonthly;
    } else {
      monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: 999, // $9.99 in cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          plan: 'monthly',
          display_name: 'Monthly',
        },
      });
      console.log('✅ Created monthly price ($9.99/month):', monthlyPrice.id);
    }

    // Create yearly price ($99.90/year - 2 months free)
    if (existingYearly) {
      console.log('💵 Yearly price already exists:', existingYearly.id);
      yearlyPrice = existingYearly;
    } else {
      yearlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: 9990, // $99.90 in cents
        currency: 'usd',
        recurring: {
          interval: 'year',
        },
        metadata: {
          plan: 'yearly',
          display_name: 'Yearly (Save 17%)',
        },
      });
      console.log('✅ Created yearly price ($99.90/year):', yearlyPrice.id);
    }

    // Output the environment variables to add
    console.log('\n' + '='.repeat(60));
    console.log('📋 Add these to your api/.env file:\n');
    console.log(`STRIPE_PRICE_MONTHLY=${monthlyPrice.id}`);
    console.log(`STRIPE_PRICE_YEARLY=${yearlyPrice.id}`);
    console.log('='.repeat(60));

    console.log('\n✨ Stripe setup complete!\n');
    console.log('Next steps:');
    console.log('1. Update api/.env with the price IDs above');
    console.log('2. Configure the Stripe Customer Portal in your Dashboard:');
    console.log('   https://dashboard.stripe.com/test/settings/billing/portal');
    console.log('3. Enable the "Cancel subscription" and "Update payment method" features');
    console.log('4. Set up the webhook endpoint in Stripe Dashboard:');
    console.log('   https://dashboard.stripe.com/test/webhooks');
    console.log('   Endpoint URL: https://your-domain.com/api/webhooks/stripe');
    console.log('   Events: checkout.session.completed, customer.subscription.updated,');
    console.log('           customer.subscription.deleted, customer.subscription.trial_will_end,');
    console.log('           invoice.payment_failed, invoice.payment_succeeded\n');

  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error);
    process.exit(1);
  }
}

setupStripeProducts();
