const request = require('supertest');
const app = require('../src/app');

// Use env vars for test credentials (same ones set in .env)
const testUser = process.env.AUTH_USER || 'admin';
const testPass = process.env.AUTH_PASS || 'changeme';
const AUTH = 'Basic ' + Buffer.from(`${testUser}:${testPass}`).toString('base64');
const BAD_AUTH = 'Basic ' + Buffer.from('wrong:wrong').toString('base64');

beforeEach(() => {
  app._resetStore();
});

describe('Authentication', () => {
  test('rejects requests without auth header', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('AUTH_MISSING');
    expect(res.body.message).toBeDefined();
  });

  test('rejects requests with invalid credentials', async () => {
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', BAD_AUTH);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('AUTH_INVALID');
    expect(res.body.message).toBeDefined();
  });
});

describe('GET /api/items', () => {
  test('returns all items', async () => {
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Sample Item');
  });
});

describe('GET /api/items/:id', () => {
  test('returns a single item', async () => {
    const res = await request(app)
      .get('/api/items/1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Sample Item');
  });

  test('returns 404 for non-existent item', async () => {
    const res = await request(app)
      .get('/api/items/999')
      .set('Authorization', AUTH);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.message).toBeDefined();
  });
});

describe('POST /api/items', () => {
  test('creates a new item', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', AUTH)
      .send({ name: 'New Item', description: 'A new item' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(2);
    expect(res.body.name).toBe('New Item');
  });

  test('rejects item without name', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', AUTH)
      .send({ description: 'Missing name' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBeDefined();
  });
});

describe('PUT /api/items/:id', () => {
  test('updates an existing item', async () => {
    const res = await request(app)
      .put('/api/items/1')
      .set('Authorization', AUTH)
      .send({ name: 'Updated Item' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Item');
  });

  test('returns 404 for non-existent item', async () => {
    const res = await request(app)
      .put('/api/items/999')
      .set('Authorization', AUTH)
      .send({ name: 'Nope' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/items/:id', () => {
  test('deletes an existing item', async () => {
    const res = await request(app)
      .delete('/api/items/1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Sample Item');

    const check = await request(app)
      .get('/api/items')
      .set('Authorization', AUTH);
    expect(check.body).toHaveLength(0);
  });

  test('returns 404 for non-existent item', async () => {
    const res = await request(app)
      .delete('/api/items/999')
      .set('Authorization', AUTH);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('GET /health', () => {
  test('returns health status without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});
