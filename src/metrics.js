// --- Metrics Collector ---
// Tracks in-memory request stats for the admin dashboard.
// All counters reset if the process restarts (this is intentional —
// persistent metrics would go to Grafana via the logger).
//
// Tracks:
//   - Total requests, grouped by method
//   - Status code distribution (2xx, 3xx, 4xx, 5xx)
//   - Auth failures (401s)
//   - Response times (average, min, max, p95)
//   - Requests per route (top 20)
//   - Requests per minute (rolling 5-minute window)

class Metrics {
  constructor() {
    this.startedAt = new Date().toISOString();
    this.totalRequests = 0;

    // By method: { GET: 0, POST: 0, ... }
    this.byMethod = {};

    // By status group: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }
    this.byStatus = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };

    // Auth failures counter
    this.authFailures = 0;

    // Response times (ms)
    this._responseTimes = [];
    this._maxTimeSamples = 1000; // keep last 1000 for p95 calc

    // Route hits: { 'GET /api/items': 12, ... }
    this.byRoute = {};

    // Rolling per-minute counters (last 5 minutes)
    this._minuteBuckets = [];
    this._minuteInterval = setInterval(() => this._rotateBuckets(), 60000);
    if (this._minuteInterval.unref) this._minuteInterval.unref();
    this._currentMinuteCount = 0;
  }

  // Called by middleware on every response
  record(req, res, durationMs) {
    this.totalRequests++;

    // Method
    const method = req.method;
    this.byMethod[method] = (this.byMethod[method] || 0) + 1;

    // Status group
    const code = res.statusCode;
    if (code >= 200 && code < 300) this.byStatus['2xx']++;
    else if (code >= 300 && code < 400) this.byStatus['3xx']++;
    else if (code >= 400 && code < 500) this.byStatus['4xx']++;
    else if (code >= 500) this.byStatus['5xx']++;

    // Auth failures
    if (code === 401) this.authFailures++;

    // Response time
    this._responseTimes.push(durationMs);
    if (this._responseTimes.length > this._maxTimeSamples) {
      this._responseTimes.shift();
    }

    // Route hits
    const route = `${method} ${req.route ? req.route.path : req.path}`;
    this.byRoute[route] = (this.byRoute[route] || 0) + 1;

    // Per-minute counter
    this._currentMinuteCount++;
  }

  // Get a snapshot of all metrics as a plain object
  snapshot() {
    const times = this._responseTimes;
    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0;
    const min = sorted.length ? sorted[0] : 0;
    const max = sorted.length ? sorted[sorted.length - 1] : 0;
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;

    // Top 20 routes by hit count
    const topRoutes = Object.entries(this.byRoute)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([route, count]) => ({ route, count }));

    // Requests per minute (rolling 5-min window)
    const rpm = this._minuteBuckets.length
      ? Math.round(this._minuteBuckets.reduce((s, c) => s + c, 0) / this._minuteBuckets.length)
      : this._currentMinuteCount;

    return {
      startedAt: this.startedAt,
      uptime: Math.floor(process.uptime()),
      totalRequests: this.totalRequests,
      byMethod: { ...this.byMethod },
      byStatus: { ...this.byStatus },
      authFailures: this.authFailures,
      responseTimes: { avg, min, max, p95, samples: times.length },
      topRoutes,
      requestsPerMinute: rpm,
    };
  }

  // Reset all counters (useful for tests)
  reset() {
    this.totalRequests = 0;
    this.byMethod = {};
    this.byStatus = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    this.authFailures = 0;
    this._responseTimes = [];
    this.byRoute = {};
    this._minuteBuckets = [];
    this._currentMinuteCount = 0;
  }

  _rotateBuckets() {
    this._minuteBuckets.push(this._currentMinuteCount);
    this._currentMinuteCount = 0;
    // Keep only last 5 minutes
    if (this._minuteBuckets.length > 5) {
      this._minuteBuckets.shift();
    }
  }
}

// Singleton
module.exports = new Metrics();
