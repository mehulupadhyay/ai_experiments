const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security middleware ─────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/teacher',      require('./routes/teacher'));
app.use('/api/parent',       require('./routes/parent'));
app.use('/api/students',     require('./routes/students'));
app.use('/api/attendance',   require('./routes/attendance'));
app.use('/api/grades',       require('./routes/grades'));
app.use('/api/classes',      require('./routes/classes'));
app.use('/api/messages',     require('./routes/messages'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/google',       require('./routes/google'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`SIS API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app;
