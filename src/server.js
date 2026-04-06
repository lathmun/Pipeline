const app = require('./app');
const path = require('path');
const log = require('./logger');

const PORT = process.env.PORT || 5050;

// Log startup info for debugging deployment issues
log.debug('Starting server', {
  dirname: __dirname,
  cwd: process.cwd(),
  publicPath: path.join(__dirname, '..', 'public'),
  portEnv: process.env.PORT,
  port: PORT,
  authUser: process.env.AUTH_USER ? 'set' : 'NOT SET (using fallback)',
  authPass: process.env.AUTH_PASS ? 'set' : 'NOT SET (using fallback)',
});

app.listen(PORT, () => {
  log.info(`Server running on http://localhost:${PORT}`);
});
