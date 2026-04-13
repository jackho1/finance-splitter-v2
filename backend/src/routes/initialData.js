const express = require('express');
const { withClient } = require('../db');
const { getTypeCache } = require('../transactionTypes');
const { USERS_WITH_PREFS, SPLIT_ALLOCATIONS_BY_TYPE } = require('../queries');
const {
  asyncRoute, ok, parseUserId,
  formatUserColors, groupAllocationsByTransaction, buildCategoryNameMap,
} = require('../helpers');

const router = express.Router();

/* ================================================================== */
/* GET /initial-data – shared transactions bundle                     */
/* ================================================================== */
router.get('/initial-data', asyncRoute(async (_req, res) => {
  const data = await withClient(async (client) => {
    const cache = await getTypeCache(client);
    const sharedTypeId = cache.transactionTypesByCode.get('shared')?.id || 1;

    const [cats, txns, labelsRes, usersRes, allocRes] = await Promise.all([
      client.query('SELECT * FROM shared_category ORDER BY bank_category'),
      client.query('SELECT * FROM shared_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM users'),
      client.query(USERS_WITH_PREFS),
      client.query(SPLIT_ALLOCATIONS_BY_TYPE, [sharedTypeId]),
    ]);

    const categoryMappings = {};
    const bankCategories = [];
    for (const r of cats.rows) {
      categoryMappings[r.bank_category] = r.category;
      bankCategories.push(r.bank_category);
    }
    bankCategories.push(null);

    return {
      transactions: txns.rows,
      categoryMappings,
      labels: labelsRes.rows.map((r) => r.label),
      bankCategories,
      users: usersRes.rows.map(formatUserColors),
      splitAllocations: groupAllocationsByTransaction(allocRes.rows),
    };
  });
  console.log(`Successfully fetched all initial data: ${data.transactions.length} transactions, ${Object.keys(data.categoryMappings).length} mappings, ${data.labels.length} labels, ${data.bankCategories.length} bank categories, ${data.users.length} users, ${Object.keys(data.splitAllocations).length} transactions with split allocations`);
  ok(res, data);
}));

/* ================================================================== */
/* GET /personal-initial-data/:userId                                  */
/* ================================================================== */
router.get('/personal-initial-data/:userId', asyncRoute(async (req, res) => {
  const userId = parseUserId(req.params.userId);

  const data = await withClient(async (client) => {
    const [txns, cats, rules, settings] = await Promise.all([
      client.query('SELECT * FROM personal_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM personal_category ORDER BY category'),
      client.query('SELECT * FROM auto_distribution_rules WHERE user_id = $1 ORDER BY id', [userId]),
      client.query('SELECT * FROM personal_settings WHERE user_id = $1', [userId]),
    ]);

    // Resolve category ids -> names with a single lookup map (avoids N+1)
    const nameMap = await buildCategoryNameMap(client, 'personal_category');
    const resolve = (v) => (v == null ? null : nameMap.get(v) ?? nameMap.get(String(v)) ?? v);
    const rulesWithNames = rules.rows.map((r) => ({
      ...r,
      source_bucket: resolve(r.source_bucket),
      dest_bucket: resolve(r.dest_bucket),
    }));

    return {
      personalTransactions: txns.rows,
      personalCategories: cats.rows,
      autoDistributionRules: rulesWithNames,
      personalSettings: settings.rows[0] || {},
    };
  });
  console.log(`Successfully fetched personal data: ${data.personalTransactions.length} transactions, ${data.personalCategories.length} categories, ${data.autoDistributionRules.length} rules`);
  ok(res, data);
}));

/* ================================================================== */
/* GET /offset-initial-data                                            */
/* ================================================================== */
router.get('/offset-initial-data', asyncRoute(async (_req, res) => {
  const data = await withClient(async (client) => {
    const cache = await getTypeCache(client);
    const offsetTypeId = cache.transactionTypesByCode.get('offset')?.id || null;

    const [txns, cats, labelsRes, usersRes, allocRes] = await Promise.all([
      client.query('SELECT * FROM offset_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM offset_category ORDER BY category'),
      client.query('SELECT * FROM users'),
      client.query(USERS_WITH_PREFS),
      offsetTypeId ? client.query(SPLIT_ALLOCATIONS_BY_TYPE, [offsetTypeId]) : { rows: [] },
    ]);

    return {
      offsetTransactions: txns.rows,
      offsetCategories: cats.rows.map((c) => c.category),
      labels: labelsRes.rows.map((r) => r.label),
      users: usersRes.rows.map(formatUserColors),
      splitAllocations: groupAllocationsByTransaction(allocRes.rows),
    };
  });
  console.log(`Successfully fetched offset data: ${data.offsetTransactions.length} transactions, ${data.offsetCategories.length} categories, ${data.users.length} users, ${Object.keys(data.splitAllocations).length} transactions with split allocations`);
  ok(res, data);
}));

/* ================================================================== */
/* GET /budget-initial-data                                            */
/* ================================================================== */
router.get('/budget-initial-data', asyncRoute(async (_req, res) => {
  const data = await withClient(async (client) => {
    const [budgets, txns, cats] = await Promise.all([
      client.query('SELECT * FROM budget_category ORDER BY category'),
      client.query('SELECT * FROM shared_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM shared_category ORDER BY bank_category'),
    ]);
    const categoryMappings = {};
    for (const r of cats.rows) categoryMappings[r.bank_category] = r.category;
    return { budgetCategories: budgets.rows, transactions: txns.rows, categoryMappings };
  });
  console.log(`Successfully fetched budget data: ${data.budgetCategories.length} budget categories, ${data.transactions.length} transactions`);
  ok(res, data);
}));

module.exports = router;
