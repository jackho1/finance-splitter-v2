const express = require('express');
const { pool, withTransaction } = require('../db');
const { asyncRoute, ok, badRequest, notFound } = require('../helpers');

const router = express.Router();

const SLOTS = ['primary', 'secondary', 'tertiary'];
const DEFAULTS = {
  primary:   { r: 54,  g: 162, b: 235, a: 1 },
  secondary: { r: 255, g: 99,  b: 132, a: 1 },
  tertiary:  { r: 75,  g: 192, b: 192, a: 1 },
};

function formatRow(row) {
  const out = { user_id: row.user_id, theme: row.theme, created_at: row.created_at, updated_at: row.updated_at };
  for (const s of SLOTS) {
    out[s] = {
      r: row[`color_${s}_r`], g: row[`color_${s}_g`],
      b: row[`color_${s}_b`], a: parseFloat(row[`color_${s}_a`]),
    };
  }
  return out;
}

function validateColor(color, name) {
  if (!color || typeof color !== 'object') throw new Error(`${name} color must be an object`);
  const { r, g, b, a } = color;
  if (typeof r !== 'number' || r < 0 || r > 255) throw new Error(`${name} red value must be a number between 0 and 255`);
  if (typeof g !== 'number' || g < 0 || g > 255) throw new Error(`${name} green value must be a number between 0 and 255`);
  if (typeof b !== 'number' || b < 0 || b > 255) throw new Error(`${name} blue value must be a number between 0 and 255`);
  if (typeof a !== 'number' || a < 0 || a > 1)   throw new Error(`${name} alpha value must be a number between 0 and 1`);
}

/** GET /user-preferences/:userId */
router.get('/user-preferences/:userId', asyncRoute(async (req, res) => {
  const { userId } = req.params;
  if (!userId || userId === 'undefined' || userId === 'null') {
    return badRequest(res, 'Valid user ID is required');
  }
  const { rows } = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
  if (!rows.length) {
    return ok(res, { user_id: userId, ...DEFAULTS, theme: 'light' },
      { message: 'Using default preferences (not saved yet)' });
  }
  ok(res, formatRow(rows[0]));
}));

/** PUT /user-preferences/:userId */
router.put('/user-preferences/:userId', asyncRoute(async (req, res) => {
  const { userId } = req.params;
  const { primary, secondary, tertiary, theme } = req.body;
  const colors = { primary, secondary, tertiary };

  if (!userId || userId === 'undefined' || userId === 'null') {
    return badRequest(res, 'Valid user ID is required');
  }
  for (const s of SLOTS) if (colors[s]) validateColor(colors[s], s.charAt(0).toUpperCase() + s.slice(1));

  const out = await withTransaction(async (client) => {
    const { rows: u } = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!u.length) throw Object.assign(new Error('User not found'), { status: 404 });

    const { rows: existing } = await client.query('SELECT user_id FROM user_preferences WHERE user_id = $1', [userId]);

    // Build `color_slot_channel` column map, defaulting unspecified slots on INSERT
    const cols = ['user_id'];
    const vals = [userId];
    for (const s of SLOTS) {
      const c = colors[s] ?? (existing.length ? null : DEFAULTS[s]);
      if (!c) continue;
      for (const ch of ['r', 'g', 'b', 'a']) {
        cols.push(`color_${s}_${ch}`);
        vals.push(c[ch]);
      }
    }
    if (theme || !existing.length) { cols.push('theme'); vals.push(theme || 'light'); }

    // Single UPSERT replaces the original branchy INSERT-or-UPDATE
    const updateCols = cols.filter((c) => c !== 'user_id');
    const setClause = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
    const ph = cols.map((_, i) => `$${i + 1}`);
    const { rows: [row] } = await client.query(
      `INSERT INTO user_preferences (${cols.join(', ')}, created_at, updated_at)
       VALUES (${ph.join(', ')}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
          SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       RETURNING *`, vals,
    );

    console.log(`✅ ${existing.length ? 'Updated' : 'Created'} preferences for user ${userId}`);
    return { row, isNew: !existing.length };
  }).catch((err) => {
    if (err.status === 404) { notFound(res, err.message); return null; }
    throw err;
  });

  if (!out) return;
  ok(res, formatRow(out.row), {
    message: `User preferences ${out.isNew ? 'created' : 'updated'} successfully`,
  });
}));

module.exports = router;
