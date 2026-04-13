const express = require('express');
const { pool } = require('../db');
const { asyncRoute, ok, badRequest, notFound, valuesAreEqual } = require('../helpers');

const router = express.Router();

/** PUT /budget-categories/:id – update budget amount, skipping no-ops. */
router.put('/budget-categories/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { budget } = req.body;

  if (budget === undefined || budget === null || Number.isNaN(parseFloat(budget))) {
    return badRequest(res, 'Budget amount is required and must be a valid number');
  }
  const budgetValue = parseFloat(budget);

  const { rows: cur } = await pool.query('SELECT * FROM budget_category WHERE id = $1', [id]);
  if (!cur.length) return notFound(res, 'Budget category not found');

  if (valuesAreEqual(cur[0].budget, budgetValue, 'number')) {
    return ok(res, cur[0], { message: 'No changes detected - budget not updated', optimized: true });
  }

  const { rows } = await pool.query(
    'UPDATE budget_category SET budget = $1 WHERE id = $2 RETURNING id, category, budget',
    [budgetValue, id],
  );
  ok(res, rows[0], { message: 'Budget updated successfully' });
}));

module.exports = router;
