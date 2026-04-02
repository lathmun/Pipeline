const app = require('./app');
const path = require('path');

const PORT = process.env.PORT || 5000;

// Log startup info for debugging deployment issues
console.log(`[startup] __dirname: ${__dirname}`);
console.log(`[startup] cwd: ${process.cwd()}`);
console.log(`[startup] public path: ${path.join(__dirname, '..', 'public')}`);
console.log(`[startup] PORT env: ${process.env.PORT}`);
console.log(`[startup] Using port: ${PORT}`);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
