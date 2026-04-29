const request = require('supertest');
const app = require('../src/app');
const log = require('../src/logger');

describe('Observability & Logging Tests (Agent 3)', () => {
  beforeEach(() => {
    app._resetStore();
  });

  const testUser = process.env.AUTH_USER || 'admin';
  const testPass = process.env.AUTH_PASS || 'changeme';
  const auth = Buffer.from(`${testUser}:${testPass}`).toString('base64');

  test('REQ-OBS-03: API requests should generate structured logs', async () => {
    // Trigger an API action
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Basic ${auth}`);

    expect(res.status).toBe(200);

    const recentLogs = log.getRecentLogs(100);

    // Check for the request log (from middleware)
    const reqLog = recentLogs.find(l => l.message === 'GET /api/items');
    expect(reqLog).toBeDefined();
    expect(reqLog.level).toBe('info');

    // Check for the business logic log (from route handler)
    const bizLog = recentLogs.find(l => l.message.includes('Fetching all items'));
    expect(bizLog).toBeDefined();
    expect(bizLog.level).toBe('info');
  });

  test('Failed authentication should log a warning', async () => {
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', 'Basic d3Jvbmc6cGFzcw=='); // wrong:pass

    expect(res.status).toBe(401);

    const recentLogs = log.getRecentLogs(100);
    const authFailLog = recentLogs.find(l =>
      l.level === 'warn' &&
      l.message.includes('Auth failed') &&
      l.meta && l.meta.url === '/api/items'
    );

    expect(authFailLog).toBeDefined();
  });

  test('Creating an item should log the new item details', async () => {
    const itemName = 'ObsTestItem-' + Date.now();
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Basic ${auth}`)
      .send({ name: itemName, description: 'Testing log integrity' });

    expect(res.status).toBe(201);

    const recentLogs = log.getRecentLogs(100);
    const createLog = recentLogs.find(l =>
      l.level === 'info' &&
      l.message.includes('New item added') &&
      l.meta && l.meta.name === itemName
    );

    expect(createLog).toBeDefined();
    expect(createLog.meta.id).toBeDefined();
  });
});
