// --- Central Logger ---
// All logging goes through this class.
// Supports three transport modes (set via LOG_TRANSPORT env var or runtime switch):
//   - "local"  : write JSON to stdout/stderr only (default)
//   - "direct" : push JSON logs to Grafana Cloud Loki via HTTPS + write to stdout
//   - "alloy"  : write to stdout only (Grafana Alloy agent tails stdout/log files)
//
// Log levels (lowest to highest):
//   debug < info < warn < error
//
// Set LOG_LEVEL env var to control output (default: 'info').
// Example: LOG_LEVEL=debug shows everything, LOG_LEVEL=error shows only errors.

const https = require('https');
const http = require('http');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const TRANSPORTS = ['local', 'direct', 'alloy'];

const pkg = require('../package.json');
const APP_NAME = process.env.APP_NAME || pkg.name;
const APP_VERSION = pkg.version;

class Logger {
  constructor(options = {}) {
    const level = (options.level || process.env.LOG_LEVEL || 'info').toLowerCase();
    this.level = LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.info;

    // Transport: local (stdout only), direct (push to Loki), alloy (stdout for Alloy to tail)
    this.transport = (options.transport || process.env.LOG_TRANSPORT || 'local').toLowerCase();
    if (!TRANSPORTS.includes(this.transport)) this.transport = 'local';

    // Loki config for direct push
    this.lokiUrl = options.lokiUrl || process.env.LOKI_URL || '';
    this.lokiUser = options.lokiUser || process.env.LOKI_USER || '';
    this.lokiToken = options.lokiToken || process.env.LOKI_TOKEN || '';

    // Buffer for batching Loki pushes (send every 2s or when buffer hits 10 entries)
    this._lokiBuffer = [];
    this._lokiFlushInterval = null;
    this._lokiMaxBatch = 10;
    this._lokiFlushMs = 2000;

    if (this.transport === 'direct' && this.lokiUrl) {
      this._startFlushTimer();
    }

    // Recent log entries kept in memory for the admin page
    this._recentLogs = [];
    this._maxRecentLogs = 200;
  }

  // --- Public API ---

  debug(message, meta) { this._log('debug', message, meta); }
  info(message, meta) { this._log('info', message, meta); }
  warn(message, meta) { this._log('warn', message, meta); }
  error(message, meta) { this._log('error', message, meta); }

  // --- Transport Management ---

  getTransport() { return this.transport; }

  setTransport(mode) {
    mode = (mode || '').toLowerCase();
    if (!TRANSPORTS.includes(mode)) return false;

    // Stop Loki flush timer if switching away from direct
    if (this.transport === 'direct' && mode !== 'direct') {
      this._stopFlushTimer();
    }

    this.transport = mode;

    // Start Loki flush timer if switching to direct
    if (mode === 'direct' && this.lokiUrl) {
      this._startFlushTimer();
    }

    return true;
  }

  getRecentLogs(count) {
    return this._recentLogs.slice(-(count || 50));
  }

  // Test Loki connection by pushing a test log entry.
  // Returns a promise that resolves to { ok, status, message }.
  testLokiConnection() {
    if (!this.lokiUrl || !this.lokiUser || !this.lokiToken) {
      return Promise.resolve({ ok: false, status: 0, message: 'Loki credentials not configured (LOKI_URL, LOKI_USER, LOKI_TOKEN)' });
    }
    const testEntry = {
      timestamp: new Date().toISOString(),
      app: APP_NAME,
      version: APP_VERSION,
      level: 'info',
      message: 'Loki connection test from pipeline admin',
    };
    return this._pushToLoki([testEntry]);
  }

  // --- Internal ---

  _log(level, message, meta) {
    if (LEVELS[level] < this.level) return;

    const entry = {
      timestamp: new Date().toISOString(),
      app: APP_NAME,
      version: APP_VERSION,
      level,
      message,
    };
    if (meta !== undefined) entry.meta = meta;

    // Store in recent logs ring buffer
    this._recentLogs.push(entry);
    if (this._recentLogs.length > this._maxRecentLogs) {
      this._recentLogs.shift();
    }

    this._write(level, entry);
  }

  _write(level, entry) {
    const line = JSON.stringify(entry);

    // Always write to stdout/stderr (needed for local, alloy, and as fallback)
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }

    // If direct mode, also buffer for Loki push
    if (this.transport === 'direct' && this.lokiUrl) {
      this._lokiBuffer.push(entry);
      if (this._lokiBuffer.length >= this._lokiMaxBatch) {
        this._flushLoki();
      }
    }
  }

  // --- Loki Push ---

  _startFlushTimer() {
    if (this._lokiFlushInterval) return;
    this._lokiFlushInterval = setInterval(() => this._flushLoki(), this._lokiFlushMs);
    // Don't keep the process alive just for log flushing
    if (this._lokiFlushInterval.unref) this._lokiFlushInterval.unref();
  }

  _stopFlushTimer() {
    if (this._lokiFlushInterval) {
      clearInterval(this._lokiFlushInterval);
      this._lokiFlushInterval = null;
    }
  }

  _flushLoki() {
    if (this._lokiBuffer.length === 0) return;
    const batch = this._lokiBuffer.splice(0);
    this._pushToLoki(batch).catch(() => {
      // Silently drop on failure — logs are already on stdout
    });
  }

  // Push an array of log entries to Grafana Cloud Loki.
  // Loki expects the Protobuf/JSON push API format:
  //   POST /loki/api/v1/push
  //   { "streams": [{ "stream": { labels }, "values": [[ "nanosecond_ts", "line" ]] }] }
  _pushToLoki(entries) {
    return new Promise((resolve) => {
      const values = entries.map(e => {
        const ns = new Date(e.timestamp).getTime() + '000000'; // ms → ns string
        return [ns, JSON.stringify(e)];
      });

      const payload = JSON.stringify({
        streams: [{
          stream: { app: APP_NAME, version: APP_VERSION, environment: process.env.NODE_ENV || 'development' },
          values,
        }],
      });

      let parsedUrl;
      try {
        parsedUrl = new URL(this.lokiUrl);
      } catch {
        resolve({ ok: false, status: 0, message: 'Invalid LOKI_URL' });
        return;
      }

      // Build path — append /loki/api/v1/push if not already in the URL
      let pushPath = parsedUrl.pathname;
      if (!pushPath.includes('/loki/api/v1/push')) {
        pushPath = pushPath.replace(/\/+$/, '') + '/loki/api/v1/push';
      }

      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const opts = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: pushPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(this.lokiUser + ':' + this.lokiToken).toString('base64'),
        },
        timeout: 5000,
      };

      const req = transport.request(opts, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve({ ok, status: res.statusCode, message: ok ? 'OK' : body });
        });
      });

      req.on('error', (err) => {
        resolve({ ok: false, status: 0, message: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 0, message: 'Request timed out' });
      });

      req.write(payload);
      req.end();
    });
  }

  // Flush remaining buffer on shutdown
  destroy() {
    this._stopFlushTimer();
    this._flushLoki();
  }
}

// Singleton — shared across the whole app
module.exports = new Logger();
