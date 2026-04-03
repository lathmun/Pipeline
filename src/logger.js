// --- Central Logger ---
// All logging goes through this class.
// If you switch to an external service (Kibana, Grafana Loki, Datadog, etc.)
// you only need to change the _write() method — the rest of the app stays the same.
//
// Log levels (lowest to highest):
//   debug < info < warn < error
//
// Set LOG_LEVEL env var to control output (default: 'info').
// Example: LOG_LEVEL=debug shows everything, LOG_LEVEL=error shows only errors.

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const APP_NAME = require('../package.json').name;

class Logger {
  constructor(options = {}) {
    const level = (options.level || process.env.LOG_LEVEL || 'info').toLowerCase();
    this.level = LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.info;
  }

  // --- Public API ---

  debug(message, meta) {
    this._log('debug', message, meta);
  }

  info(message, meta) {
    this._log('info', message, meta);
  }

  warn(message, meta) {
    this._log('warn', message, meta);
  }

  error(message, meta) {
    this._log('error', message, meta);
  }

  // --- Internal ---

  _log(level, message, meta) {
    if (LEVELS[level] < this.level) return;

    const entry = {
      timestamp: new Date().toISOString(),
      app: APP_NAME,
      level,
      message,
    };
    if (meta !== undefined) entry.meta = meta;

    this._write(level, entry);
  }

  // Change this method to send logs to an external service.
  // For now it writes to stdout/stderr as JSON.
  _write(level, entry) {
    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}

// Singleton — shared across the whole app
module.exports = new Logger();
