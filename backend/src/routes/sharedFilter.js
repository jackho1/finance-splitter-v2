const express = require('express');
const { withClient } = require('../db');
const { getTypeCache } = require('../transactionTypes');
const { asyncRoute, ok, parseUserId } = require('../helpers');

const router = express.Router();

/**
 * GET /shared-transactions-filtered
 * Returns date-filtered shared transactions plus per-category and per-group
 * totals based on the caller's split allocations and personal split config.
 */
router.get('/shared-transactions-filtered', asyncRoute(async (req, res) => {
  const { startDate, endDate, user = 'Jack', userId: userIdParam } = req.query;
  const userId = parseUserId(userIdParam);

  const data = await withClient(async (client) => {
    const cache = await getTypeCache(client);
    const sharedTypeId = cache.transactionTypesByCode.get('shared')?.id || 1;

    // Build date-bounded query
    const conds = [];
    const vals = [];
    if (startDate) { vals.push(startDate); conds.push(`date >= $${vals.length}`); }
    if (endDate)   { vals.push(endDate);   conds.push(`date <= $${vals.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    // Fire all independent queries in parallel (txns + split config)
    const [{ rows: txns }, { rows: splitCfg }] = await Promise.all([
      client.query(`SELECT * FROM shared_transactions_generalized ${where} ORDER BY date DESC`, vals),
      client.query(`
        SELECT psg.group_name, psg.personal_category,
               array_agg(psm.budget_category) AS categories
          FROM personal_split_groups psg
          LEFT JOIN personal_split_mapping psm ON psg.id = psm.personal_split_group_id
         WHERE psg.user_id = $1 AND psg.is_active = true
         GROUP BY psg.id, psg.group_name, psg.personal_category, psg.display_order
         ORDER BY psg.display_order, psg.group_name`, [userId]),
    ]);

    // Fetch only the allocations relevant to these transactions (O(matching), not O(all))
    const txnIds = txns.map((r) => r.id);
    const splitAllocations = {};
    if (txnIds.length) {
      const { rows } = await client.query(`
        SELECT tsc.transaction_id, tsa.user_id, tsa.amount, tsa.percentage
          FROM transaction_split_allocations tsa
          JOIN transaction_split_configs tsc ON tsa.split_id = tsc.id
         WHERE tsc.transaction_id::text = ANY($1::text[]) AND tsc.transaction_type_id = $2`,
        [txnIds, sharedTypeId],
      );
      for (const a of rows) (splitAllocations[a.transaction_id] ||= []).push(a);
    }

    // Aggregate per budget category for THIS user's allocation
    const categoryTotals = {};
    for (const t of txns) {
      const allocs = splitAllocations[t.id] || [];
      const mine = allocs.find((a) => a.user_id === userId);
      if (!mine) continue;
      const amount = parseFloat(mine.amount) || 0;
      const cat = t.category || 'Uncategorized';
      const bucket = (categoryTotals[cat] ||= { total: 0, count: 0, transactions: [] });
      bucket.total += amount;
      bucket.count += 1;
      bucket.transactions.push(t);
    }

    // Seed groups from user's personal split config
    const groupedTotals = {};
    for (const c of splitCfg) {
      groupedTotals[c.group_name] = {
        total: 0, count: 0,
        categories: (c.categories || []).filter(Boolean),
        personalCategory: c.personal_category,
        transactions: [],
      };
    }
    const isDefaultGroup = (name, g) =>
      g.personalCategory === 'original' || /expenditure|default/i.test(name);
    if (!Object.entries(groupedTotals).some(([k, g]) => isDefaultGroup(k, g))) {
      groupedTotals.Uncategorized = { total: 0, count: 0, categories: [], personalCategory: 'original', transactions: [] };
    }
    const defaultGroupName = Object.entries(groupedTotals)
      .find(([k, g]) => isDefaultGroup(k, g) || k === 'Uncategorized')?.[0] || 'Uncategorized';

    // Roll category totals into groups
    for (const [cat, d] of Object.entries(categoryTotals)) {
      let assigned = false;
      for (const g of Object.values(groupedTotals)) {
        if (g.categories.includes(cat)) {
          g.total += d.total; g.count += d.count; g.transactions.push(...d.transactions);
          assigned = true;
        }
      }
      if (!assigned && groupedTotals[defaultGroupName]) {
        const g = groupedTotals[defaultGroupName];
        g.total += d.total; g.count += d.count; g.transactions.push(...d.transactions);
      }
    }

    const totalAmount = Object.values(groupedTotals).reduce((s, g) => s + g.total, 0);
    return {
      transactions: txns, categoryTotals, groupedTotals, totalAmount,
      filters: { startDate, endDate, user, userId },
      count: txns.length, userSplitConfig: splitCfg,
    };
  });

  ok(res, data);
}));

module.exports = router;
