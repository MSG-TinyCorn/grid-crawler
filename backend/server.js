const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Shop items — must match frontend
const ITEMS = {
  shield_core: { name: 'Shield Core — Extra Life',            price: 49  },  // pence
  pulse_x3:    { name: 'Pulse X3 — Triple Blast Range',       price: 79  },
  ghost_mode:  { name: 'Ghost Mode — 30 Second Invisibility', price: 99  },
  overclock:   { name: 'Overclock — Double Speed',            price: 149 },
};

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/create-checkout-session', async (req, res) => {
  const { item } = req.body;
  const product = ITEMS[item];

  if (!product) {
    return res.status(400).json({ error: 'Unknown item' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: product.name,
            description: 'Grid Crawler — Mainframe Breach',
          },
          unit_amount: product.price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}?success=true&item=${item}`,
      cancel_url:  `${process.env.FRONTEND_URL}?cancelled=true`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Payment session failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Grid Crawler backend running on port ${PORT}`));
