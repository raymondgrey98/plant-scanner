const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { query }       = require('../db');
const { sendPremiumConfirmationEmail, sendSubscriptionCancelledEmail } = require('../utils/email');

const router = express.Router();

// ── Stripe ─────────────────────────────────────────────────────
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-08-15' }); }
  catch { console.warn('[payments] stripe package not installed'); }
}

// ── PayPal ─────────────────────────────────────────────────────
const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getPayPalToken() {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

// ── PayMongo (GCash / Maya — Philippines) ──────────────────────
const PAYMONGO_KEY = process.env.PAYMONGO_SECRET_KEY;

// ── Helpers ───────────────────────────────────────────────────
function getPremiumPrice() {
  return Number(process.env.PREMIUM_PRICE_USD || 9.99);
}

// ── GET /api/subscription/status ─────────────────────────────
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT subscription_status, subscription_end, stripe_customer_id FROM users WHERE id=$1',
      [req.user.id]
    );
    const user = result.rows[0];
    const isActive = user.subscription_status === 'premium'
      && (!user.subscription_end || new Date(user.subscription_end) > new Date());
    res.json({
      status:    user.subscription_status,
      is_active: isActive,
      ends_at:   user.subscription_end,
      price_usd: getPremiumPrice(),
    });
  } catch (err) { next(err); }
});

// ── POST /api/subscription/stripe/checkout ───────────────────
router.post('/stripe/checkout', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) return res.status(500).json({ error: 'Stripe price ID not configured' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: req.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pricing`,
      metadata: { user_id: String(req.user.id) },
    });
    res.json({ url: session.url, provider: 'stripe' });
  } catch (err) { next(err); }
});

// ── POST /api/subscription/paypal/create ─────────────────────
router.post('/paypal/create', requireAuth, async (req, res, next) => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }
    const token = await getPayPalToken();
    const res2  = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: getPremiumPrice().toFixed(2) },
          description: 'FloraIQ Premium — 1 month',
          custom_id: String(req.user.id),
        }],
        application_context: {
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription/paypal/success`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pricing`,
        },
      }),
    });
    const order = await res2.json();
    const approveUrl = order.links?.find(l => l.rel === 'approve')?.href;
    res.json({ orderId: order.id, approveUrl, provider: 'paypal' });
  } catch (err) { next(err); }
});

// ── POST /api/subscription/paypal/capture ─────────────────────
router.post('/paypal/capture', requireAuth, async (req, res, next) => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const token = await getPayPalToken();
    const res2  = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await res2.json();
    if (data.status !== 'COMPLETED') return res.status(400).json({ error: 'Payment not completed', data });

    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      'UPDATE users SET subscription_status=$1, subscription_end=$2 WHERE id=$3',
      ['premium', endDate, req.user.id]
    );
    sendPremiumConfirmationEmail(req.user.email, req.user.full_name).catch(() => {});
    await query(
      'INSERT INTO notifications (user_id, type, title, message) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'premium', 'Premium activated!', 'Your FloraIQ Premium subscription is now active via PayPal.']
    ).catch(() => {});
    res.json({ success: true, provider: 'paypal', ends_at: endDate });
  } catch (err) { next(err); }
});

// ── POST /api/subscription/paymongo/checkout (GCash/Maya) ─────
router.post('/paymongo/checkout', requireAuth, async (req, res, next) => {
  try {
    if (!PAYMONGO_KEY) return res.status(503).json({ error: 'PayMongo (GCash/Maya) is not configured' });
    const { payment_method } = req.body; // 'gcash' or 'paymaya'
    const creds = Buffer.from(PAYMONGO_KEY + ':').toString('base64');

    const res2 = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(getPremiumPrice() * 56 * 100), // USD to PHP (approx)
            currency: 'PHP',
            description: 'FloraIQ Premium — 1 month',
          },
        },
      }),
    });
    const data = await res2.json();
    const checkoutUrl = data.data?.attributes?.checkout_url;
    if (!checkoutUrl) return res.status(400).json({ error: 'PayMongo error', data });
    res.json({ url: checkoutUrl, provider: 'paymongo', method: payment_method || 'gcash' });
  } catch (err) { next(err); }
});

// ── POST /api/subscription/stripe/webhook ────────────────────
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(400).send('Stripe not configured');
  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(400).send('Webhook secret not configured');

  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, secret); }
  catch (err) { return res.status(400).send(`Webhook error: ${err.message}`); }

  const session = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const email  = session.customer_email;
    const userId = session.metadata?.user_id;
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (userId) {
      await query('UPDATE users SET subscription_status=$1, subscription_end=$2, stripe_customer_id=$3 WHERE id=$4',
        ['premium', endDate, session.customer, userId]);
    } else if (email) {
      await query('UPDATE users SET subscription_status=$1, subscription_end=$2, stripe_customer_id=$3 WHERE email=$4',
        ['premium', endDate, session.customer, email]);
    }
    const u = userId
      ? await query('SELECT id, email, full_name FROM users WHERE id=$1', [userId])
      : await query('SELECT id, email, full_name FROM users WHERE email=$1', [email]);
    if (u.rows[0]) {
      sendPremiumConfirmationEmail(u.rows[0].email, u.rows[0].full_name).catch(() => {});
      await query('INSERT INTO notifications (user_id, type, title, message) VALUES ($1,$2,$3,$4)',
        [u.rows[0].id, 'premium', 'Premium activated!', 'Your FloraIQ Premium subscription is now active.']).catch(() => {});
    }
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.canceled') {
    const customerId = session.customer;
    const u = await query('SELECT id, email, full_name FROM users WHERE stripe_customer_id=$1', [customerId]);
    if (u.rows[0]) {
      const endDate = session.current_period_end ? new Date(session.current_period_end * 1000) : new Date();
      await query('UPDATE users SET subscription_status=$1, subscription_end=$2 WHERE stripe_customer_id=$3',
        ['free', endDate, customerId]);
      const endStr = endDate.toLocaleDateString();
      sendSubscriptionCancelledEmail(u.rows[0].email, u.rows[0].full_name, endStr).catch(() => {});
      await query('INSERT INTO notifications (user_id, type, title, message) VALUES ($1,$2,$3,$4)',
        [u.rows[0].id, 'info', 'Subscription cancelled', `Your Premium access continues until ${endStr}.`]).catch(() => {});
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const customerId = session.customer;
    const u = await query('SELECT id, email FROM users WHERE stripe_customer_id=$1', [customerId]);
    if (u.rows[0]) {
      await query('INSERT INTO notifications (user_id, type, title, message) VALUES ($1,$2,$3,$4)',
        [u.rows[0].id, 'warning', 'Payment failed', 'Your Premium subscription payment failed. Please update your payment method.']).catch(() => {});
    }
  }

  res.json({ received: true });
});

// ── POST /api/subscription/cancel (Stripe) ───────────────────
router.post('/cancel', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    const u = await query('SELECT stripe_customer_id FROM users WHERE id=$1', [req.user.id]);
    const customerId = u.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: 'No Stripe customer found' });

    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
    if (!subs.data.length) return res.status(400).json({ error: 'No active subscription' });

    await stripe.subscriptions.update(subs.data[0].id, { cancel_at_period_end: true });
    res.json({ success: true, message: 'Subscription will cancel at the end of the billing period.' });
  } catch (err) { next(err); }
});

module.exports = router;
