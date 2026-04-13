/**
 * Central configuration for the three transaction families.
 * Drives the generic CRUD/split handlers in routes/transactions.js so that
 * shared / personal / offset endpoints share one implementation.
 */
const TRANSACTION_TYPES = {
  shared: {
    code: 'shared',
    table: 'shared_transactions',
    view: 'shared_transactions_generalized',
    categoryTable: null,            // shared transactions don't map category via lookup
    allowedFields: ['id', 'date', 'description', 'amount', 'category', 'bank_category', 'label', 'has_split', 'split_from_id', 'mark'],
    updateFields: ['date', 'description', 'amount', 'category', 'bank_category', 'label', 'has_split', 'split_from_id', 'mark'],
    splitRequiredFields: ['description', 'amount'],
    splitExtraColumns: ['bank_category', 'label', 'mark'],
  },
  personal: {
    code: 'personal',
    table: 'personal_transactions',
    view: 'personal_transactions_generalized',
    categoryTable: 'personal_category',
    allowedFields: ['id', 'date', 'description', 'amount', 'category', 'has_split', 'split_from_id'],
    updateFields: ['date', 'description', 'amount', 'category'],
    splitRequiredFields: ['description', 'amount', 'category'],
    splitExtraColumns: [],
  },
  offset: {
    code: 'offset',
    table: 'offset_transactions',
    view: 'offset_transactions_generalized',
    categoryTable: 'offset_category',
    allowedFields: ['id', 'date', 'description', 'amount', 'category', 'label', 'has_split', 'split_from_id'],
    updateFields: ['date', 'description', 'amount', 'category', 'label'],
    splitRequiredFields: ['description', 'amount', 'category'],
    splitExtraColumns: ['label'],
  },
};

/* ------------------------------------------------------------------ */
/* In-memory cache for transaction_types / split_types lookup tables.  */
/* These change rarely, so we avoid a DB round-trip on every request.  */
/* ------------------------------------------------------------------ */

let _typeCache = null;

async function loadTypeCache(client) {
  const [tt, st] = await Promise.all([
    client.query('SELECT * FROM transaction_types'),
    client.query('SELECT * FROM split_types'),
  ]);
  _typeCache = {
    transactionTypesByCode: new Map(tt.rows.map((r) => [r.code, r])),
    transactionTypesById: new Map(tt.rows.map((r) => [r.id, r])),
    splitTypesByCode: new Map(st.rows.map((r) => [r.code, r])),
    transactionTypesList: tt.rows,
    splitTypesList: st.rows,
  };
  return _typeCache;
}

async function getTypeCache(client) {
  if (_typeCache) return _typeCache;
  return loadTypeCache(client);
}

function invalidateTypeCache() { _typeCache = null; }

module.exports = { TRANSACTION_TYPES, getTypeCache, loadTypeCache, invalidateTypeCache };
