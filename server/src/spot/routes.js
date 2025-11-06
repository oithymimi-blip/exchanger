import express from 'express';
import { requireAuth, requireAdmin } from '../auth/authMiddleware.js';
import { getSpotMarkets, updateSpotOverride } from './service.js';

const router = express.Router();

router.get('/markets', async (req, res) => {
  try {
    const markets = await getSpotMarkets();
    res.json({ markets });
  } catch (err) {
    console.error('spot markets error', err);
    res.status(503).json({ error: 'Failed to load live spot markets' });
  }
});

router.post('/markets/:symbol/price', requireAuth, requireAdmin, async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const overrides = await updateSpotOverride(symbol, {
      price: req.body.price,
      change_24h: req.body.change_24h,
      volume_24h: req.body.volume_24h
    });
    res.json({ ok: true, overrides });
  } catch (err) {
    console.error('spot override error', err);
    res.status(500).json({ error: 'Failed to update spot market' });
  }
});

export default router;
