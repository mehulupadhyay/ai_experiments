const winston = require('winston');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');

// Ensure the logs directory exists (safe no-op if already present)
if (process.env.NODE_ENV === 'production') {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    // If we still can't create it, fall back to console-only logging
    process.stderr.write(`Warning: could not create logs dir: ${err.message}\n`);
  }
}

const fileTransports =
  process.env.NODE_ENV === 'production'
    ? [
        new winston.transports.File({
          filename: path.join(LOG_DIR, 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join(LOG_DIR, 'combined.log'),
        }),
      ]
    : [];

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.prettyPrint()
  ),
  transports: [new winston.transports.Console(), ...fileTransports],
});

module.exports = { logger };
