const express = require('express');
const path = require('path');

// --- Load environment variables from .env file ---
// dotenv reads .env and sets process.env values.
// In production, env vars are set by pm2's ecosystem.config.js instead.
// MUST run before requiring logger so Loki credentials are available.
require('dotenv').config();

const log = require('./logger');
const metrics = require('./metrics');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Paths excluded from request logging and metrics to prevent admin polling
// from creating a self-referential feedback loop in the log stream and
// inflating request counters with dashboard traffic.
const SILENT_PATHS = new Set(['/api/admin/stats', '/api/admin/logs']);

// --- Metrics Middleware ---
// Tracks response time and status codes for every request.
// Runs before any route — records when the response finishes.
// Admin polling endpoints are excluded to keep stats meaningful.
app.use((req, res, next) => {
  if (SILENT_PATHS.has(req.path)) return next();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.record(req, res, duration);
    if (duration > 1000) {
      log.warn('Slow response detected', { method: req.method, url: req.url, durationMs: duration });
    }
  });
  next();
});

// --- Request Logger ---
// Logs every incoming request with method, URL, and timestamp.
// Admin polling endpoints are excluded to prevent their log entries from
// appearing in the admin log stream (which would cause a feedback loop).
app.use((req, res, next) => {
  if (!SILENT_PATHS.has(req.path)) {
    log.info(`${req.method} ${req.url}`);
  }
  next();
});

// --- Health Check Endpoint ---
// A simple route that returns the app status, uptime, and version.
// Used by monitoring tools, load balancers, and Nginx to check if the app is alive.
// NO authentication required — health checks must be fast and public.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// --- Basic Authentication Middleware ---
// Credentials come from environment variables — NEVER hardcoded.
// Fallbacks are only for local development convenience.
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'changeme';

function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    log.warn('Auth failed: no credentials provided', { url: req.url });
    res.set('WWW-Authenticate', 'Basic realm="Pipeline Admin"');
    return res.status(401).json({ error: 'AUTH_MISSING', message: 'Authentication required. Please provide your username and password.' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (username === AUTH_USER && password === AUTH_PASS) {
    return next();
  }

  log.warn('Auth failed: invalid credentials', { url: req.url });
  res.set('WWW-Authenticate', 'Basic realm="Pipeline Admin"');
  return res.status(401).json({ error: 'AUTH_INVALID', message: 'Incorrect username or password. Please try again.' });
}

// --- In-memory data store ---
let items = [
  { id: 1, name: 'Sample Item', description: 'This is a sample item' },
];
let nextId = 2;

// --- API Routes (all protected by basic auth) ---

// GET all items
app.get('/api/items', basicAuth, (req, res) => {
  log.info(`Fetching all items — returning ${items.length} item(s)`);
  res.json(items);
});

// GET single item
app.get('/api/items/:id', basicAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    log.warn('Invalid item ID format', { rawId: req.params.id, ip: req.ip });
    return res.status(400).json({ error: 'INVALID_ID', message: 'Item ID must be a number.' });
  }
  const item = items.find(i => i.id === id);
  if (!item) {
    log.warn(`Lookup failed — item with id ${id} does not exist in the list`, { id });
    return res.status(404).json({ error: 'NOT_FOUND', message: `Item with id ${req.params.id} was not found.` });
  }
  log.info(`Fetched item "${item.name}" (id: ${item.id})`);
  res.json(item);
});

// POST create item
app.post('/api/items', basicAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    log.warn('Creating item failed — name field is missing from request body', { body: req.body });
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Item name is required. Please provide a name.' });
  }
  if (name.length > 100) {
    log.warn(`Item name is ${name.length} characters — exceeds recommended limit of 100`, { name });
  }
  const item = { id: nextId++, name, description: description || '' };
  items.push(item);
  log.info(`New item added to the list — "${item.name}" assigned id ${item.id} (total items: ${items.length})`, { id: item.id, name: item.name });
  res.status(201).json(item);
});

// PUT update item
app.put('/api/items/:id', basicAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    log.warn('Invalid item ID format', { rawId: req.params.id, ip: req.ip });
    return res.status(400).json({ error: 'INVALID_ID', message: 'Item ID must be a number.' });
  }
  const item = items.find(i => i.id === id);
  if (!item) {
    log.warn(`Update failed — item with id ${id} does not exist in the list`, { id });
    return res.status(404).json({ error: 'NOT_FOUND', message: `Item with id ${req.params.id} was not found.` });
  }
  const { name, description } = req.body;
  const changes = [];
  if (name !== undefined) { changes.push(`name: "${item.name}" → "${name}"`); item.name = name; }
  if (description !== undefined) { changes.push(`description updated`); item.description = description; }
  log.info(`Item id ${item.id} updated — ${changes.length ? changes.join(', ') : 'no fields changed'}`, { id: item.id, changes });
  res.json(item);
});

// DELETE item
app.delete('/api/items/:id', basicAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    log.warn('Invalid item ID format', { rawId: req.params.id, ip: req.ip });
    return res.status(400).json({ error: 'INVALID_ID', message: 'Item ID must be a number.' });
  }
  const index = items.findIndex(i => i.id === id);
  if (index === -1) {
    log.warn(`Delete failed — item with id ${id} does not exist in the list`, { id });
    return res.status(404).json({ error: 'NOT_FOUND', message: `Item with id ${req.params.id} was not found.` });
  }
  const deleted = items.splice(index, 1);
  log.info(`Item removed from the list — "${deleted[0].name}" (id: ${deleted[0].id}) deleted (remaining items: ${items.length})`, { id: deleted[0].id, name: deleted[0].name });
  res.json(deleted[0]);
});

// --- Admin Routes (protected by basic auth) ---

// GET /admin — Serves the admin dashboard HTML page
app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// GET /api/admin/stats — Returns all metrics as JSON
app.get('/api/admin/stats', basicAuth, (req, res) => {
  const stats = metrics.snapshot();
  stats.logTransport = log.getTransport();
  stats.lokiConfigured = !!(process.env.LOKI_URL && process.env.LOKI_USER && process.env.LOKI_TOKEN);
  res.json(stats);
});

// GET /api/admin/logs — Returns recent log entries
app.get('/api/admin/logs', basicAuth, (req, res) => {
  const count = Math.min(parseInt(req.query.count, 10) || 50, 200);
  res.json(log.getRecentLogs(count));
});

// GET /api/admin/transport — Returns current log transport mode
app.get('/api/admin/transport', basicAuth, (req, res) => {
  res.json({
    transport: log.getTransport(),
    available: ['local', 'direct', 'alloy'],
    lokiConfigured: !!(process.env.LOKI_URL && process.env.LOKI_USER && process.env.LOKI_TOKEN),
  });
});

// PUT /api/admin/transport — Switch log transport mode at runtime
app.put('/api/admin/transport', basicAuth, (req, res) => {
  const { transport } = req.body;
  if (!transport) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'transport field is required. Use: local, direct, or alloy.' });
  }
  const ok = log.setTransport(transport);
  if (!ok) {
    return res.status(400).json({ error: 'INVALID_TRANSPORT', message: `Invalid transport "${transport}". Use: local, direct, or alloy.` });
  }
  log.info('Log transport changed', { transport });
  res.json({ transport: log.getTransport() });
});

// POST /api/admin/test-loki — Test the Loki connection
app.post('/api/admin/test-loki', basicAuth, async (req, res) => {
  const result = await log.testLokiConnection();
  res.json(result);
});

// POST /api/admin/reset-metrics — Reset all metrics counters
app.post('/api/admin/reset-metrics', basicAuth, (req, res) => {
  metrics.reset();
  log.info('Metrics reset by admin');
  res.json({ message: 'Metrics reset successfully' });
});

// --- JSON Parse Error Handler ---
// Catches malformed JSON in request bodies and logs an error.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    log.error('Malformed JSON in request body', { method: req.method, url: req.url, ip: req.ip });
    return res.status(400).json({ error: 'INVALID_JSON', message: 'Request body contains invalid JSON.' });
  }
  next(err);
});

// --- Global Error Handler ---
// Catches any unhandled errors and logs them at error level.
// Prevents the server from crashing on unexpected exceptions.
app.use((err, req, res, next) => {
  log.error('Unhandled server error', { message: err.message, stack: err.stack, method: req.method, url: req.url });
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
});

// Helper to reset state for tests
app._resetStore = () => {
  items = [{ id: 1, name: 'Sample Item', description: 'This is a sample item' }];
  nextId = 2;
  metrics.reset();
};

module.exports = app;
