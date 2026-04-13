const express = require('express');
const { pool, withTransaction } = require('../db');
const { TRANSACTION_TYPES } = require('../transactionTypes');
const {
  asyncRoute, ok, created, badRequest, notFound,
  getFieldType, normalizeValue, valuesAreEqual,
  resolveCategoryNameOrIdToId, buildSetClause,
} = require('../helpers');

const router = express.Router();
const SHARED = TRANSACTION_TYPES.shared;

/* ================================================================== */
/* Shared transactions – bespoke routes kept for API compatibility     */
/* ================================================================== */

/** GET /transactions – field-selection + simple equality filters */
router.get('/transactions', asyncRoute(async (req, res) => {
  const allowed = SHARED.allowedFields;
  const fields = req.query.fields
    ? req.query.fields.split(',').map((f) => f.trim()).filter((f) => allowed.includes(f)).join(', ') || '*'
    : '*';

  const filters = [];
  const values = [];
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== 'fields' && allowed.includes(k)) {
      filters.push(`${k} = $${filters.length + 1}`);
      values.push(v);
    }
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT ${fields} FROM ${SHARED.view} ${where}`, values);
  res.json(rows);
}));

/** PUT /transactions/bulk-update-mark */
router.put('/transactions/bulk-update-mark', asyncRoute(async (req, res) => {
  const { transaction_ids, mark_value, date_from, date_to, filters } = req.body;
  if (mark_value === undefined || mark_value === null) {
    return badRequest(res, 'mark_value is required and must be a boolean (true/false)');
  }
  const markBoolean = Boolean(mark_value);

  const conds = [];
  const params = [];
  const push = (sql, val) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };

  if (Array.isArray(transaction_ids) && transaction_ids.length) {
    push('id = ANY(?::integer[])', transaction_ids.map((id) => parseInt(id, 10)));
  }
  if (date_from) push('date >= ?', date_from);
  if (date_to)   push('date <= ?', date_to);
  if (filters && typeof filters === 'object') {
    for (const [k, v] of Object.entries(filters)) {
      if (SHARED.allowedFields.includes(k) && k !== 'mark') push(`${k} = ?`, v);
    }
  }
  if (!conds.length) {
    return badRequest(res, 'At least one filter condition is required (transaction_ids, date_from, date_to, or filters)');
  }

  const result = await withTransaction(async (client) => {
    const where = conds.join(' AND ');
    const { rows: matching } = await client.query(
      `SELECT id, date, description, amount, mark FROM ${SHARED.table} WHERE ${where}`, params,
    );
    if (!matching.length) return { updated: [], matching, changed: 0 };

    const toChange = matching.filter((t) => t.mark !== markBoolean);
    if (!toChange.length) return { updated: [], matching, changed: 0, optimized: true };

    const { rows: updated } = await client.query(
      `UPDATE ${SHARED.table} SET mark = $${params.length + 1}
        WHERE ${where} AND mark IS DISTINCT FROM $${params.length + 1}
        RETURNING id, date, description, amount, mark`,
      [...params, markBoolean],
    );
    return { updated, matching, changed: updated.length };
  });

  if (!result.matching.length) {
    return res.json({ success: true, message: 'No transactions found matching the specified criteria', updated_count: 0, transactions: [] });
  }
  if (result.optimized) {
    return res.json({
      success: true, updated_count: 0, optimized: true, transactions: result.matching,
      message: `All ${result.matching.length} matching transactions already have mark=${markBoolean}`,
    });
  }
  console.log(`✅ Bulk updated ${result.changed} transactions with mark=${markBoolean}`);
  res.json({
    success: true,
    message: `Successfully updated ${result.changed} transactions`,
    updated_count: result.changed,
    mark_value: markBoolean,
    transactions: result.updated,
    filters_applied: {
      transaction_ids: transaction_ids?.length || 0,
      date_from, date_to,
      additional_filters: filters ? Object.keys(filters).length : 0,
    },
  });
}));

/** POST /transactions – create a shared transaction */
router.post('/transactions', asyncRoute(async (req, res) => {
  const body = req.body;
  const errors = [];
  const valid = {};

  for (const f of ['date', 'description', 'amount']) {
    if (!Object.prototype.hasOwnProperty.call(body, f)) errors.push(`Field "${f}" is required`);
  }

  for (const [k, v] of Object.entries(body)) {
    if (!SHARED.allowedFields.includes(k)) continue;
    const t = getFieldType(k);
    const n = normalizeValue(v, t);
    if (k === 'amount' && n === null) errors.push('Amount must be a valid number');
    else if (k === 'date'  && n === null) errors.push('Invalid date format');
    else if (k === 'mark') valid[k] = n ?? false;
    else valid[k] = n;
  }
  if (errors.length) return res.status(400).json({ success: false, errors });

  const keys = Object.keys(valid);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO ${SHARED.table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    Object.values(valid),
  );
  const { rows: full } = await pool.query(`SELECT * FROM ${SHARED.view} WHERE id = $1`, [rows[0].id]);
  return created(res, full[0], 'Transaction created successfully');
}));

/* ================================================================== */
/* Generic per-type handlers (shared / personal / offset)              */
/* ================================================================== */

function mountTypeRoutes(cfg, paths) {
  /* ---- GET list (simple, no filters) --------------------------- */
  if (paths.list) {
    router.get(paths.list, asyncRoute(async (_req, res) => {
      const { rows } = await pool.query(`SELECT * FROM ${cfg.view} ORDER BY date DESC`);
      res.json(rows);
    }));
  }

  /* ---- POST create (personal / offset only – category lookup) -- */
  if (paths.create) {
    router.post(paths.create, asyncRoute(async (req, res) => {
      const { date, description, amount, category, label } = req.body;
      if (!date || !description || amount === undefined) {
        return res.status(400).json({ success: false, errors: ['Date, description, and amount are required'] });
      }
      const data = await withTransaction(async (client) => {
        const categoryId = await resolveCategoryNameOrIdToId(client, category, cfg.categoryTable);
        const cols = ['date', 'description', 'amount', 'category'];
        const vals = [date, description, amount, categoryId];
        if (cfg.splitExtraColumns.includes('label')) { cols.push('label'); vals.push(label); }
        const ph = cols.map((_, i) => `$${i + 1}`);
        const ins = await client.query(
          `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${ph.join(', ')}) RETURNING id`, vals,
        );
        const full = await client.query(`SELECT * FROM ${cfg.view} WHERE id = $1`, [ins.rows[0].id]);
        return full.rows[0];
      });
      return created(res, data, 'Transaction created successfully');
    }));
  }

  /* ---- PUT /:id – smart diff-based update ---------------------- */
  router.put(paths.update, asyncRoute(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const result = await withTransaction(async (client) => {
      const cur = await client.query(`SELECT * FROM ${cfg.view} WHERE id = $1`, [id]);
      if (!cur.rows.length) return { notFound: true };
      const current = cur.rows[0];

      const validUpdates = {};
      for (const [k, v] of Object.entries(updates)) {
        if (!cfg.updateFields.includes(k)) continue;
        const ftype = getFieldType(k);

        if (k === 'category' && cfg.categoryTable) {
          // Compare names (view exposes names), store ids
          if (!valuesAreEqual(current[k], v, ftype)) {
            validUpdates[k] = await resolveCategoryNameOrIdToId(client, v, cfg.categoryTable);
          }
          continue;
        }

        let processed = normalizeValue(v, ftype);
        if (k === 'mark' && processed === null) processed = false;
        if (!valuesAreEqual(current[k], processed, ftype)) validUpdates[k] = processed;
      }

      if (!Object.keys(validUpdates).length) return { optimized: true, data: current };

      const { clause, values } = buildSetClause(validUpdates);
      values.push(id);
      await client.query(
        `UPDATE ${cfg.table} SET ${clause} WHERE id = $${values.length}`, values,
      );
      const fresh = await client.query(`SELECT * FROM ${cfg.view} WHERE id = $1`, [id]);
      return { data: fresh.rows[0], changedFields: Object.keys(validUpdates) };
    });

    if (result.notFound)  return notFound(res, 'Transaction not found');
    if (result.optimized) return ok(res, result.data, { message: 'No changes detected - transaction not updated', optimized: true });
    return ok(res, result.data, { message: 'Transaction updated successfully', changedFields: result.changedFields });
  }));

  /* ---- POST /split – split into child transactions ------------- */
  router.post(paths.split, asyncRoute(async (req, res) => {
    const { originalTransactionId, remainingAmount, splitTransactions } = req.body;
    if (!originalTransactionId || remainingAmount === undefined || !Array.isArray(splitTransactions)) {
      return badRequest(res, 'Invalid request data. Required: originalTransactionId, remainingAmount, splitTransactions array');
    }

    const out = await withTransaction(async (client) => {
      const orig = await client.query(`SELECT * FROM ${cfg.view} WHERE id = $1`, [originalTransactionId]);
      if (!orig.rows.length) throw Object.assign(new Error('Original transaction not found'), { status: 404 });
      const original = orig.rows[0];
      const originalAmount = parseFloat(original.amount);
      const sign = originalAmount < 0 ? -1 : 1;

      // Validate splits
      const errors = [];
      let splitTotal = 0;
      splitTransactions.forEach((s, i) => {
        for (const rf of cfg.splitRequiredFields) {
          if (!s[rf]) errors.push(`Split #${i + 1}: ${rf} is required`);
        }
        const amt = Math.abs(parseFloat(s.amount));
        if (Number.isNaN(amt) || amt <= 0) errors.push(`Split #${i + 1}: Amount must be a non-zero number`);
        else splitTotal += amt;
      });
      if (errors.length) throw Object.assign(new Error(errors.join('; ')), { status: 400, errors });

      if (cfg.categoryTable) {
        // personal/offset: strict total match
        const total = Math.abs(remainingAmount) + splitTotal;
        if (Math.abs(total - Math.abs(originalAmount)) > 0.01) {
          throw Object.assign(new Error(
            `The total of splits and remaining amount (${total.toFixed(2)}) does not match the original transaction amount (${Math.abs(originalAmount).toFixed(2)})`,
          ), { status: 400 });
        }
      } else if (splitTotal > Math.abs(originalAmount)) {
        // shared: allow partial split, just not over
        throw Object.assign(new Error('Split amounts exceed the original transaction amount'), { status: 400 });
      }

      // Insert children
      const createdRows = [];
      for (const s of splitTransactions) {
        const cols = ['date', 'description', 'amount', 'split_from_id'];
        // personal/offset force sign of original; shared preserves caller-provided sign
        const amt = cfg.categoryTable ? sign * Math.abs(parseFloat(s.amount)) : s.amount;
        const vals = [original.date, s.description, amt, originalTransactionId];

        if (cfg.categoryTable) {
          cols.push('category');
          vals.push(await resolveCategoryNameOrIdToId(client, s.category, cfg.categoryTable));
        } else {
          cols.push('bank_category');
          vals.push(s.bank_category || original.bank_category);
        }
        for (const extra of cfg.splitExtraColumns) {
          if (extra === 'bank_category') continue; // already handled above
          cols.push(extra);
          vals.push(s[extra] !== undefined ? s[extra] : original[extra] ?? (extra === 'mark' ? false : null));
        }

        const ph = cols.map((_, i) => `$${i + 1}`);
        const ins = await client.query(
          `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${ph.join(', ')}) RETURNING *`, vals,
        );
        createdRows.push(ins.rows[0]);
      }

      // Update original: shared uses signed remainingAmount as-is; personal/offset force sign and zero-out when fully split
      let newAmount;
      if (cfg.categoryTable) {
        newAmount = Math.abs(remainingAmount) > 0 ? sign * Math.abs(remainingAmount) : 0;
      } else {
        newAmount = remainingAmount;
      }
      await client.query(
        `UPDATE ${cfg.table} SET amount = $1, has_split = TRUE WHERE id = $2`,
        [newAmount, originalTransactionId],
      );

      return { originalAmount, createdRows, signedRemaining: newAmount };
    });

    // Match legacy response shapes
    if (cfg.categoryTable) {
      return res.json({
        success: true,
        message: 'Transaction split successfully',
        data: {
          originalTransactionId,
          originalAmount: out.originalAmount,
          splitTransactions: out.createdRows,
          remainingAmount: out.signedRemaining,
        },
      });
    }
    return res.json({ success: true, message: 'Transaction split successfully' });
  }));
}

mountTypeRoutes(SHARED, {
  update: '/transactions/:id',
  split:  '/transactions/split',
});
mountTypeRoutes(TRANSACTION_TYPES.personal, {
  list:   '/personal-transactions',
  create: '/personal-transactions',
  update: '/personal-transactions/:id',
  split:  '/personal-transactions/split',
});
mountTypeRoutes(TRANSACTION_TYPES.offset, {
  list:   '/offset-transactions',
  create: '/offset-transactions',
  update: '/offset-transactions/:id',
  split:  '/offset-transactions/split',
});

module.exports = router;
