const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// MongoDB connection
let db;
async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('grid-crawler');
  console.log('MongoDB connected');
}
connectDB().catch(console.error);

const ITEMS = {continue:      { name: 'Continue — Keep Playing',             
price: 30  },
  shield_core: 
{ name: 'Shield Core — Extra Life',            price: 49  },
  pulse_x3:    { name: 'Pulse X3 — Triple Blast Range',       price: 79  },
  ghost_mode:  { name: 'Ghost Mode — 30 Second Invisibility', price: 99  },
  overclock:   { name: 'Overclock — Double Speed',            price: 149 },
};

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get all purchases for a player
app.get('/purchases/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const player = await db.collection('players').findOne({ playerId });
    res.json({ purchases: player ? player.purchases : [] });
  } catch (err) {
    console.error('DB error:', err.message);
    res.status(500).json({ purchases: [] });
  }
});

// Create Stripe checkout session
app.post('/create-checkout-session', async (req, res) => {
  const { item, playerId } = req.body;
  const product = ITEMS[item];

  if (!product) return res.status(400).json({ error: 'Unknown item' });

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
      success_url: `${process.env.FRONTEND_URL}?success=true&item=${item}&playerId=${playerId}`,
      cancel_url:  `${process.env.FRONTEND_URL}?cancelled=true`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Payment session failed' });
  }
});

// Save purchase to MongoDB after Stripe success
app.post('/save-purchase', async (req, res) => {
  try {
    const { playerId, item } = req.body;
    if (!playerId || !item) return res.status(400).json({ error: 'Missing data' });

    await db.collection('players').updateOne(
      { playerId },
      { $addToSet: { purchases: item }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Save error:', err.message);
    res.status(500).json({ error: 'Could not save purchase' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Grid Crawler backend running on port ${PORT}`));
