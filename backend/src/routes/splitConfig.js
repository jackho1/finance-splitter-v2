const express = require('express');
const { withTransaction, withClient } = require('../db');
const { getTypeCache } = require('../transactionTypes');
const {
  asyncRoute, ok, badRequest, notFound,
  calculateSplitAllocations, validateSplitAllocations, buildBulkInsert,
} = require('../helpers');

const router = express.Router();

/** Load transaction + type metadata, throwing {status:...} errors on failure. */
async function resolveTransaction(client, id, typeCode) {
  const cache = await getTypeCache(client);
  const tt = cache.transactionTypesByCode.get(typeCode);
  if (!tt) throw Object.assign(new Error(`Invalid transaction type: ${typeCode}`), { status: 400 });
  if (!tt.table_name) throw Object.assign(new Error(`No table name configured for transaction type: ${typeCode}`), { status: 400 });

  const { rows } = await client.query(`SELECT * FROM ${tt.table_name} WHERE id = $1`, [id]);
  if (!rows.length) throw Object.assign(new Error(`Transaction not found in ${tt.table_name}`), { status: 404 });
  return { table: tt.table_name, transaction: rows[0], transactionType: tt, cache };
}

/** Produce legacy label-based allocation data for shared transactions lacking a config. */
async function buildLegacyFallback(client, txn) {
  if (!txn.label) return null;
  const labels = txn.label === 'Both' ? ['Ruby', 'Jack'] : [txn.label];
  if (!['Ruby', 'Jack'].includes(labels[0]) && txn.label !== 'Both') return null;

  const { rows } = await client.query(
    'SELECT id, username, display_name FROM users WHERE username = ANY($1)', [labels],
  );
  if (!rows.length) return null;

  const amount = parseFloat(txn.amount);
  const share = amount / rows.length;
  const pct = 100 / rows.length;
  return {
    users: rows,
    allocations: rows.map((u) => ({
      user_id: u.id, username: u.username, display_name: u.display_name,
      amount: share, percentage: pct, is_paid: false, legacy_mode: true,
    })),
    original_label: txn.label,
  };
}

/** Bulk-insert allocations in one round-trip and join with user info. */
async function insertAllocations(client, splitId, allocations, userMap) {
  const rows = allocations.map((a) => ({ split_id: splitId, user_id: a.user_id, amount: a.amount, percentage: a.percentage }));
  const { columns, placeholders, values } = buildBulkInsert(['split_id', 'user_id', 'amount', 'percentage'], rows);
  const { rows: inserted } = await client.query(
    `INSERT INTO transaction_split_allocations (${columns}) VALUES ${placeholders} RETURNING *`, values,
  );
  return inserted.map((r) => ({ ...r, ...(userMap.get(r.user_id) || {}) }));
}

/** Validate requested users are active; returns [rows, mapById]. */
async function validateUsers(client, users) {
  const ids = users.map((u) => u.id);
  const { rows } = await client.query(
    'SELECT id, username, display_name FROM users WHERE id = ANY($1) AND is_active = true', [ids],
  );
  if (rows.length !== users.length) {
    throw Object.assign(new Error('One or more specified users not found or inactive'), { status: 400 });
  }
  return [rows, new Map(rows.map((u) => [u.id, { username: u.username, display_name: u.display_name }]))];
}

/* ---- GET /transactions/:id/split-config -------------------------- */

router.get('/transactions/:id/split-config', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { transaction_type } = req.query;
  if (!transaction_type) return badRequest(res, 'transaction_type query parameter is required (shared, personal, or offset)');

  const data = await withClient(async (client) => {
    const { table, transaction, transactionType } = await resolveTransaction(client, id, transaction_type);
    const { rows } = await client.query(`
      SELECT tsc.*, st.code AS split_type_code, st.label AS split_type_label,
             tt.code AS transaction_type_code, tt.label AS transaction_type_label
        FROM transaction_split_configs tsc
        JOIN split_types st ON tsc.split_type_id = st.id
        JOIN transaction_types tt ON tsc.transaction_type_id = tt.id
       WHERE tsc.transaction_id = $1 AND tsc.transaction_type_id = $2`,
      [id, transactionType.id],
    );

    if (!rows.length) {
      let legacy_data = null;
      if (transaction_type === 'shared') {
        const legacy = await buildLegacyFallback(client, transaction);
        if (legacy) {
          legacy_data = {
            legacy_mode: true, original_label: legacy.original_label,
            split_type: 'equal', users: legacy.users, estimated_allocations: legacy.allocations,
          };
        }
      }
      return { empty: true, legacy_data };
    }
    return { config: rows[0], transaction, table_used: table };
  });

  if (data.empty) {
    return res.json({ success: true, data: null, message: 'No split configuration found for this transaction', legacy_data: data.legacy_data });
  }
  ok(res, data);
}));

/* ---- GET /transactions/:id/allocations --------------------------- */

router.get('/transactions/:id/allocations', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { transaction_type } = req.query;
  if (!transaction_type) return badRequest(res, 'transaction_type query parameter is required (shared, personal, or offset)');

  const out = await withClient(async (client) => {
    const { table, transaction, transactionType } = await resolveTransaction(client, id, transaction_type);
    const { rows } = await client.query(`
      SELECT tsa.*, u.username, u.display_name,
             tsc.id AS config_id, st.code AS split_type_code, st.label AS split_type_label
        FROM transaction_split_allocations tsa
        JOIN transaction_split_configs tsc ON tsa.split_id = tsc.id
        JOIN split_types st ON tsc.split_type_id = st.id
        JOIN users u ON tsa.user_id = u.id
       WHERE tsc.transaction_id = $1 AND tsc.transaction_type_id = $2
       ORDER BY u.display_name, u.username`,
      [id, transactionType.id],
    );

    if (!rows.length) {
      let legacyAllocations = null;
      if (transaction_type === 'shared') {
        const legacy = await buildLegacyFallback(client, transaction);
        if (legacy) legacyAllocations = legacy.allocations;
      }
      return {
        data: legacyAllocations || [], legacy_mode: !!legacyAllocations,
        transaction, table_used: table,
        message: legacyAllocations ? 'Showing legacy label-based allocation data' : 'No split allocations found for this transaction',
      };
    }
    return {
      data: rows, count: rows.length, transaction, table_used: table,
      total_allocated: rows.reduce((s, a) => s + parseFloat(a.amount), 0),
    };
  });

  res.json({ success: true, ...out });
}));

/* ---- POST / PUT /transactions/:id/split-config ------------------- */

async function upsertSplitConfig(req, res, mode) {
  const { id } = req.params;
  const { transaction_type, split_type_code, users, created_by } = req.body;

  if (!transaction_type || !Array.isArray(users)) {
    return badRequest(res, `${mode === 'create' ? 'transaction_type, split_type_code,' : 'transaction_type'} and users array are required`);
  }
  if (mode === 'create' && !split_type_code) return badRequest(res, 'split_type_code is required');
  if (mode === 'create' && !users.length)   return badRequest(res, 'At least one user must be specified for split allocation');

  const result = await withTransaction(async (client) => {
    const { table, transaction, transactionType, cache } = await resolveTransaction(client, id, transaction_type);

    const { rows: existing } = await client.query(`
      SELECT tsc.*, st.code AS split_type_code
        FROM transaction_split_configs tsc
        JOIN split_types st ON tsc.split_type_id = st.id
       WHERE tsc.transaction_id = $1 AND tsc.transaction_type_id = $2`,
      [id, transactionType.id],
    );

    if (mode === 'create' && existing.length) {
      throw Object.assign(new Error('Split configuration already exists for this transaction'), { status: 409 });
    }
    if (mode === 'update' && !existing.length) {
      throw Object.assign(new Error('Split configuration not found for this transaction'), { status: 404 });
    }

    const effectiveCode = split_type_code || existing[0]?.split_type_code;
    const splitType = cache.splitTypesByCode.get(effectiveCode);
    if (!splitType) throw Object.assign(new Error(`Invalid split type: ${effectiveCode}`), { status: 400 });

    const [, userMap] = await validateUsers(client, users);
    const allocations = calculateSplitAllocations(parseFloat(transaction.amount), splitType, users);
    validateSplitAllocations(allocations, parseFloat(transaction.amount));

    let configRow;
    if (mode === 'create') {
      ({ rows: [configRow] } = await client.query(
        `INSERT INTO transaction_split_configs (transaction_id, transaction_type_id, split_type_id, created_by)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [id, transactionType.id, splitType.id, created_by || null],
      ));
    } else {
      configRow = { ...existing[0], split_type_id: splitType.id };
      if (split_type_code && split_type_code !== existing[0].split_type_code) {
        await client.query(
          'UPDATE transaction_split_configs SET split_type_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [splitType.id, existing[0].id],
        );
      }
      await client.query('DELETE FROM transaction_split_allocations WHERE split_id = $1', [existing[0].id]);
    }

    const createdAllocs = await insertAllocations(client, configRow.id, allocations, userMap);

    console.log(`✅ ${mode === 'create' ? 'Created' : 'Updated'} split configuration for ${transaction_type} transaction ${id} with ${users.length} allocations using ${effectiveCode} split type (table: ${table})`);
    return { config: configRow, allocations: createdAllocs, transaction, split_type: splitType, table_used: table };
  });

  const payload = { success: true, data: result, message: `Split configuration ${mode === 'create' ? 'created' : 'updated'} successfully` };
  return mode === 'create' ? res.status(201).json(payload) : res.json(payload);
}

router.post('/transactions/:id/split-config', asyncRoute((req, res) => upsertSplitConfig(req, res, 'create')));
router.put('/transactions/:id/split-config',  asyncRoute((req, res) => upsertSplitConfig(req, res, 'update')));

/* ---- DELETE /transactions/:id/split-config ----------------------- */

router.delete('/transactions/:id/split-config', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { transaction_type } = req.query;
  const { deleted_by } = req.body || {};
  if (!transaction_type) return badRequest(res, 'transaction_type query parameter is required');

  const out = await withTransaction(async (client) => {
    const { table, transaction, transactionType } = await resolveTransaction(client, id, transaction_type);
    const { rows } = await client.query(`
      SELECT tsc.*,
             json_agg(json_build_object(
               'allocation_id', tsa.id, 'user_id', tsa.user_id, 'amount', tsa.amount,
               'percentage', tsa.percentage, 'is_paid', tsa.is_paid, 'paid_date', tsa.paid_date,
               'notes', tsa.notes, 'username', u.username, 'display_name', u.display_name
             )) AS allocations
        FROM transaction_split_configs tsc
        LEFT JOIN transaction_split_allocations tsa ON tsc.id = tsa.split_id
        LEFT JOIN users u ON tsa.user_id = u.id
       WHERE tsc.transaction_id = $1 AND tsc.transaction_type_id = $2
       GROUP BY tsc.id`,
      [id, transactionType.id],
    );
    if (!rows.length) throw Object.assign(new Error('Split configuration not found for this transaction'), { status: 404 });
    const cfg = rows[0];

    await client.query(
      `INSERT INTO transaction_split_audit
         (action, transaction_id, transaction_type, split_config_id, split_data, deleted_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['DELETE', id, transaction_type, cfg.id,
        JSON.stringify({ config: cfg, allocations: cfg.allocations, transaction, table_used: table }),
        deleted_by || null],
    );
    await client.query('DELETE FROM transaction_split_allocations WHERE split_id = $1', [cfg.id]);
    await client.query('DELETE FROM transaction_split_configs WHERE id = $1', [cfg.id]);

    console.log(`✅ Deleted split configuration for ${transaction_type} transaction ${id} with audit trail (table: ${table})`);
    return { audit_id: cfg.id, count: (cfg.allocations || []).length, table_used: table };
  });

  res.json({
    success: true, message: 'Split configuration deleted successfully',
    audit_id: out.audit_id, deleted_allocations_count: out.count, table_used: out.table_used,
  });
}));

/* ---- PUT /transactions/:id/allocations/:allocation_id/payment ---- */

router.put('/transactions/:id/allocations/:allocation_id/payment', asyncRoute(async (req, res) => {
  const { id, allocation_id } = req.params;
  const { is_paid, paid_date, notes } = req.body;
  if (is_paid === undefined || is_paid === null) return badRequest(res, 'is_paid field is required');

  const data = await withTransaction(async (client) => {
    const { rows } = await client.query(`
      SELECT tsa.*, tsc.transaction_id, u.username, u.display_name,
             tt.code AS transaction_type_code, tt.table_name
        FROM transaction_split_allocations tsa
        JOIN transaction_split_configs tsc ON tsa.split_id = tsc.id
        JOIN transaction_types tt ON tsc.transaction_type_id = tt.id
        JOIN users u ON tsa.user_id = u.id
       WHERE tsa.id = $1 AND tsc.transaction_id = $2`,
      [allocation_id, id],
    );
    if (!rows.length) throw Object.assign(new Error('Allocation not found for this transaction'), { status: 404 });
    const cur = rows[0];

    const { rows: [upd] } = await client.query(
      `UPDATE transaction_split_allocations SET is_paid = $1, paid_date = $2, notes = $3
        WHERE id = $4 RETURNING *`,
      [is_paid, is_paid ? (paid_date || new Date().toISOString()) : null, notes || cur.notes, allocation_id],
    );
    console.log(`✅ Updated payment status for allocation ${allocation_id} to ${is_paid ? 'paid' : 'unpaid'} (transaction: ${cur.transaction_type_code} ${id})`);
    return { ...upd, username: cur.username, display_name: cur.display_name, transaction_type_code: cur.transaction_type_code, table_used: cur.table_name };
  });

  ok(res, data, { message: `Allocation marked as ${is_paid ? 'paid' : 'unpaid'} successfully` });
}));

module.exports = router;
