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
const allowedFields = ['id', 'date', 'description', 'amount', 'category', 'bank_category', 'label'];

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
    const placeholders = fields.map((_, index) => `$${index + 1}`);
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
    const { rows } = await pool.query('SELECT bank_category, category FROM category_mapping');
    
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

// GET /bank-categories - returns all bank categories from the category_mapping table
app.get('/bank-categories', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT DISTINCT bank_category FROM category_mapping');
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

// Default route for root URL
app.get('/', (req, res) => {
  res.send('Welcome to the Finance Dashboard API! Use /transactions to get transaction data and ?column_name= to filter available data.');
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});