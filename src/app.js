const express = require('express');
const path = require('path');
const app = express();

// --- Load environment variables from .env file ---
// dotenv reads .env and sets process.env values.
// In production, env vars are set by pm2's ecosystem.config.js instead.
require('dotenv').config();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Request Logger ---
// Logs every incoming request with method, URL, and timestamp.
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
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
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (username === AUTH_USER && password === AUTH_PASS) {
    return next();
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}

// --- In-memory data store ---
let items = [
  { id: 1, name: 'Sample Item', description: 'This is a sample item' },
];
let nextId = 2;

// --- API Routes (all protected by basic auth) ---

// GET all items
app.get('/api/items', basicAuth, (req, res) => {
  res.json(items);
});

// GET single item
app.get('/api/items/:id', basicAuth, (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id, 10));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// POST create item
app.post('/api/items', basicAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const item = { id: nextId++, name, description: description || '' };
  items.push(item);
  res.status(201).json(item);
});

// PUT update item
app.put('/api/items/:id', basicAuth, (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id, 10));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const { name, description } = req.body;
  if (name !== undefined) item.name = name;
  if (description !== undefined) item.description = description;
  res.json(item);
});

// DELETE item
app.delete('/api/items/:id', basicAuth, (req, res) => {
  const index = items.findIndex(i => i.id === parseInt(req.params.id, 10));
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const deleted = items.splice(index, 1);
  res.json(deleted[0]);
});

// Helper to reset state for tests
app._resetStore = () => {
  items = [{ id: 1, name: 'Sample Item', description: 'This is a sample item' }];
  nextId = 2;
};

module.exports = app;
