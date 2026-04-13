const express = require('express');
const { pool } = require('../db');
const {
  asyncRoute, ok, badRequest, parseUserId,
  valuesAreEqual, arraysAreEqual, buildSetClause,
} = require('../helpers');

const router = express.Router();

const ALLOWED = [
  'hide_zero_balance_buckets',
  'enable_negative_offset_bucket',
  'selected_negative_offset_bucket',
  'category_order',
  'auto_distribution_enabled',
  'last_auto_distribution_month',
  'personal_split_enabled',
  'personal_split_default_days',
];

const DEFAULTS = {
  hide_zero_balance_buckets: false,
  enable_negative_offset_bucket: false,
  selected_negative_offset_bucket: null,
  category_order: [],
  auto_distribution_enabled: false,
  last_auto_distribution_month: null,
  personal_split_enabled: false,
  personal_split_default_days: 7,
};

function parseCategoryOrder(row) {
  if (row && typeof row.category_order === 'string') {
    try { row.category_order = JSON.parse(row.category_order); }
    catch { row.category_order = []; }
  }
  return row;
}

/** GET /personal-settings/:userId */
router.get('/personal-settings/:userId', asyncRoute(async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const { rows } = await pool.query('SELECT * FROM personal_settings WHERE user_id = $1', [userId]);
  if (!rows.length) return ok(res, { user_id: userId, ...DEFAULTS });
  ok(res, parseCategoryOrder(rows[0]));
}));

/** PUT /personal-settings/:userId – upsert with diff-skip */
router.put('/personal-settings/:userId', asyncRoute(async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const updates = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM personal_settings WHERE user_id = $1', [userId]);
  const current = existing.length ? parseCategoryOrder({ ...existing[0] }) : null;

  const validUpdates = {};
  for (const [k, v] of Object.entries(updates)) {
    if (!ALLOWED.includes(k)) continue;
    if (k === 'category_order' && Array.isArray(v)) {
      const cur = current ? current.category_order : [];
      if (!arraysAreEqual(cur, v)) validUpdates[k] = JSON.stringify(v);
    } else {
      const cur = current ? current[k] : null;
      if (!valuesAreEqual(cur, v)) validUpdates[k] = v;
    }
  }

  if (!Object.keys(validUpdates).length) {
    return ok(res, current || { user_id: userId, ...DEFAULTS },
      { message: 'No changes detected - settings not updated', optimized: true });
  }

  let row;
  if (!existing.length) {
    const keys = ['user_id', ...Object.keys(validUpdates)];
    const vals = [userId, ...Object.values(validUpdates)];
    const ph = keys.map((_, i) => `$${i + 1}`);
    ({ rows: [row] } = await pool.query(
      `INSERT INTO personal_settings (${keys.join(', ')}) VALUES (${ph.join(', ')}) RETURNING *`, vals,
    ));
  } else {
    const { clause, values } = buildSetClause(validUpdates);
    values.push(userId);
    ({ rows: [row] } = await pool.query(
      `UPDATE personal_settings SET ${clause}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $${values.length} RETURNING *`, values,
    ));
  }

  ok(res, parseCategoryOrder(row), {
    message: existing.length ? 'Personal settings updated successfully' : 'Personal settings created successfully',
    changedFields: Object.keys(validUpdates),
  });
}));

module.exports = router;
