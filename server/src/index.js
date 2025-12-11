import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PORT, CORS_ORIGINS } from './config.js';
import authRoutes from './auth/authRoutes.js';
import userRoutes from './users/routes.js';
import marketRoutes from './market/routes.js';
import tradeRoutes from './trades/routes.js';
import adminRoutes from './admin/routes.js';
import notificationRoutes from './notifications/routes.js';
import binaryRoutes from './binary/routes.js';
import spotRoutes from './spot/routes.js';
import db from './db.js';
import { attachIO, tickOnce } from './market/engine.js';

const app = express();
app.use(helmet());
// Allow larger JSON bodies so base64 document/selfie uploads are accepted.
app.use(express.json({ limit: '15mb' }));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, true); // dev: allow all
  },
  credentials: true
}));

app.get('/', (req, res) => res.json({ ok: true, name: 'OTC Market Server' }));
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'otc-market', timestamp: Date.now() });
});
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/binary-trades', binaryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/spot', spotRoutes);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' }
});
attachIO(io);

io.on('connection', (socket) => {
  // nothing special; market engine emits to "io" directly for broadcast
});

// Tick loop
setInterval(() => {
  try {
    tickOnce();
  } catch (e) {
    console.error('tick error:', e);
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
