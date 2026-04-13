/**
 * Finance Splitter API – entry point.
 *
 * The original 5 200-line monolith has been split into focused modules under
 * ./src.  This file is now just wiring: middleware, route mounting and the
 * start-up migrations that previously lived inline.
 *
 * All route paths and response shapes are preserved, so no changes are
 * required in the web / mobile clients.  The legacy file lives on at
 * index.legacy.js for reference.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { runMigrations } = require('./src/migrations');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

/* ---- Route modules (all mounted at root for API compatibility) ---- */
/* Order matters only where paths collide; specific routes come first.  */
app.use(require('./src/routes/lookups'));
app.use(require('./src/routes/initialData'));
app.use(require('./src/routes/bankFeeds'));
app.use(require('./src/routes/budgets'));
app.use(require('./src/routes/personalSettings'));
app.use(require('./src/routes/personalSplitGroups'));
app.use(require('./src/routes/autoDistribution'));
app.use(require('./src/routes/userPreferences'));
app.use(require('./src/routes/sharedFilter'));
app.use(require('./src/routes/splitConfig'));    // /transactions/:id/split-config etc.
app.use(require('./src/routes/transactions'));   // /transactions, /personal-transactions, /offset-transactions

app.get('/', (_req, res) => {
  res.send('Welcome to the Finance Dashboard API! Use /transactions to get transaction data and ?column_name= to filter available data.');
});

/* ---- Start-up --------------------------------------------------- */
runMigrations();

app.listen(port, '0.0.0.0', () => {
  function getFrontendBaseUrl() {
    try {
      const cfgPath = path.join(__dirname, '../frontend/src/config/apiConfig.js');
      const m = fs.readFileSync(cfgPath, 'utf8').match(/BASE_URL:\s*['"`](.*?)['"`]/);
      if (m?.[1]) return m[1];
    } catch (_) { /* fall through */ }
    return `http://0.0.0.0:${port}`;
  }
  console.log(`✅ Server running on ${getFrontendBaseUrl()}`);
});
