const express = require('express');
const { pool, withTransaction, withClient } = require('../db');
const {
  asyncRoute, ok, created, badRequest, notFound, parseUserId,
  resolveCategoryNameOrIdToId, buildCategoryNameMap,
  valuesAreEqual, getFieldType, buildSetClause,
} = require('../helpers');

const router = express.Router();
const CAT_TABLE = 'personal_category';
const ALLOWED = ['rule_name', 'amount', 'source_bucket', 'dest_bucket'];

/** GET /auto-distribution-rules/:userId */
router.get('/auto-distribution-rules/:userId', asyncRoute(async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const data = await withClient(async (client) => {
    const [{ rows }, nameMap] = await Promise.all([
      client.query('SELECT * FROM auto_distribution_rules WHERE user_id = $1 ORDER BY id', [userId]),
      buildCategoryNameMap(client, CAT_TABLE),
    ]);
    const resolve = (v) => (v == null ? null : nameMap.get(v) ?? nameMap.get(String(v)) ?? v);
    return rows.map((r) => ({ ...r, source_bucket: resolve(r.source_bucket), dest_bucket: resolve(r.dest_bucket) }));
  });
  ok(res, data);
}));

/** POST /auto-distribution-rules */
router.post('/auto-distribution-rules', asyncRoute(async (req, res) => {
  const { user_id, rule_name, amount, source_bucket, dest_bucket } = req.body;
  if (!user_id || !rule_name) return badRequest(res, 'User ID and rule name are required');

  const row = await withTransaction(async (client) => {
    const srcId = await resolveCategoryNameOrIdToId(client, source_bucket, CAT_TABLE);
    const dstId = await resolveCategoryNameOrIdToId(client, dest_bucket, CAT_TABLE);
    const { rows } = await client.query(
      `INSERT INTO auto_distribution_rules (user_id, rule_name, amount, source_bucket, dest_bucket)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [user_id, rule_name, amount, srcId, dstId],
    );
    return rows[0];
  });
  created(res, row, 'Auto distribution rule created successfully');
}));

/** PUT /auto-distribution-rules/:id */
router.put('/auto-distribution-rules/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const result = await withTransaction(async (client) => {
    const { rows: cur } = await client.query('SELECT * FROM auto_distribution_rules WHERE id = $1', [id]);
    if (!cur.length) return { notFound: true };
    const current = cur[0];

    const validUpdates = {};
    for (const [k, v] of Object.entries(updates)) {
      if (!ALLOWED.includes(k)) continue;
      if (k === 'source_bucket' || k === 'dest_bucket') {
        const bucketId = await resolveCategoryNameOrIdToId(client, v, CAT_TABLE);
        if (!valuesAreEqual(current[k], bucketId)) validUpdates[k] = bucketId;
      } else if (!valuesAreEqual(current[k], v, getFieldType(k))) {
        validUpdates[k] = v;
      }
    }

    if (!Object.keys(validUpdates).length) return { optimized: true, data: current };

    const { clause, values } = buildSetClause(validUpdates);
    values.push(id);
    const { rows } = await client.query(
      `UPDATE auto_distribution_rules SET ${clause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length} RETURNING *`, values,
    );
    return { data: rows[0], changedFields: Object.keys(validUpdates) };
  });

  if (result.notFound)  return notFound(res, 'Auto distribution rule not found');
  if (result.optimized) return ok(res, result.data, { message: 'No changes detected - rule not updated', optimized: true });
  ok(res, result.data, { message: 'Auto distribution rule updated successfully', changedFields: result.changedFields });
}));

/** DELETE /auto-distribution-rules/:id */
router.delete('/auto-distribution-rules/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('DELETE FROM auto_distribution_rules WHERE id = $1 RETURNING *', [req.params.id]);
  if (!rows.length) return notFound(res, 'Auto distribution rule not found');
  ok(res, rows[0], { message: 'Auto distribution rule deleted successfully' });
}));

/** POST /auto-distribution/apply */
router.post('/auto-distribution/apply', asyncRoute(async (req, res) => {
  const { user_id, month_year } = req.body;
  const userId = parseInt(user_id, 10);
  if (!userId || Number.isNaN(userId)) return badRequest(res, 'Valid numeric User ID is required');

  const out = await withTransaction(async (client) => {
    const [{ rows: rules }, nameMap] = await Promise.all([
      client.query(
        'SELECT id, rule_name, amount, source_bucket, dest_bucket FROM auto_distribution_rules WHERE user_id = $1 ORDER BY id',
        [userId],
      ),
      buildCategoryNameMap(client, CAT_TABLE),
    ]);
    if (!rules.length) return { empty: true };

    const now = new Date();
    const monthYearStr = month_year || `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
    const today = now.toISOString().split('T')[0];
    const resolveName = (v) => nameMap.get(v) ?? nameMap.get(String(v)) ?? v;

    // Build bulk insert rows + track results
    const txnRows = [];
    const createdMeta = [];
    let failureCount = 0;
    for (const r of rules) {
      let srcId, dstId;
      try {
        srcId = await resolveCategoryNameOrIdToId(client, r.source_bucket, CAT_TABLE);
        dstId = await resolveCategoryNameOrIdToId(client, r.dest_bucket, CAT_TABLE);
      } catch { failureCount++; continue; }
      if (srcId == null || dstId == null || !r.amount || r.amount <= 0) { failureCount++; continue; }

      const desc = `${r.rule_name || 'Monthly Budget Distribution'} - ${monthYearStr}`;
      const abs = Math.abs(r.amount);
      txnRows.push([today, desc, -abs, srcId], [today, desc, abs, dstId]);
      createdMeta.push({
        rule_id: r.id, rule_name: r.rule_name, amount: r.amount,
        source_category: resolveName(r.source_bucket),
        dest_category: resolveName(r.dest_bucket),
      });
    }

    let createdTransactions = [];
    if (txnRows.length) {
      // Single bulk INSERT for all debit/credit pairs
      const ph = txnRows.map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`).join(',');
      const { rows: inserted } = await client.query(
        `INSERT INTO personal_transactions (date, description, amount, category)
         VALUES ${ph} RETURNING id`,
        txnRows.flat(),
      );
      // Pair returned ids with metadata (every 2 rows = 1 rule)
      createdTransactions = createdMeta.map((m, i) => ({
        ...m,
        source_transaction_id: inserted[i * 2].id,
        dest_transaction_id: inserted[i * 2 + 1].id,
      }));
    }

    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const { rows: s } = await client.query('SELECT 1 FROM personal_settings WHERE user_id = $1', [userId]);
    if (s.length) {
      await client.query('UPDATE personal_settings SET last_auto_distribution_month = $1 WHERE user_id = $2',
        [currentMonthKey, userId]);
    } else {
      await client.query('INSERT INTO personal_settings (user_id, last_auto_distribution_month) VALUES ($1,$2)',
        [userId, currentMonthKey]);
    }

    return {
      appliedCount: createdTransactions.length,
      failedCount: failureCount,
      createdTransactions,
      monthYear: monthYearStr,
      lastDistributionMonth: currentMonthKey,
    };
  });

  if (out.empty) return res.json({ success: true, message: 'No auto distribution rules found', appliedCount: 0 });
  res.json({
    success: true,
    message: `Auto distribution completed: ${out.appliedCount} rules applied successfully, ${out.failedCount} failed`,
    data: out,
  });
}));

module.exports = router;
