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
 * POST /refresh-bank-feeds - Executes the Python script to refresh DB with new transactions
 */
app.post('/refresh-bank-feeds', async (req, res) => {
  try {
    // Path to the Python script
    const scriptPath = path.join(__dirname, 'bank_feeds_psql.py');
    
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

// Default route for root URL
app.get('/', (req, res) => {
  res.send('Welcome to the Finance Dashboard API! Use /transactions to get transaction data and ?column_name= to filter available data.');
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
