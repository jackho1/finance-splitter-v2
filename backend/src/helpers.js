/* ------------------------------------------------------------------ */
/* Field normalisation & comparison                                   */
/* ------------------------------------------------------------------ */

const FIELD_TYPES = {
  amount: 'number',
  budget: 'number',
  date: 'date',
  mark: 'boolean',
  has_split: 'boolean',
  is_active: 'boolean',
};

const getFieldType = (field) => FIELD_TYPES[field] || 'string';

function normalizeValue(value, fieldType = 'string') {
  if (value === null || value === undefined || value === '') return null;
  switch (fieldType) {
    case 'number': {
      const n = parseFloat(value);
      return Number.isNaN(n) ? null : n;
    }
    case 'date': {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
      return Boolean(value);
    default:
      return typeof value === 'string' ? value.trim() || null : value;
  }
}

function valuesAreEqual(a, b, fieldType = 'string') {
  const na = normalizeValue(a, fieldType);
  const nb = normalizeValue(b, fieldType);
  if (na === null && nb === null) return true;
  if ((na === null) !== (nb === null)) return false;
  return na === nb;
}

function arraysAreEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

/** Wrap an async route handler so uncaught errors become a JSON response. */
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[${req.method} ${req.path}]`, err);
    if (res.headersSent) return;
    const status = err.status || 500;
    const payload = status === 500
      ? { success: false, error: 'Server error', details: err.message }
      : { success: false, error: err.message };
    if (err.errors) payload.errors = err.errors;
    res.status(status).json(payload);
  });

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const created = (res, data, message) => res.status(201).json({ success: true, data, message });
const badRequest = (res, error) => res.status(400).json({ success: false, error });
const notFound = (res, error) => res.status(404).json({ success: false, error });

/* ------------------------------------------------------------------ */
/* Request parsing                                                     */
/* ------------------------------------------------------------------ */

/** Parse a user-id path/query param, treating 'default'/invalid as 1. */
function parseUserId(raw) {
  if (!raw || raw === 'default') return 1;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 1 : n;
}

/* ------------------------------------------------------------------ */
/* Category resolution                                                 */
/* ------------------------------------------------------------------ */

/** Resolve a category name or ID to its integer ID. Returns null for empty input. */
async function resolveCategoryNameOrIdToId(client, value, table) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(value)) return parseInt(value, 10);
  const { rows } = await client.query(`SELECT id FROM ${table} WHERE category = $1`, [value]);
  if (!rows.length) throw new Error(`Category '${value}' not found in ${table}`);
  return rows[0].id;
}

/** Resolve a category ID (or passthrough name) back to its display name. */
async function resolveCategoryIdToName(client, value, table) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return value;
  const { rows } = await client.query(`SELECT category FROM ${table} WHERE id = $1`, [parseInt(value, 10)]);
  if (!rows.length) throw new Error(`Category ID '${value}' not found in ${table}`);
  return rows[0].category;
}

/**
 * Build a single-trip lookup map {id -> name} for a category table.
 * Used to eliminate N+1 queries when resolving many records.
 */
async function buildCategoryNameMap(client, table) {
  const { rows } = await client.query(`SELECT id, category FROM ${table}`);
  const map = new Map();
  for (const r of rows) {
    map.set(r.id, r.category);
    map.set(String(r.id), r.category);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* User-preference colour formatting                                   */
/* ------------------------------------------------------------------ */

const COLOR_SLOTS = ['primary', 'secondary', 'tertiary'];

/** Collapse DB colour columns (color_primary_r etc.) into {primary:{r,g,b,a},...}. */
function formatUserColors(row) {
  const out = { ...row };
  for (const slot of COLOR_SLOTS) {
    const r = row[`color_${slot}_r`];
    const g = row[`color_${slot}_g`];
    const b = row[`color_${slot}_b`];
    const a = row[`color_${slot}_a`];
    if (r !== null && r !== undefined && g !== null && b !== null && a !== null) {
      out[slot] = { r, g, b, a: parseFloat(a) };
    }
    for (const c of ['r', 'g', 'b', 'a']) delete out[`color_${slot}_${c}`];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Split-allocation processing                                         */
/* ------------------------------------------------------------------ */

/** Group flat allocation rows into { [transaction_id]: [...] }. */
function groupAllocationsByTransaction(rows) {
  const grouped = {};
  for (const a of rows) {
    const key = a.transaction_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      allocation_id: a.allocation_id,
      split_id: a.split_id,
      user_id: a.user_id,
      amount: parseFloat(a.amount),
      percentage: a.percentage,
      is_paid: a.is_paid,
      paid_date: a.paid_date,
      notes: a.notes,
      created_at: a.created_at,
      username: a.username,
      display_name: a.display_name,
      config_id: a.config_id,
      split_type_code: a.split_type_code,
      split_type_label: a.split_type_label,
    });
  }
  return grouped;
}

function calculateSplitAllocations(totalAmount, splitType, users) {
  const abs = Math.abs(totalAmount);
  const sign = totalAmount < 0 ? -1 : 1;

  switch (splitType.code) {
    case 'equal': {
      const each = abs / users.length;
      const pct = (100 / users.length).toFixed(2);
      return users.map((u) => ({ user_id: u.id, amount: sign * each, percentage: pct }));
    }
    case 'percentage':
      return users.map((u) => {
        if (u.percentage == null) throw new Error(`Percentage not provided for user ${u.id}`);
        return { user_id: u.id, amount: sign * (abs * u.percentage / 100), percentage: u.percentage };
      });
    case 'fixed':
      return users.map((u) => {
        if (u.amount == null) throw new Error(`Fixed amount not provided for user ${u.id}`);
        const ua = Math.abs(u.amount);
        return { user_id: u.id, amount: sign * ua, percentage: ((ua / abs) * 100).toFixed(2) };
      });
    default:
      throw new Error(`Unsupported split type: ${splitType.code}`);
  }
}

function validateSplitAllocations(allocations, totalAmount) {
  const totalAlloc = allocations.reduce((s, a) => s + Math.abs(a.amount), 0);
  const totalPct = allocations.reduce((s, a) => s + parseFloat(a.percentage), 0);
  const abs = Math.abs(totalAmount);
  if (Math.abs(totalAlloc - abs) > 0.01) {
    throw new Error(`Split allocations total (${totalAlloc.toFixed(2)}) does not match transaction amount (${abs.toFixed(2)})`);
  }
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error(`Split percentages total (${totalPct.toFixed(2)}%) does not equal 100%`);
  }
}

/* ------------------------------------------------------------------ */
/* Dynamic SQL builders                                                */
/* ------------------------------------------------------------------ */

/** Build `col1 = $1, col2 = $2, ...` from an object. Returns { clause, values }. */
function buildSetClause(updates, startIdx = 1) {
  const keys = Object.keys(updates);
  const clause = keys.map((k, i) => `${k} = $${i + startIdx}`).join(', ');
  return { clause, values: Object.values(updates), nextIdx: startIdx + keys.length };
}

/** Build `(a,b,c) VALUES ($1,$2,$3),($4,$5,$6)...` for a bulk insert. */
function buildBulkInsert(columns, rows) {
  const values = [];
  const groups = rows.map((row, r) => {
    const placeholders = columns.map((_, c) => `$${r * columns.length + c + 1}`);
    columns.forEach((col) => values.push(row[col]));
    return `(${placeholders.join(', ')})`;
  });
  return { columns: columns.join(', '), placeholders: groups.join(', '), values };
}

module.exports = {
  getFieldType,
  normalizeValue,
  valuesAreEqual,
  arraysAreEqual,
  asyncRoute,
  ok,
  created,
  badRequest,
  notFound,
  parseUserId,
  resolveCategoryNameOrIdToId,
  resolveCategoryIdToName,
  buildCategoryNameMap,
  formatUserColors,
  groupAllocationsByTransaction,
  calculateSplitAllocations,
  validateSplitAllocations,
  buildSetClause,
  buildBulkInsert,
};
