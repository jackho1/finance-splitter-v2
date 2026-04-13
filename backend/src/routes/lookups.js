const express = require('express');
const { pool } = require('../db');
const { asyncRoute, ok } = require('../helpers');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Simple list endpoints                                               */
/* ------------------------------------------------------------------ */

router.get('/users', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, display_name, email, is_active, created_at, preferences, metadata
       FROM users WHERE is_active = true ORDER BY display_name, username`,
  );
  ok(res, rows, { count: rows.length });
}));

router.get('/split-types', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM split_types ORDER BY is_default DESC, id');
  ok(res, rows);
}));

router.get('/transaction-types', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM transaction_types ORDER BY is_default DESC, id');
  ok(res, rows);
}));

router.get('/personal-categories', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM personal_category ORDER BY category');
  res.json(rows);
}));

router.get('/offset-categories', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM offset_category ORDER BY category');
  res.json(rows);
}));

router.get('/budget-categories-with-budgets', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, category, budget FROM budget_category ORDER BY category');
  res.json(rows);
}));

router.get('/budget-categories', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT DISTINCT category FROM budget_category WHERE category IS NOT NULL ORDER BY category',
  );
  ok(res, rows.map((r) => r.category));
}));

/* ------------------------------------------------------------------ */
/* Derived / computed lookups                                          */
/* ------------------------------------------------------------------ */

router.get('/labels', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT DISTINCT label FROM shared_transactions_generalized
    ORDER BY CASE WHEN label='Ruby' THEN 1 WHEN label='Jack' THEN 2 WHEN label='Both' THEN 3 ELSE 4 END`);
  res.json(rows.map((r) => r.label).filter((l) => l != null));
}));

router.get('/category-mappings', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT DISTINCT bank_category, category FROM shared_transactions_generalized
     WHERE bank_category IS NOT NULL AND category IS NOT NULL ORDER BY bank_category`);
  const map = {};
  for (const r of rows) map[r.bank_category] = r.category;
  res.json(map);
}));

router.get('/bank-categories', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT DISTINCT bank_category FROM shared_transactions_generalized WHERE bank_category IS NOT NULL ORDER BY bank_category',
  );
  const list = rows.map((r) => r.bank_category);
  list.push(null);
  res.json(list);
}));

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

router.get('/balance-subtraction', (_req, res) => {
  res.json({ amount: parseFloat(process.env.SUBTRACTION || 0) });
});

module.exports = router;
