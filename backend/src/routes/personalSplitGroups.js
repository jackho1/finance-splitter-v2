const express = require('express');
const { pool, withTransaction } = require('../db');
const {
  asyncRoute, ok, created, badRequest, notFound, parseUserId,
  valuesAreEqual, getFieldType, buildSetClause,
} = require('../helpers');

const router = express.Router();

/* ---- personal-split-groups --------------------------------------- */

router.get('/personal-split-groups/:userId', asyncRoute(async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const { rows } = await pool.query(`
    SELECT psg.*,
           array_agg(json_build_object('id', psm.id, 'budget_category', psm.budget_category)
                     ORDER BY psm.budget_category)
             FILTER (WHERE psm.id IS NOT NULL) AS mapped_categories
      FROM personal_split_groups psg
      LEFT JOIN personal_split_mapping psm
             ON psg.id = psm.personal_split_group_id AND psm.user_id = $1
     WHERE psg.user_id = $1 AND psg.is_active = true
     GROUP BY psg.id
     ORDER BY psg.display_order, psg.id`, [userId]);
  ok(res, rows.map((r) => ({ ...r, mapped_categories: r.mapped_categories || [] })));
}));

router.post('/personal-split-groups', asyncRoute(async (req, res) => {
  const { user_id, group_name, personal_category, display_order = 0 } = req.body;
  if (!user_id || !group_name || !personal_category) {
    return badRequest(res, 'User ID, group name, and personal category are required');
  }
  const { rows } = await pool.query(
    `INSERT INTO personal_split_groups (user_id, group_name, personal_category, display_order)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [user_id, group_name, personal_category, display_order],
  );
  created(res, rows[0], 'Personal split group created successfully');
}));

router.put('/personal-split-groups/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const allowed = ['group_name', 'personal_category', 'display_order', 'is_active'];

  const { rows: cur } = await pool.query('SELECT * FROM personal_split_groups WHERE id = $1', [id]);
  if (!cur.length) return notFound(res, 'Personal split group not found');
  const current = cur[0];

  const validUpdates = {};
  for (const [k, v] of Object.entries(updates)) {
    if (!allowed.includes(k)) continue;
    if (!valuesAreEqual(current[k], v, getFieldType(k))) validUpdates[k] = v;
  }
  if (!Object.keys(validUpdates).length) {
    return ok(res, current, { message: 'No changes detected - group not updated', optimized: true });
  }

  const { clause, values } = buildSetClause(validUpdates);
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE personal_split_groups SET ${clause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length} RETURNING *`, values,
  );
  ok(res, rows[0], { message: 'Personal split group updated successfully', changedFields: Object.keys(validUpdates) });
}));

router.delete('/personal-split-groups/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT 1 FROM personal_split_groups WHERE id = $1', [id]);
    if (!rows.length) throw Object.assign(new Error('Personal split group not found'), { status: 404 });
    await client.query('DELETE FROM personal_split_mapping WHERE personal_split_group_id = $1', [id]);
    await client.query('DELETE FROM personal_split_groups WHERE id = $1', [id]);
  });
  res.json({ success: true, message: 'Personal split group and associated mappings deleted successfully' });
}));

/* ---- personal-split-mapping -------------------------------------- */

router.get('/personal-split-mapping/:userId', asyncRoute(async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const { rows } = await pool.query(`
    SELECT psm.*, psg.group_name, psg.personal_category
      FROM personal_split_mapping psm
      JOIN personal_split_groups psg ON psm.personal_split_group_id = psg.id
     WHERE psm.user_id = $1 AND psg.is_active = true
     ORDER BY psg.display_order, psg.group_name, psm.budget_category`, [userId]);
  ok(res, rows);
}));

router.post('/personal-split-mapping', asyncRoute(async (req, res) => {
  const { user_id, personal_split_group_id, budget_categories } = req.body;
  if (!user_id || !personal_split_group_id || !Array.isArray(budget_categories)) {
    return badRequest(res, 'User ID, personal split group ID, and budget categories array are required');
  }

  const inserted = await withTransaction(async (client) => {
    const { rows: g } = await client.query(
      'SELECT id FROM personal_split_groups WHERE id = $1 AND user_id = $2',
      [personal_split_group_id, user_id],
    );
    if (!g.length) throw Object.assign(new Error('Personal split group not found or does not belong to user'), { status: 400 });
    if (!budget_categories.length) return [];

    // Single bulk insert with conflict-skip
    const ph = budget_categories.map((_, i) => `($1,$2,$${i + 3})`).join(',');
    const { rows } = await client.query(
      `INSERT INTO personal_split_mapping (user_id, personal_split_group_id, budget_category)
       VALUES ${ph}
       ON CONFLICT (user_id, personal_split_group_id, budget_category) DO NOTHING
       RETURNING *`,
      [user_id, personal_split_group_id, ...budget_categories],
    );
    return rows;
  });
  created(res, inserted, `${inserted.length} personal split mappings created successfully`);
}));

router.delete('/personal-split-mapping/bulk/:userId', asyncRoute(async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const { personal_split_group_id, budget_categories } = req.body;
  if (!personal_split_group_id || !Array.isArray(budget_categories)) {
    return badRequest(res, 'Personal split group ID and budget categories array are required');
  }
  const result = await pool.query(
    `DELETE FROM personal_split_mapping
      WHERE user_id = $1 AND personal_split_group_id = $2 AND budget_category = ANY($3::text[])`,
    [userId, personal_split_group_id, budget_categories],
  );
  res.json({ success: true, message: `${result.rowCount} personal split mappings deleted successfully` });
}));

router.delete('/personal-split-mapping/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('DELETE FROM personal_split_mapping WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return notFound(res, 'Personal split mapping not found');
  res.json({ success: true, message: 'Personal split mapping deleted successfully' });
}));

module.exports = router;
