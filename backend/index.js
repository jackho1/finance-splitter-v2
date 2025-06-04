const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
require('dotenv').config();
const app = express();
const port = 5000; // Define port with default

// Promisify the exec function to use with async/await
const execPromise = util.promisify(exec);

// Access environment variables
const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
};

// Database connection setup
const pool = new Pool(dbConfig);

// Middleware
app.use(cors());
app.use(express.json()); // For parsing JSON request bodies

// Allowed columns for filtering and field selection
const allowedFields = ['id', 'date', 'description', 'amount', 'category', 'bank_category', 'label', 'has_split', 'split_from_id'];

/**
 * GET /transactions - Retrieves transactions with optional filters
 */
app.get('/transactions', async (req, res) => {
  try {
    // Fields to select
    const fields = req.query.fields
      ? req.query.fields
          .split(',')
          .map(f => f.trim())
          .filter(f => allowedFields.includes(f))
          .join(', ')
      : '*';

    // Dynamic filtering
    const filters = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'fields' && allowedFields.includes(key)) {
        filters.push(`${key} = $${index}`);
        values.push(value);
        index++;
      }
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `SELECT ${fields} FROM shared_transactions ${whereClause}`;
    
    const { rows } = await pool.query(query, values);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).send('Server error');
  }
});

/**
 * PUT /transactions/:id - Updates a transaction by ID
 */
app.put('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Validate the transaction exists first
    const checkResult = await pool.query('SELECT * FROM shared_transactions WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    // Process and validate field updates
    const validUpdates = {};
    const errors = [];
    
    for (const [key, value] of Object.entries(updates)) {
      // Only process allowed fields
      if (!allowedFields.includes(key)) {
        errors.push(`Field "${key}" is not allowed for updates`);
        continue;
      }
      
      // Type validation and conversions based on field type
      switch (key) {
        case 'amount':
          // Handle empty values
          if (value === null || value === undefined || value === '') {
            validUpdates[key] = null;
          } else {
            // Ensure amount is a valid number
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
              errors.push('Amount must be a valid number');
            } else {
              validUpdates[key] = numValue;
            }
          }
          break;
          
        case 'date':
          // Handle empty values
          if (value === null || value === undefined || value === '') {
            validUpdates[key] = null;
          } else {
            // Validate date format
            try {
              const dateObj = new Date(value);
              if (isNaN(dateObj.getTime())) {
                errors.push('Invalid date format');
              } else {
                validUpdates[key] = dateObj.toISOString().split('T')[0]; // Store as YYYY-MM-DD
              }
            } catch (e) {
              errors.push('Invalid date format');
            }
          }
          break;
          
        case 'label':
          // Allow empty labels (null), which can be edited later
          validUpdates[key] = value === '' ? null : value;
          break;
          
        default:
          // Basic validation for other fields
          if (typeof value === 'string') {
            // Convert empty strings to null for database consistency
            validUpdates[key] = value.trim() === '' ? null : value.trim();
          } else {
            validUpdates[key] = value;
          }
      }
    }
    
    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errors: errors 
      });
    }
    
    // If no valid updates after validation, return error
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update' 
      });
    }
    
    // Build query for database update
    const setClause = Object.entries(validUpdates).map(
      ([key, _], index) => `${key} = $${index + 1}`
    ).join(', ');
    
    const values = [...Object.values(validUpdates), id];
    const query = `UPDATE shared_transactions SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    
    // Execute the update
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'Update failed' 
      });
    }
    
    // Return success with updated transaction data
    res.json({
      success: true,
      data: rows[0],
      message: 'Transaction updated successfully'
    });
  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * POST /transactions - Creates a new transaction with auto-generated ID
 */
app.post('/transactions', async (req, res) => {
  try {
    const newTransaction = req.body;
    
    // Process and validate fields
    const validFields = {};
    const errors = [];
    
    // Validate required fields
    if (!newTransaction.date) {
      errors.push('Date is required');
    }
    if (newTransaction.description === undefined || newTransaction.description === null) {
      errors.push('Description is required');
    }
    if (newTransaction.amount === undefined || newTransaction.amount === null) {
      errors.push('Amount is required');
    }
    
    for (const [key, value] of Object.entries(newTransaction)) {
      // Only process allowed fields
      if (!allowedFields.includes(key) || key === 'id') { // Skip id as it will be auto-generated
        if (key !== 'id') { // Don't report an error for id
          errors.push(`Field "${key}" is not allowed for new transactions`);
        }
        continue;
      }
      
      // Type validation and conversions based on field type
      switch (key) {
        case 'amount':
          // Handle empty values
          if (value === null || value === undefined || value === '') {
            errors.push('Amount is required');
          } else {
            // Ensure amount is a valid number
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
              errors.push('Amount must be a valid number');
            } else {
              validFields[key] = numValue;
            }
          }
          break;
          
        case 'date':
          // Handle empty values
          if (value === null || value === undefined || value === '') {
            errors.push('Date is required');
          } else {
            // Validate date format
            try {
              const dateObj = new Date(value);
              if (isNaN(dateObj.getTime())) {
                errors.push('Invalid date format');
              } else {
                validFields[key] = dateObj.toISOString().split('T')[0]; // Store as YYYY-MM-DD
              }
            } catch (e) {
              errors.push('Invalid date format');
            }
          }
          break;
          
        case 'label':
          // Allow empty labels (null), which can be edited later
          validFields[key] = value === '' ? null : value;
          break;
          
        default:
          // Basic validation for other fields
          if (typeof value === 'string') {
            // Convert empty strings to null for database consistency
            validFields[key] = value.trim() === '' ? null : value.trim();
          } else {
            validFields[key] = value;
          }
      }
    }
    
    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errors: errors 
      });
    }
    
    // Build query for inserting the new transaction
    const fields = Object.keys(validFields);
    const placeholders = fields.map((field, index) => `$${index + 1}`);
    const values = Object.values(validFields);
    
    const query = `
      INSERT INTO shared_transactions (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    
    // Execute the insert
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'Insert failed' 
      });
    }
    
    // Return success with new transaction data
    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Transaction created successfully'
    });
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

// GET /labels — returns distinct labels for dropdown filter
app.get('/labels', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT DISTINCT label FROM shared_transactions ORDER BY label DESC');
    res.json(rows.map(row => row.label).filter(label => label != null));
  } catch (err) {
    console.error('Error fetching labels:', err);
    res.status(500).send('Server error');
  }
});

// GET /category-mappings - returns mappings between bank_category and category
app.get('/category-mappings', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sc.bank_category, bc.category 
      FROM shared_category sc
      JOIN budget_category bc ON sc.category = bc.id
    `);
    
    // Convert the rows to a mapping object for easier consumption by the frontend
    const mappings = {};
    rows.forEach(row => {
      mappings[row.bank_category] = row.category;
    });
    
    res.json(mappings);
  } catch (err) {
    console.error('Error fetching category mappings:', err);
    res.status(500).send('Server error');
  }
});

// GET /budget-categories - returns all budget categories with their budgets
app.get('/budget-categories', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, category, budget FROM budget_category ORDER BY category');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching budget categories:', err);
    res.status(500).send('Server error');
  }
});

// PUT /budget-categories/:id - updates a budget category's budget amount
app.put('/budget-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { budget } = req.body;
    
    // Validate budget is a number
    if (budget === undefined || budget === null || isNaN(parseFloat(budget))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Budget amount is required and must be a valid number' 
      });
    }
    
    const budgetValue = parseFloat(budget);
    
    // Update the budget amount
    const { rows } = await pool.query(
      'UPDATE budget_category SET budget = $1 WHERE id = $2 RETURNING id, category, budget',
      [budgetValue, id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Budget category not found' 
      });
    }
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Budget updated successfully'
    });
  } catch (err) {
    console.error('Error updating budget category:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

// GET /bank-categories - returns all bank categories from the shared_category table
app.get('/bank-categories', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT DISTINCT bank_category FROM shared_category');
    const bankCategories = rows.map(row => row.bank_category).filter(category => category !== null);
    
    // Add null as a valid option
    bankCategories.push(null);
    
    res.json(bankCategories);
  } catch (err) {
    console.error('Error fetching bank categories:', err);
    res.status(500).send('Server error');
  }
});

/**
 * POST /refresh-shared-bank-feeds - Executes the Python script to refresh DB with new transactions
 */
app.post('/refresh-shared-bank-feeds', async (req, res) => {
  try {
    // Path to the Python script
    const scriptPath = path.join(__dirname, 'shared_bank_feed.py');
    
    console.log('Refreshing bank feeds data...');
    
    // Execute the Python script using the promisified exec function
    const { stdout, stderr } = await execPromise(`python3 ${scriptPath}`);
    
    if (stderr) {
      console.warn(`Python script warnings: ${stderr}`);
    }
    
    console.log(`Python script output: ${stdout}`);
    
    // Check if there's a success message in the output
    if (stdout.includes('Transactions inserted successfully')) {
      return res.status(200).json({
        success: true,
        message: 'Bank feeds refreshed successfully',
        details: stdout
      });
    } else {
      // If the script ran but didn't insert transactions as expected
      return res.status(200).json({
        success: true,
        message: 'Bank feeds process completed but no new transactions were found',
        details: stdout
      });
    }
  } catch (err) {
    console.error('Error refreshing bank feeds:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh bank feeds',
      details: err.message
    });
  }
});

/**
 * POST /refresh-personal-bank-feeds - Executes the Python script to refresh DB with personal transactions
 */
app.post('/refresh-personal-bank-feeds', async (req, res) => {
  try {
    // Path to the Python script
    const scriptPath = path.join(__dirname, 'personal_bank_feed.py');
    
    console.log('Refreshing personal bank feeds data...');
    
    // Execute the Python script using the promisified exec function
    const { stdout, stderr } = await execPromise(`python3 ${scriptPath}`);
    
    if (stderr) {
      console.warn(`Python script warnings: ${stderr}`);
    }
    
    console.log(`Python script output: ${stdout}`);
    
    // Check if there's a success message in the output
    if (stdout.includes('Successfully processed') && stdout.includes('personal transactions')) {
      return res.status(200).json({
        success: true,
        message: 'Personal bank feeds refreshed successfully',
        details: stdout
      });
    } else if (stdout.includes('No transactions found to process')) {
      return res.status(200).json({
        success: true,
        message: 'Personal bank feeds process completed but no new transactions were found',
        details: stdout
      });
    } else {
      // If the script ran but didn't insert transactions as expected
      return res.status(200).json({
        success: true,
        message: 'Personal bank feeds process completed',
        details: stdout
      });
    }
  } catch (err) {
    console.error('Error refreshing personal bank feeds:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh personal bank feeds',
      details: err.message
    });
  }
});

// GET /personal-transactions - Retrieves personal transactions
app.get('/personal-transactions', async (req, res) => {
  try {
    const query = 'SELECT * FROM personal_transactions ORDER BY date DESC';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching personal transactions:', err);
    res.status(500).send('Server error');
  }
});

// GET /personal-categories - Retrieves personal categories
app.get('/personal-categories', async (req, res) => {
  try {
    const query = 'SELECT * FROM personal_category ORDER BY category';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching personal categories:', err);
    res.status(500).send('Server error');
  }
});

// PUT /personal-transactions/:id - Updates a personal transaction
app.put('/personal-transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['date', 'description', 'amount', 'category'];
    
    const validUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value;
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update' 
      });
    }
    
    const setClause = Object.entries(validUpdates).map(
      ([key, _], index) => `${key} = $${index + 1}`
    ).join(', ');
    
    const values = [...Object.values(validUpdates), id];
    const query = `UPDATE personal_transactions SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Transaction updated successfully'
    });
  } catch (err) {
    console.error('Error updating personal transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

// POST /personal-transactions - Creates a new personal transaction
app.post('/personal-transactions', async (req, res) => {
  try {
    const { date, description, amount, category } = req.body;
    
    if (!date || !description || amount === undefined) {
      return res.status(400).json({ 
        success: false, 
        errors: ['Date, description, and amount are required'] 
      });
    }
    
    const query = `
      INSERT INTO personal_transactions (date, description, amount, category)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [date, description, amount, category]);
    
    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Transaction created successfully'
    });
  } catch (err) {
    console.error('Error creating personal transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * POST /personal-transactions/split - Splits a personal transaction into multiple transactions
 */
app.post('/personal-transactions/split', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { originalTransactionId, remainingAmount, splitTransactions } = req.body;
    
    // Validate input data
    if (!originalTransactionId || remainingAmount === undefined || !splitTransactions || !Array.isArray(splitTransactions)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data. Required: originalTransactionId, remainingAmount, splitTransactions array'
      });
    }
    
    // Check if the original transaction exists
    const originalResult = await client.query(
      'SELECT * FROM personal_transactions WHERE id = $1',
      [originalTransactionId]
    );
    
    if (originalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Original transaction not found'
      });
    }
    
    const originalTransaction = originalResult.rows[0];
    const originalAmount = parseFloat(originalTransaction.amount);
    const isNegative = originalAmount < 0; // Track if original amount is negative
    
    // Validate split transactions
    let splitTotal = 0;
    const errors = [];
    
    splitTransactions.forEach((split, index) => {
      if (!split.description || !split.amount || !split.category) {
        errors.push(`Split #${index + 1}: Description, amount, and category are required`);
      }
      
      // Convert amount to absolute value for validation
      const amount = Math.abs(parseFloat(split.amount));
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Split #${index + 1}: Amount must be a non-zero number`);
      } else {
        splitTotal += amount;
      }
    });
    
    if (errors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }
    
    // Validate that split amounts don't exceed original
    const absOriginalAmount = Math.abs(originalAmount);
    const absRemainingAmount = Math.abs(parseFloat(remainingAmount));
    
    if (originalAmount < 0) {
      // For expenses: check absolute values
      if (Math.abs(splitTotal) > Math.abs(originalAmount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Split amounts exceed the original transaction amount'
        });
      }
    } else {
      // For income: total splits should not exceed original
      if (splitTotal > originalAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Split amounts exceed the original transaction amount'
        });
      }
    }
    
    // Create split transactions
    const createdTransactions = [];
    
    for (const split of splitTransactions) {
      // Ensure the split amount has the same sign as the original transaction
      const splitAmount = isNegative ? 
        -Math.abs(parseFloat(split.amount)) : 
        Math.abs(parseFloat(split.amount));

      const insertResult = await client.query(
        `INSERT INTO personal_transactions (date, description, amount, category, is_split)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          originalTransaction.date,
          split.description,
          splitAmount,
          split.category,
          true
        ]
      );
      createdTransactions.push(insertResult.rows[0]);
    }
    
    // Update the original transaction amount if there's a remaining amount
    if (absRemainingAmount > 0) {
      // Ensure the remaining amount has the same sign as the original transaction
      const newAmount = isNegative ? -absRemainingAmount : absRemainingAmount;
      
      const updateResult = await client.query(
        `UPDATE personal_transactions 
         SET amount = $1, has_split = $2
         WHERE id = $3
         RETURNING *`,
        [
          newAmount,
          true,
          originalTransactionId
        ]
      );
      
      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(500).json({
          success: false,
          error: 'Failed to update original transaction'
        });
      }
    } else {
      // Mark the original transaction as fully split (amount = 0)
      await client.query(
        `UPDATE personal_transactions 
         SET amount = $1, has_split = $2
         WHERE id = $3`,
        [0, true, originalTransactionId]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Transaction split successfully',
      data: {
        originalTransactionId: originalTransactionId,
        originalAmount: originalAmount, // Include original amount in response
        splitTransactions: createdTransactions,
        remainingAmount: isNegative ? -absRemainingAmount : absRemainingAmount // Ensure remaining amount has correct sign
      }
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error splitting transaction:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to split transaction',
      details: err.message
    });
  } finally {
    client.release();
  }
});

/**
 * POST /refresh-offset-bank-feeds - Executes the Python script to refresh DB with offset transactions
 */
app.post('/refresh-offset-bank-feeds', async (req, res) => {
  try {
    // Path to the Python script
    const scriptPath = path.join(__dirname, 'offset_bank_feed.py');
    
    console.log('Refreshing offset bank feeds data...');
    
    // Execute the Python script using the promisified exec function
    const { stdout, stderr } = await execPromise(`python3 ${scriptPath}`);
    
    if (stderr) {
      console.warn(`Python script warnings: ${stderr}`);
    }
    
    console.log(`Python script output: ${stdout}`);
    
    // Check if there's a success message in the output
    if (stdout.includes('Successfully processed') && stdout.includes('offset transactions')) {
      return res.status(200).json({
        success: true,
        message: 'Offset bank feeds refreshed successfully',
        details: stdout
      });
    } else if (stdout.includes('No transactions found to process')) {
      return res.status(200).json({
        success: true,
        message: 'Offset bank feeds process completed but no new transactions were found',
        details: stdout
      });
    } else {
      // If the script ran but didn't insert transactions as expected
      return res.status(200).json({
        success: true,
        message: 'Offset bank feeds process completed',
        details: stdout
      });
    }
  } catch (err) {
    console.error('Error refreshing offset bank feeds:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh offset bank feeds',
      details: err.message
    });
  }
});

// GET /offset-transactions - Retrieves offset transactions
app.get('/offset-transactions', async (req, res) => {
  try {
    const query = 'SELECT * FROM offset_transactions ORDER BY date DESC';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching offset transactions:', err);
    res.status(500).send('Server error');
  }
});

// GET /offset-categories - Retrieves offset categories
app.get('/offset-categories', async (req, res) => {
  try {
    const query = 'SELECT * FROM offset_category ORDER BY category';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching offset categories:', err);
    res.status(500).send('Server error');
  }
});

// PUT /offset-transactions/:id - Updates an offset transaction
app.put('/offset-transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['date', 'description', 'amount', 'category', 'label'];
    
    const validUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value;
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update' 
      });
    }
    
    const setClause = Object.entries(validUpdates).map(
      ([key, _], index) => `${key} = $${index + 1}`
    ).join(', ');
    
    const values = [...Object.values(validUpdates), id];
    const query = `UPDATE offset_transactions SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Transaction updated successfully'
    });
  } catch (err) {
    console.error('Error updating offset transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

// POST /offset-transactions - Creates a new offset transaction
app.post('/offset-transactions', async (req, res) => {
  try {
    const { date, description, amount, category, label } = req.body;
    
    if (!date || !description || amount === undefined) {
      return res.status(400).json({ 
        success: false, 
        errors: ['Date, description, and amount are required'] 
      });
    }
    
    const query = `
      INSERT INTO offset_transactions (date, description, amount, category, label)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [date, description, amount, category, label]);
    
    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Transaction created successfully'
    });
  } catch (err) {
    console.error('Error creating offset transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * POST /offset-transactions/split - Splits an offset transaction into multiple transactions
 */
app.post('/offset-transactions/split', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { originalTransactionId, remainingAmount, splitTransactions } = req.body;
    
    // Validate input data
    if (!originalTransactionId || remainingAmount === undefined || !splitTransactions || !Array.isArray(splitTransactions)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data. Required: originalTransactionId, remainingAmount, splitTransactions array'
      });
    }
    
    // Check if the original transaction exists
    const originalResult = await client.query(
      'SELECT * FROM offset_transactions WHERE id = $1',
      [originalTransactionId]
    );
    
    if (originalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Original transaction not found'
      });
    }
    
    const originalTransaction = originalResult.rows[0];
    const originalAmount = parseFloat(originalTransaction.amount);
    const isNegative = originalAmount < 0; // Track if original amount is negative
    
    // Validate split transactions
    let splitTotal = 0;
    const errors = [];
    
    splitTransactions.forEach((split, index) => {
      if (!split.description || !split.amount || !split.category) {
        errors.push(`Split #${index + 1}: Description, amount, and category are required`);
      }
      
      // Convert amount to absolute value for validation
      const amount = Math.abs(parseFloat(split.amount));
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Split #${index + 1}: Amount must be a non-zero number`);
      } else {
        splitTotal += amount;
      }
    });
    
    if (errors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }
    
    // Validate that split amounts don't exceed original
    const absOriginalAmount = Math.abs(originalAmount);
    const absRemainingAmount = Math.abs(parseFloat(remainingAmount));
    
    if (originalAmount < 0) {
      // For expenses: check absolute values
      if (Math.abs(splitTotal) > Math.abs(originalAmount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Split amounts exceed the original transaction amount'
        });
      }
    } else {
      // For income: total splits should not exceed original
      if (splitTotal > originalAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Split amounts exceed the original transaction amount'
        });
      }
    }
    
    // Create split transactions
    const createdTransactions = [];
    
    for (const split of splitTransactions) {
      // Ensure the split amount has the same sign as the original transaction
      const splitAmount = isNegative ? 
        -Math.abs(parseFloat(split.amount)) : 
        Math.abs(parseFloat(split.amount));

      const insertResult = await client.query(
        `INSERT INTO offset_transactions (date, description, amount, category, label, is_split)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          originalTransaction.date,
          split.description,
          splitAmount,
          split.category,
          split.label || originalTransaction.label, // Use split label or inherit from original
          true
        ]
      );
      createdTransactions.push(insertResult.rows[0]);
    }
    
    // Update the original transaction amount if there's a remaining amount
    if (absRemainingAmount > 0) {
      // Ensure the remaining amount has the same sign as the original transaction
      const newAmount = isNegative ? -absRemainingAmount : absRemainingAmount;
      
      const updateResult = await client.query(
        `UPDATE offset_transactions 
         SET amount = $1, has_split = $2
         WHERE id = $3
         RETURNING *`,
        [
          newAmount,
          true,
          originalTransactionId
        ]
      );
      
      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(500).json({
          success: false,
          error: 'Failed to update original transaction'
        });
      }
    } else {
      // Mark the original transaction as fully split (amount = 0)
      await client.query(
        `UPDATE offset_transactions 
         SET amount = $1, has_split = $2
         WHERE id = $3`,
        [0, true, originalTransactionId]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Transaction split successfully',
      data: {
        originalTransactionId: originalTransactionId,
        originalAmount: originalAmount, // Include original amount in response
        splitTransactions: createdTransactions,
        remainingAmount: isNegative ? -absRemainingAmount : absRemainingAmount // Ensure remaining amount has correct sign
      }
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error splitting transaction:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to split transaction',
      details: err.message
    });
  } finally {
    client.release();
  }
});

// ===== PERSONAL SETTINGS AND AUTO DISTRIBUTION ENDPOINTS =====

/**
 * GET /personal-settings/:userId - Get user's personal settings
 */
app.get('/personal-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = 'SELECT * FROM personal_settings WHERE user_id = $1';
    const { rows } = await pool.query(query, [userId]);
    
    if (rows.length === 0) {
      // Return default settings if none exist
      return res.json({
        success: true,
        data: {
          user_id: userId,
          hide_zero_balance_buckets: false,
          enable_negative_offset_bucket: false,
          selected_negative_offset_bucket: null,
          category_order: [],
          auto_distribution_enabled: false,
          last_auto_distribution_month: null
        }
      });
    }
    
    // Parse JSON fields back to objects/arrays
    const settings = rows[0];
    if (settings.category_order && typeof settings.category_order === 'string') {
      try {
        settings.category_order = JSON.parse(settings.category_order);
      } catch (error) {
        console.error('Error parsing category_order JSON:', error);
        settings.category_order = [];
      }
    }
    
    res.json({
      success: true,
      data: settings
    });
  } catch (err) {
    console.error('Error fetching personal settings:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * PUT /personal-settings/:userId - Update user's personal settings
 */
app.put('/personal-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    const allowedFields = [
      'hide_zero_balance_buckets',
      'enable_negative_offset_bucket', 
      'selected_negative_offset_bucket',
      'category_order',
      'auto_distribution_enabled',
      'last_auto_distribution_month'
    ];
    
    const validUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        // Special handling for category_order to ensure it's properly stored as JSON
        if (key === 'category_order' && Array.isArray(value)) {
          validUpdates[key] = JSON.stringify(value);
        } else {
          validUpdates[key] = value;
        }
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update' 
      });
    }
    
    // Check if settings exist for this user
    const checkQuery = 'SELECT id FROM personal_settings WHERE user_id = $1';
    const checkResult = await pool.query(checkQuery, [userId]);
    
    let query, values;
    
    if (checkResult.rows.length === 0) {
      // Insert new settings
      const fields = ['user_id', ...Object.keys(validUpdates)];
      const placeholders = fields.map((field, index) => `$${index + 1}`);
      values = [userId, ...Object.values(validUpdates)];
      
      query = `
        INSERT INTO personal_settings (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
    } else {
      // Update existing settings
      const setClause = Object.entries(validUpdates).map(
        ([key, _], index) => `${key} = $${index + 1}`
      ).join(', ');
      
      values = [...Object.values(validUpdates), userId];
      query = `
        UPDATE personal_settings 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $${values.length} 
        RETURNING *
      `;
    }
    
    const { rows } = await pool.query(query, values);
    
    // Parse category_order back to an array for the response
    const responseData = rows[0];
    if (responseData.category_order && typeof responseData.category_order === 'string') {
      try {
        responseData.category_order = JSON.parse(responseData.category_order);
      } catch (error) {
        console.error('Error parsing category_order for response:', error);
        responseData.category_order = [];
      }
    }
    
    res.json({
      success: true,
      data: responseData,
      message: 'Settings updated successfully'
    });
  } catch (err) {
    console.error('Error updating personal settings:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * GET /auto-distribution-rules/:userId - Get user's auto distribution rules
 */
app.get('/auto-distribution-rules/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = 'SELECT * FROM auto_distribution_rules WHERE user_id = $1 ORDER BY id';
    const { rows } = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching auto distribution rules:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * POST /auto-distribution-rules - Create a new auto distribution rule
 */
app.post('/auto-distribution-rules', async (req, res) => {
  try {
    const { user_id, rule_name, amount, source_bucket, dest_bucket } = req.body;
    
    if (!user_id || !rule_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and rule name are required' 
      });
    }
    
    const query = `
      INSERT INTO auto_distribution_rules (user_id, rule_name, amount, source_bucket, dest_bucket)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [user_id, rule_name, amount, source_bucket, dest_bucket]);
    
    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Auto distribution rule created successfully'
    });
  } catch (err) {
    console.error('Error creating auto distribution rule:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * PUT /auto-distribution-rules/:id - Update an auto distribution rule
 */
app.put('/auto-distribution-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['rule_name', 'amount', 'source_bucket', 'dest_bucket'];
    
    const validUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value;
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update' 
      });
    }
    
    const setClause = Object.entries(validUpdates).map(
      ([key, _], index) => `${key} = $${index + 1}`
    ).join(', ');
    
    const values = [...Object.values(validUpdates), id];
    const query = `
      UPDATE auto_distribution_rules 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length} 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Auto distribution rule not found' 
      });
    }
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Auto distribution rule updated successfully'
    });
  } catch (err) {
    console.error('Error updating auto distribution rule:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * DELETE /auto-distribution-rules/:id - Delete an auto distribution rule
 */
app.delete('/auto-distribution-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM auto_distribution_rules WHERE id = $1 RETURNING *';
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Auto distribution rule not found' 
      });
    }
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Auto distribution rule deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting auto distribution rule:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  }
});

/**
 * POST /transactions/split - Splits a shared transaction into multiple transactions
 */
app.post('/transactions/split', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { originalTransactionId, remainingAmount, splitTransactions } = req.body;
    
    // Validate input data
    if (!originalTransactionId || remainingAmount === undefined || !splitTransactions || !Array.isArray(splitTransactions)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data. Required: originalTransactionId, remainingAmount, splitTransactions array'
      });
    }
    
    // Get the original transaction to verify it exists and extract data
    const originalTransactionResult = await client.query(
      'SELECT * FROM shared_transactions WHERE id = $1',
      [originalTransactionId]
    );
    
    if (originalTransactionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Original transaction not found'
      });
    }
    
    const originalTransaction = originalTransactionResult.rows[0];
    const originalAmount = parseFloat(originalTransaction.amount);
    const isNegative = originalAmount < 0; // Track if original amount is negative
    
    // Validate split transactions
    let splitTotal = 0;
    const errors = [];
    
    for (const split of splitTransactions) {
      if (!split.description || !split.amount) {
        errors.push('All split transactions must have a description and amount');
      }
      
      const splitAmount = parseFloat(split.amount);
      if (isNaN(splitAmount)) {
        errors.push('All split amounts must be valid numbers');
      } else {
        splitTotal += Math.abs(splitAmount);
      }
    }
    
    if (errors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }
    
    // Check that split total doesn't exceed original amount
    if (Math.abs(splitTotal) > Math.abs(originalAmount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Split amounts exceed the original transaction amount'
      });
    }
    
    // Before we start, let's try to update the trigger function if needed
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION set_transaction_category()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.category := (
            SELECT category 
            FROM shared_category 
            WHERE bank_category = NEW.bank_category
          );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
    } catch (triggerErr) {
      console.log('Note: Could not update trigger function:', triggerErr.message);
      // Continue anyway, this is just a precaution
    }
    
    // Check if has_split column exists, add it if it doesn't
    try {
      const checkColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'shared_transactions' 
        AND column_name = 'has_split'
      `);
      
      if (checkColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE shared_transactions 
          ADD COLUMN has_split BOOLEAN DEFAULT FALSE
        `);
      }
      
      const checkSplitFromColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'shared_transactions' 
        AND column_name = 'split_from_id'
      `);
      
      if (checkSplitFromColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE shared_transactions 
          ADD COLUMN split_from_id INTEGER REFERENCES shared_transactions(id) ON DELETE SET NULL
        `);
      }
    } catch (columnErr) {
      console.log('Note: Could not check/add columns:', columnErr.message);
      // Continue anyway, this is just a precaution
    }
    
    // Update the original transaction with the remaining amount and mark it as split
    await client.query(
      'UPDATE shared_transactions SET amount = $1, has_split = TRUE WHERE id = $2',
      [remainingAmount, originalTransactionId]
    );
    
    // Insert split transactions
    for (const splitTransaction of splitTransactions) {
      await client.query(
        'INSERT INTO shared_transactions (date, description, amount, bank_category, label, split_from_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          originalTransaction.date,
          splitTransaction.description,
          splitTransaction.amount,
          splitTransaction.bank_category || originalTransaction.bank_category,
          splitTransaction.label || originalTransaction.label,
          originalTransactionId
        ]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Transaction split successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error splitting transaction:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to split transaction',
      details: err.message
    });
  } finally {
    client.release();
  }
});

// Default route for root URL
app.get('/', (req, res) => {
  res.send('Welcome to the Finance Dashboard API! Use /transactions to get transaction data and ?column_name= to filter available data.');
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});