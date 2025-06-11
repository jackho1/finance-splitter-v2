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
  // Optimized connection pool configuration for scalability
  max: 10, // Reduced but sufficient pool size
  min: 2, // Keep minimum connections alive
  idleTimeoutMillis: 10000, // Shorter idle timeout for faster connection recycling
  connectionTimeoutMillis: 3000, // Reasonable connection timeout
  acquireTimeoutMillis: 30000, // How long to wait for connection acquisition
  createTimeoutMillis: 15000, // How long to wait when creating a new client
  reapIntervalMillis: 1000, // Check for idle connections every second
  createRetryIntervalMillis: 200, // Retry connection creation quickly
};

// Database connection setup
const pool = new Pool(dbConfig);

// Check and add split transaction columns to tables if they don't exist
const ensureSplitColumnsExist = async () => {
  const client = await pool.connect();
  try {
    // Check and add columns for shared_transactions
    try {
      const checkSharedHasSplitColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'shared_transactions' 
        AND column_name = 'has_split'
      `);
      
      if (checkSharedHasSplitColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE shared_transactions 
          ADD COLUMN has_split BOOLEAN DEFAULT FALSE
        `);
        console.log("Added has_split column to shared_transactions table");
      }
      
      const checkSharedSplitFromColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'shared_transactions' 
        AND column_name = 'split_from_id'
      `);
      
      if (checkSharedSplitFromColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE shared_transactions 
          ADD COLUMN split_from_id INTEGER REFERENCES shared_transactions(id) ON DELETE SET NULL
        `);
        console.log("Added split_from_id column to shared_transactions table");
      }
    } catch (err) {
      console.error("Error checking/adding columns to shared_transactions:", err);
    }
    
    // Check and add columns for personal_transactions
    try {
      const checkPersonalHasSplitColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'personal_transactions' 
        AND column_name = 'has_split'
      `);
      
      if (checkPersonalHasSplitColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE personal_transactions 
          ADD COLUMN has_split BOOLEAN DEFAULT FALSE
        `);
        console.log("Added has_split column to personal_transactions table");
      }
      
      const checkPersonalSplitFromColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'personal_transactions' 
        AND column_name = 'split_from_id'
      `);
      
      if (checkPersonalSplitFromColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE personal_transactions 
          ADD COLUMN split_from_id INTEGER REFERENCES personal_transactions(id) ON DELETE SET NULL
        `);
        console.log("Added split_from_id column to personal_transactions table");
      }
    } catch (err) {
      console.error("Error checking/adding columns to personal_transactions:", err);
    }
    
    // Check and add columns for offset_transactions
    try {
      const checkOffsetHasSplitColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'offset_transactions' 
        AND column_name = 'has_split'
      `);
      
      if (checkOffsetHasSplitColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE offset_transactions 
          ADD COLUMN has_split BOOLEAN DEFAULT FALSE
        `);
        console.log("Added has_split column to offset_transactions table");
      }
      
      const checkOffsetSplitFromColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'offset_transactions' 
        AND column_name = 'split_from_id'
      `);
      
      if (checkOffsetSplitFromColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE offset_transactions 
          ADD COLUMN split_from_id INTEGER REFERENCES offset_transactions(id) ON DELETE SET NULL
        `);
        console.log("Added split_from_id column to offset_transactions table");
      }
    } catch (err) {
      console.error("Error checking/adding columns to offset_transactions:", err);
    }
  } finally {
    client.release();
  }
};

// Run the check when the server starts
ensureSplitColumnsExist().catch(err => {
  console.error("Error ensuring split columns exist:", err);
});

// Middleware
app.use(cors());
app.use(express.json()); // For parsing JSON request bodies

// Allowed columns for filtering and field selection
const allowedFields = ['id', 'date', 'description', 'amount', 'category', 'bank_category', 'label', 'has_split', 'split_from_id'];

/**
 * Helper function to normalize values for comparison
 * Handles null, undefined, empty string normalization
 */
const normalizeValue = (value, fieldType = 'string') => {
  // Handle null/undefined cases
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty string cases
  if (value === '') {
    return null;
  }
  
  // Handle specific field types
  switch (fieldType) {
    case 'number':
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    case 'date':
      if (!value) return null;
      try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      } catch (e) {
        return null;
      }
    default:
      return typeof value === 'string' ? value.trim() || null : value;
  }
};

/**
 * Helper function to check if values are effectively equal
 * Takes into account null/undefined/empty string equivalence
 */
const valuesAreEqual = (oldValue, newValue, fieldType = 'string') => {
  const normalizedOld = normalizeValue(oldValue, fieldType);
  const normalizedNew = normalizeValue(newValue, fieldType);
  
  // Both are null/undefined/empty - considered equal
  if (normalizedOld === null && normalizedNew === null) {
    return true;
  }
  
  // One is null, other is not - not equal
  if ((normalizedOld === null) !== (normalizedNew === null)) {
    return false;
  }
  
  // Both have values - compare them
  return normalizedOld === normalizedNew;
};

/**
 * Helper function to get field type for proper comparison
 */
const getFieldType = (fieldName) => {
  switch (fieldName) {
    case 'amount':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'string';
  }
};

/**
 * Helper function to check if arrays are equal
 */
const arraysAreEqual = (arr1, arr2) => {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, index) => val === arr2[index]);
};

/**
 * Helper function to resolve category name to ID
 */
const resolveCategoryToId = async (client, categoryName, categoryTable) => {
  if (!categoryName || categoryName === '') return null;
  
  const result = await client.query(
    `SELECT id FROM ${categoryTable} WHERE category = $1`,
    [categoryName]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Category '${categoryName}' not found in ${categoryTable}`);
  }
  
  return result.rows[0].id;
};

/**
 * Enhanced helper function to resolve category (name or ID) to ID
 * Handles both category names and existing IDs
 */
const resolveCategoryNameOrIdToId = async (client, categoryValue, categoryTable) => {
  // Handle null/undefined/empty values
  if (!categoryValue || categoryValue === '') {
    return null;
  }
  
  // Check if category is already an ID (number)
  if (typeof categoryValue === 'number' || /^\d+$/.test(categoryValue)) {
    return parseInt(categoryValue);
  }
  
  // It's a category name, need to look up the ID
  const result = await client.query(
    `SELECT id FROM ${categoryTable} WHERE category = $1`,
    [categoryValue]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Category '${categoryValue}' not found in ${categoryTable}`);
  }
  
  return result.rows[0].id;
};

// OPTIMIZED COMBINED ENDPOINTS - Reduces database connections by fetching related data in single transactions

// Combined initial data endpoint to reduce database connections
app.get('/initial-data', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching all initial data in single transaction...');
    
    // Execute all queries in parallel using the same connection
    const [
      categoryMappingsResult,
      transactionsResult,
      labelsResult,
      bankCategoriesResult
    ] = await Promise.all([
      client.query('SELECT * FROM shared_category ORDER BY bank_category'),
      client.query('SELECT * FROM shared_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT DISTINCT label FROM shared_transactions_generalized WHERE label IS NOT NULL ORDER BY label DESC'),
      client.query('SELECT DISTINCT bank_category FROM shared_transactions_generalized WHERE bank_category IS NOT NULL ORDER BY bank_category')
    ]);
    
    // Process the results
    const categoryMappings = {};
    categoryMappingsResult.rows.forEach(row => {
      categoryMappings[row.bank_category] = row.category;
    });
    
    const bankCategories = bankCategoriesResult.rows.map(row => row.bank_category);
    bankCategories.push(null); // Add null as a valid option
    
    const labels = labelsResult.rows.map(row => row.label);
    
    console.log(`Successfully fetched all initial data: ${transactionsResult.rows.length} transactions, ${Object.keys(categoryMappings).length} mappings, ${labels.length} labels, ${bankCategories.length} bank categories`);
    
    res.json({
      success: true,
      data: {
        transactions: transactionsResult.rows,
        categoryMappings,
        labels,
        bankCategories
      }
    });
  } catch (err) {
    console.error('Error fetching initial data:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

// Combined personal data endpoint
app.get('/personal-initial-data', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching all personal initial data in single transaction...');
    
    const [
      personalTransactionsResult,
      personalCategoriesResult,
      autoDistributionRulesResult,
      personalSettingsResult
    ] = await Promise.all([
      client.query('SELECT * FROM personal_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM personal_category ORDER BY category'),
      client.query('SELECT * FROM auto_distribution_rules WHERE user_id = $1 ORDER BY id', ['default']),
      client.query('SELECT * FROM personal_settings WHERE user_id = $1', ['default'])
    ]);
    
    console.log(`Successfully fetched personal data: ${personalTransactionsResult.rows.length} transactions, ${personalCategoriesResult.rows.length} categories, ${autoDistributionRulesResult.rows.length} rules`);
    
    res.json({
      success: true,
      data: {
        personalTransactions: personalTransactionsResult.rows,
        personalCategories: personalCategoriesResult.rows,
        autoDistributionRules: autoDistributionRulesResult.rows,
        personalSettings: personalSettingsResult.rows[0] || {}
      }
    });
  } catch (err) {
    console.error('Error fetching personal initial data:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

// Combined offset data endpoint
app.get('/offset-initial-data', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching all offset initial data in single transaction...');
    
    const [
      offsetTransactionsResult,
      offsetCategoriesResult,
      labelsResult
    ] = await Promise.all([
      client.query('SELECT * FROM offset_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM offset_category ORDER BY category'),
      client.query('SELECT DISTINCT label FROM shared_transactions_generalized WHERE label IS NOT NULL ORDER BY label DESC')
    ]);
    console.log(`Successfully fetched offset data: ${offsetTransactionsResult.rows.length} transactions, ${offsetCategoriesResult.rows.length} categories`);
    
    res.json({
      success: true,
      data: {
        offsetTransactions: offsetTransactionsResult.rows,
        offsetCategories: offsetCategoriesResult.rows.map(item => item.category),
        labels: labelsResult.rows.map(row => row.label)
      }
    });
  } catch (err) {
    console.error('Error fetching offset initial data:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

// Combined budget data endpoint
app.get('/budget-initial-data', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching all budget initial data in single transaction...');
    
    const [
      budgetCategoriesResult,
      transactionsResult,
      categoryMappingsResult
    ] = await Promise.all([
      client.query('SELECT * FROM budget_category ORDER BY category'),
      client.query('SELECT * FROM shared_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM shared_category ORDER BY bank_category')
    ]);
    
    // Process category mappings
    const categoryMappings = {};
    categoryMappingsResult.rows.forEach(row => {
      categoryMappings[row.bank_category] = row.category;
    });
    
    console.log(`Successfully fetched budget data: ${budgetCategoriesResult.rows.length} budget categories, ${transactionsResult.rows.length} transactions`);
    
    res.json({
      success: true,
      data: {
        budgetCategories: budgetCategoriesResult.rows,
        transactions: transactionsResult.rows,
        categoryMappings
      }
    });
  } catch (err) {
    console.error('Error fetching budget initial data:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

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
    const query = `SELECT ${fields} FROM shared_transactions_generalized ${whereClause}`;
    
    const { rows } = await pool.query(query, values);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).send('Server error');
  }
});

/**
 * PUT /transactions/:id - Updates a transaction by ID (OPTIMIZED)
 */
app.put('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Validate the transaction exists first and get current values from the generalized view
    const checkResult = await pool.query('SELECT * FROM shared_transactions_generalized WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    const currentTransaction = checkResult.rows[0];
    
    // Process and validate field updates
    const validUpdates = {};
    const errors = [];
    let hasChanges = false;
    
    for (const [key, value] of Object.entries(updates)) {
      // Only process allowed fields
      if (!allowedFields.includes(key)) {
        errors.push(`Field "${key}" is not allowed for updates`);
        continue;
      }
      
      const fieldType = getFieldType(key);
      let processedValue = value;
      
      // Type validation and conversions based on field type
      switch (key) {
        case 'amount':
          // Handle empty values
          if (value === null || value === undefined || value === '') {
            processedValue = null;
          } else {
            // Ensure amount is a valid number
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
              errors.push('Amount must be a valid number');
              continue;
            } else {
              processedValue = numValue;
            }
          }
          break;
          
        case 'date':
          // Handle empty values
          if (value === null || value === undefined || value === '') {
            processedValue = null;
          } else {
            // Validate date format
            try {
              const dateObj = new Date(value);
              if (isNaN(dateObj.getTime())) {
                errors.push('Invalid date format');
                continue;
              } else {
                processedValue = dateObj.toISOString().split('T')[0]; // Store as YYYY-MM-DD
              }
            } catch (e) {
              errors.push('Invalid date format');
              continue;
            }
          }
          break;
          
        case 'label':
          // Allow empty labels (null), which can be edited later
          processedValue = value === '' ? null : value;
          break;
          
        default:
          // Basic validation for other fields
          if (typeof value === 'string') {
            // Convert empty strings to null for database consistency
            processedValue = value.trim() === '' ? null : value.trim();
          } else {
            processedValue = value;
          }
      }
      
      // OPTIMIZATION: Check if the value has actually changed
      if (!valuesAreEqual(currentTransaction[key], processedValue, fieldType)) {
        validUpdates[key] = processedValue;
        hasChanges = true;
        console.log(`Field '${key}' changed: '${currentTransaction[key]}' -> '${processedValue}'`);
      } else {
        console.log(`Field '${key}' unchanged: '${currentTransaction[key]}' (skipping update)`);
      }
    }
    
    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errors: errors 
      });
    }
    
    // OPTIMIZATION: If no fields actually changed, return early without database operation
    if (!hasChanges) {
      console.log(`No changes detected for transaction ${id}, skipping database update`);
      return res.json({
        success: true,
        data: currentTransaction,
        message: 'No changes detected - transaction not updated',
        optimized: true // Flag to indicate this was an optimized response
      });
    }
    
    // If no valid updates after validation, return error
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update' 
      });
    }
    
    // Build query for database update (update the base table)
    const setClause = Object.entries(validUpdates).map(
      ([key, _], index) => `${key} = $${index + 1}`
    ).join(', ');
    
    const values = [...Object.values(validUpdates), id];
    const query = `UPDATE shared_transactions SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    
    console.log(`Executing database update for transaction ${id} with changes:`, validUpdates);
    
    // Execute the update
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'Update failed' 
      });
    }
    
    // Get the updated transaction from the generalized view to return complete data
    const updatedResult = await pool.query('SELECT * FROM shared_transactions_generalized WHERE id = $1', [id]);
    
    // Return success with updated transaction data from generalized view
    res.json({
      success: true,
      data: updatedResult.rows[0],
      message: 'Transaction updated successfully',
      changedFields: Object.keys(validUpdates)
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
 * PUT /personal-transactions/:id - Updates a personal transaction (OPTIMIZED)
 */
app.put('/personal-transactions/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['date', 'description', 'amount', 'category'];
    
    // Get current transaction for comparison
    const checkResult = await client.query('SELECT * FROM personal_transactions_generalized WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    const currentTransaction = checkResult.rows[0];
    const validUpdates = {};
    let hasChanges = false;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const fieldType = getFieldType(key);
        let processedValue = value;
        
        // Special handling for category field
        if (key === 'category') {
          try {
            processedValue = await resolveCategoryNameOrIdToId(client, value, 'personal_category');
            
            // For comparison, compare the category name, not the ID  
            if (!valuesAreEqual(currentTransaction[key], value, fieldType)) {
              validUpdates[key] = processedValue;  // Store category ID in updates
              hasChanges = true;
              console.log(`Personal transaction field '${key}' changed: '${currentTransaction[key]}' -> '${value}' (ID: ${processedValue})`);
            }
            
            // Skip the general comparison for category
            continue;
          } catch (err) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              success: false, 
              error: err.message 
            });
          }
        } else {
          // Process the value based on field type for non-category fields
          if (fieldType === 'number') {
            processedValue = value === null || value === undefined || value === '' 
              ? null 
              : parseFloat(value);
          } else if (fieldType === 'date') {
            processedValue = value === null || value === undefined || value === '' 
              ? null 
              : new Date(value).toISOString().split('T')[0];
          } else {
            processedValue = value === null || value === undefined || value === '' 
              ? null 
              : (typeof value === 'string' ? value.trim() || null : value);
          }
        }
        
        // OPTIMIZATION: Check if the value has actually changed (skip for category as it's handled above)
        if (key !== 'category' && !valuesAreEqual(currentTransaction[key], processedValue, fieldType)) {
          validUpdates[key] = processedValue;
          hasChanges = true;
          console.log(`Personal transaction field '${key}' changed: '${currentTransaction[key]}' -> '${processedValue}'`);
        }
      }
    }
    
    // OPTIMIZATION: If no fields actually changed, return early
    if (!hasChanges) {
      await client.query('ROLLBACK');
      console.log(`No changes detected for personal transaction ${id}, skipping database update`);
      return res.json({
        success: true,
        data: currentTransaction,
        message: 'No changes detected - transaction not updated',
        optimized: true
      });
    }
    
    if (Object.keys(validUpdates).length === 0) {
      await client.query('ROLLBACK');
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
    
    console.log(`Executing database update for personal transaction ${id} with changes:`, validUpdates);
    
    const updateResult = await client.query(query, values);
    
    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    // Fetch updated data from the generalized view to return to the client
    const updatedResult = await client.query('SELECT * FROM personal_transactions_generalized WHERE id = $1', [id]);
    const updatedTransaction = updatedResult.rows[0];
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: updatedTransaction,
      message: 'Transaction updated successfully',
      changedFields: Object.keys(validUpdates)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating personal transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /offset-transactions/:id - Updates an offset transaction (OPTIMIZED)
 */
app.put('/offset-transactions/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['date', 'description', 'amount', 'category', 'label'];
    
    // Get current transaction for comparison
    const checkResult = await client.query('SELECT * FROM offset_transactions_generalized WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    const currentTransaction = checkResult.rows[0];
    const validUpdates = {};
    let hasChanges = false;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const fieldType = getFieldType(key);
        let processedValue = value;
        
        // Special handling for category field
        if (key === 'category') {
          try {
            processedValue = await resolveCategoryNameOrIdToId(client, value, 'offset_category');
            
            // For comparison, compare the category name, not the ID
            if (!valuesAreEqual(currentTransaction[key], value, fieldType)) {
              validUpdates[key] = processedValue;  // Store category ID in updates
              hasChanges = true;
              console.log(`Offset transaction field '${key}' changed: '${currentTransaction[key]}' -> '${value}' (ID: ${processedValue})`);
            }
            
            // Skip the general comparison for category
            continue;
          } catch (err) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              success: false, 
              error: err.message 
            });
          }
        } else {
          // Process the value based on field type for non-category fields
          if (fieldType === 'number') {
            processedValue = value === null || value === undefined || value === '' 
              ? null 
              : parseFloat(value);
          } else if (fieldType === 'date') {
            processedValue = value === null || value === undefined || value === '' 
              ? null 
              : new Date(value).toISOString().split('T')[0];
          } else {
            processedValue = value === null || value === undefined || value === '' 
              ? null 
              : (typeof value === 'string' ? value.trim() || null : value);
          }
        }
        
        // OPTIMIZATION: Check if the value has actually changed (skip for category as it's handled above)
        if (key !== 'category' && !valuesAreEqual(currentTransaction[key], processedValue, fieldType)) {
          validUpdates[key] = processedValue;
          hasChanges = true;
          console.log(`Offset transaction field '${key}' changed: '${currentTransaction[key]}' -> '${processedValue}'`);
        }
      }
    }
    
    // OPTIMIZATION: If no fields actually changed, return early
    if (!hasChanges) {
      await client.query('ROLLBACK');
      console.log(`No changes detected for offset transaction ${id}, skipping database update`);
      return res.json({
        success: true,
        data: currentTransaction,
        message: 'No changes detected - transaction not updated',
        optimized: true
      });
    }
    
    if (Object.keys(validUpdates).length === 0) {
      await client.query('ROLLBACK');
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
    
    console.log(`Executing database update for offset transaction ${id} with changes:`, validUpdates);
    
    const updateResult = await client.query(query, values);
    
    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    // Fetch updated data from the generalized view to return to the client
    const updatedResult = await client.query('SELECT * FROM offset_transactions_generalized WHERE id = $1', [id]);
    const updatedTransaction = updatedResult.rows[0];
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: updatedTransaction,
      message: 'Transaction updated successfully',
      changedFields: Object.keys(validUpdates)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating offset transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /budget-categories/:id - Updates a budget category's budget amount (OPTIMIZED)
 */
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
    
    // Get current budget for comparison
    const checkResult = await pool.query('SELECT * FROM budget_category WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Budget category not found' 
      });
    }
    
    const currentBudget = checkResult.rows[0];
    
    // OPTIMIZATION: Check if the budget value has actually changed
    if (valuesAreEqual(currentBudget.budget, budgetValue, 'number')) {
      console.log(`No changes detected for budget category ${id} (${budgetValue}), skipping database update`);
      return res.json({
        success: true,
        data: currentBudget,
        message: 'No changes detected - budget not updated',
        optimized: true
      });
    }
    
    console.log(`Budget category ${id} changed: ${currentBudget.budget} -> ${budgetValue}`);
    
    // Update the budget amount
    const { rows } = await pool.query(
      'UPDATE budget_category SET budget = $1 WHERE id = $2 RETURNING id, category, budget',
      [budgetValue, id]
    );
    
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

/**
 * PUT /personal-settings/:userId - Update user's personal settings (OPTIMIZED)
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
    
    // Check if settings exist for this user and get current values
    const checkQuery = 'SELECT * FROM personal_settings WHERE user_id = $1';
    const checkResult = await pool.query(checkQuery, [userId]);
    
    let currentSettings = null;
    if (checkResult.rows.length > 0) {
      currentSettings = checkResult.rows[0];
      // Parse JSON fields for comparison
      if (currentSettings.category_order && typeof currentSettings.category_order === 'string') {
        try {
          currentSettings.category_order = JSON.parse(currentSettings.category_order);
        } catch (error) {
          currentSettings.category_order = [];
        }
      }
    }
    
    const validUpdates = {};
    let hasChanges = false;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        let processedValue = value;
        
        // Special handling for category_order to ensure it's properly stored as JSON
        if (key === 'category_order' && Array.isArray(value)) {
          processedValue = JSON.stringify(value);
          
          // For comparison, we need to compare the actual arrays
          const currentArrayValue = currentSettings ? currentSettings.category_order : [];
          if (!arraysAreEqual(currentArrayValue, value)) {
            validUpdates[key] = processedValue;
            hasChanges = true;
            console.log(`Settings field '${key}' changed`);
          }
        } else {
          // For other fields, do a simple comparison
          const currentValue = currentSettings ? currentSettings[key] : null;
          if (!valuesAreEqual(currentValue, value)) {
            validUpdates[key] = processedValue;
            hasChanges = true;
            console.log(`Settings field '${key}' changed: '${currentValue}' -> '${value}'`);
          }
        }
      }
    }
    
    // OPTIMIZATION: If no fields actually changed, return early
    if (!hasChanges) {
      console.log(`No changes detected for user settings ${userId}, skipping database update`);
      
      let responseData = currentSettings || {
        user_id: userId,
        hide_zero_balance_buckets: false,
        enable_negative_offset_bucket: false,
        selected_negative_offset_bucket: null,
        category_order: [],
        auto_distribution_enabled: false,
        last_auto_distribution_month: null
      };
      
      return res.json({
        success: true,
        data: responseData,
        message: 'No changes detected - settings not updated',
        optimized: true
      });
    }
    
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update' 
      });
    }
    
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
      
      console.log(`Creating new personal settings for user ${userId} with:`, validUpdates);
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
      
      console.log(`Executing database update for personal settings ${userId} with changes:`, validUpdates);
    }
    
    const { rows } = await pool.query(query, values);
    
    // Parse JSON fields back to objects/arrays before returning
    const settings = rows[0];
    if (settings.category_order && typeof settings.category_order === 'string') {
      try {
        settings.category_order = JSON.parse(settings.category_order);
      } catch (error) {
        settings.category_order = [];
      }
    }
    
    res.json({
      success: true,
      data: settings,
      message: checkResult.rows.length === 0 ? 'Personal settings created successfully' : 'Personal settings updated successfully',
      changedFields: Object.keys(validUpdates)
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
 * POST /transactions/budget-impact - Check the impact of a transaction on budgets
 */
app.post('/transactions', async (req, res) => {
  try {
    const transaction = req.body;
    
    // List of required fields for validation
    const requiredFields = ['date', 'description', 'amount'];
    
    // Validation: Ensure all required fields are present
    const validFields = {};
    const errors = [];
    
    for (const field of requiredFields) {
      if (!transaction.hasOwnProperty(field)) {
        errors.push(`Field "${field}" is required`);
      }
    }
    
    // If there are missing fields, return validation error
    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errors: errors 
      });
    }
    
    // Process and validate each field
    for (const [key, value] of Object.entries(transaction)) {
      // Only process allowed fields
      if (!allowedFields.includes(key)) {
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
    
    // Build query for inserting the new transaction (insert into base table)
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
    
    // Get the complete transaction data from the generalized view
    const newTransactionId = rows[0].id;
    const completeResult = await pool.query('SELECT * FROM shared_transactions_generalized WHERE id = $1', [newTransactionId]);
    
    // Return success with new transaction data from generalized view
    res.status(201).json({
      success: true,
      data: completeResult.rows[0],
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
    const { rows } = await pool.query(`SELECT DISTINCT label FROM shared_transactions_generalized 
                                      ORDER BY CASE 
                                        WHEN label = 'Ruby' THEN 1 
                                        WHEN label = 'Jack' THEN 2 
                                        WHEN label = 'Both' THEN 3 
                                        ELSE 4 
                                      END`);
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
      SELECT DISTINCT bank_category, category 
      FROM shared_transactions_generalized 
      WHERE bank_category IS NOT NULL AND category IS NOT NULL
      ORDER BY bank_category
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

// GET /bank-categories - returns all bank categories from the shared_transactions_generalized view
app.get('/bank-categories', async (req, res) => {
  console.log('Fetching bank categories...');
  try {
    const { rows } = await pool.query('SELECT DISTINCT bank_category FROM shared_transactions_generalized WHERE bank_category IS NOT NULL ORDER BY bank_category');
    const bankCategories = rows.map(row => row.bank_category);
    
    // Add null as a valid option
    bankCategories.push(null);
    
    console.log(`Successfully fetched ${bankCategories.length} bank categories`);
    res.json(bankCategories);
  } catch (err) {
    console.error('Error fetching bank categories:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
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
    const query = 'SELECT * FROM personal_transactions_generalized ORDER BY date DESC';
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

// POST /personal-transactions - Creates a new personal transaction (UPDATED TO HANDLE CATEGORY NAMES)
app.post('/personal-transactions', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, description, amount, category } = req.body;
    
    if (!date || !description || amount === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        errors: ['Date, description, and amount are required'] 
      });
    }
    
    // Handle category conversion from name to ID
    let categoryId;
    try {
      categoryId = await resolveCategoryNameOrIdToId(client, category, 'personal_category');
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    const query = `
      INSERT INTO personal_transactions (date, description, amount, category)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const { rows } = await client.query(query, [date, description, amount, categoryId]);
    
    // Get the complete transaction data from the generalized view
    const newTransactionId = rows[0].id;
    const completeResult = await client.query('SELECT * FROM personal_transactions_generalized WHERE id = $1', [newTransactionId]);
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      data: completeResult.rows[0],
      message: 'Transaction created successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating personal transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
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
      'SELECT * FROM personal_transactions_generalized WHERE id = $1',
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
    
    // Check if there are validation errors
    if (errors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }
    
    // Calculate the total of splits + remaining amount
    const totalSplitAndRemaining = Math.abs(remainingAmount) + splitTotal;
    
    // Verify that the splits + remaining amount match the original transaction amount (within a small tolerance)
    const tolerance = 0.01; // 1 cent tolerance for floating-point issues
    const absOriginalAmount = Math.abs(originalAmount);
    
    if (Math.abs(totalSplitAndRemaining - absOriginalAmount) > tolerance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `The total of splits and remaining amount (${totalSplitAndRemaining.toFixed(2)}) does not match the original transaction amount (${absOriginalAmount.toFixed(2)})`
      });
    }
    
    // Create the split transactions
    const createdTransactions = [];
    
    for (const split of splitTransactions) {
      const splitAmount = parseFloat(split.amount);
      // Ensure the split amount has the correct sign
      const adjustedAmount = isNegative ? -Math.abs(splitAmount) : Math.abs(splitAmount);
      
      // Handle category conversion from name to ID
      let categoryId;
      try {
        categoryId = await resolveCategoryNameOrIdToId(client, split.category, 'personal_category');
      } catch (err) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: err.message 
        });
      }
      
      const insertResult = await client.query(
        `INSERT INTO personal_transactions 
         (date, description, amount, category, split_from_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          originalTransaction.date,
          split.description,
          adjustedAmount,
          categoryId,
          originalTransactionId // Set the split_from_id to the original transaction id
        ]
      );
      
      if (insertResult.rows.length === 0) {
        throw new Error(`Failed to create split transaction #${createdTransactions.length + 1}`);
      }
      
      createdTransactions.push(insertResult.rows[0]);
    }
    
    // Update the original transaction amount if there's a remaining amount
    if (Math.abs(remainingAmount) > 0) {
      // Ensure the remaining amount has the same sign as the original transaction
      const newAmount = isNegative ? -Math.abs(remainingAmount) : Math.abs(remainingAmount);
      
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
        remainingAmount: isNegative ? -Math.abs(remainingAmount) : Math.abs(remainingAmount) // Ensure remaining amount has correct sign
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
    const query = 'SELECT * FROM offset_transactions_generalized ORDER BY date DESC';
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

// POST /offset-transactions - Creates a new offset transaction (UPDATED TO HANDLE CATEGORY NAMES)
app.post('/offset-transactions', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, description, amount, category, label } = req.body;
    
    if (!date || !description || amount === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        errors: ['Date, description, and amount are required'] 
      });
    }
    
    // Handle category conversion from name to ID
    let categoryId;
    try {
      categoryId = await resolveCategoryNameOrIdToId(client, category, 'offset_category');
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    const query = `
      INSERT INTO offset_transactions (date, description, amount, category, label)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const { rows } = await client.query(query, [date, description, amount, categoryId, label]);
    
    // Get the complete transaction data from the generalized view
    const newTransactionId = rows[0].id;
    const completeResult = await client.query('SELECT * FROM offset_transactions_generalized WHERE id = $1', [newTransactionId]);
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      data: completeResult.rows[0],
      message: 'Transaction created successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating offset transaction:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
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
      'SELECT * FROM offset_transactions_generalized WHERE id = $1',
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
    
    // Check if there are validation errors
    if (errors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }
    
    // Convert remaining amount to absolute value for comparison
    const absRemainingAmount = Math.abs(parseFloat(remainingAmount));
    
    // Calculate the total of splits + remaining amount
    const totalSplitAndRemaining = absRemainingAmount + splitTotal;
    
    // Verify that the splits + remaining amount match the original transaction amount (within a small tolerance)
    const tolerance = 0.01; // 1 cent tolerance for floating-point issues
    const absOriginalAmount = Math.abs(originalAmount);
    
    if (Math.abs(totalSplitAndRemaining - absOriginalAmount) > tolerance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `The total of splits and remaining amount (${totalSplitAndRemaining.toFixed(2)}) does not match the original transaction amount (${absOriginalAmount.toFixed(2)})`
      });
    }
    
    // Create the split transactions
    const createdTransactions = [];
    
    for (const split of splitTransactions) {
      const splitAmount = parseFloat(split.amount);
      // Ensure the split amount has the correct sign
      const adjustedAmount = isNegative ? -Math.abs(splitAmount) : Math.abs(splitAmount);
      
      // Handle category conversion from name to ID
      let categoryId;
      try {
        categoryId = await resolveCategoryNameOrIdToId(client, split.category, 'offset_category');
      } catch (err) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: err.message 
        });
      }
      
      const insertResult = await client.query(
        `INSERT INTO offset_transactions 
         (date, description, amount, category, label, split_from_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          originalTransaction.date,
          split.description,
          adjustedAmount,
          categoryId,
          split.label || originalTransaction.label,
          originalTransactionId // Set the split_from_id to the original transaction id
        ]
      );
      
      if (insertResult.rows.length === 0) {
        throw new Error(`Failed to create split transaction #${createdTransactions.length + 1}`);
      }
      
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
 * POST /auto-distribution-rules - Create a new auto distribution rule (UPDATED TO HANDLE CATEGORY NAMES)
 */
app.post('/auto-distribution-rules', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { user_id, rule_name, amount, source_bucket, dest_bucket } = req.body;
    
    if (!user_id || !rule_name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and rule name are required' 
      });
    }
    
    // Convert source_bucket from name to ID
    let sourceBucketId;
    try {
      sourceBucketId = await resolveCategoryNameOrIdToId(client, source_bucket, 'personal_category');
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    // Convert dest_bucket from name to ID
    let destBucketId;
    try {
      destBucketId = await resolveCategoryNameOrIdToId(client, dest_bucket, 'personal_category');
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    const query = `
      INSERT INTO auto_distribution_rules (user_id, rule_name, amount, source_bucket, dest_bucket)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const { rows } = await client.query(query, [user_id, rule_name, amount, sourceBucketId, destBucketId]);
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Auto distribution rule created successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating auto distribution rule:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /auto-distribution-rules/:id - Update an auto distribution rule (UPDATED TO HANDLE CATEGORY NAMES)
 */
app.put('/auto-distribution-rules/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['rule_name', 'amount', 'source_bucket', 'dest_bucket'];
    
    // Get current rule for comparison
    const checkResult = await client.query('SELECT * FROM auto_distribution_rules WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Auto distribution rule not found' 
      });
    }
    
    const currentRule = checkResult.rows[0];
    const validUpdates = {};
    let hasChanges = false;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const fieldType = getFieldType(key);
        
        // Handle category bucket conversions
        if (key === 'source_bucket' || key === 'dest_bucket') {
          let bucketId;
          try {
            bucketId = await resolveCategoryNameOrIdToId(client, value, 'personal_category');
          } catch (err) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              success: false, 
              error: err.message 
            });
          }
          
          if (!valuesAreEqual(currentRule[key], bucketId)) {
            validUpdates[key] = bucketId;
            hasChanges = true;
            console.log(`Auto distribution rule field '${key}' changed: '${currentRule[key]}' -> '${bucketId}'`);
          }
        } else {
          // For other fields, do regular comparison
          if (!valuesAreEqual(currentRule[key], value, fieldType)) {
            validUpdates[key] = value;
            hasChanges = true;
            console.log(`Auto distribution rule field '${key}' changed: '${currentRule[key]}' -> '${value}'`);
          }
        }
      }
    }
    
    // OPTIMIZATION: If no fields actually changed, return early
    if (!hasChanges) {
      await client.query('ROLLBACK');
      console.log(`No changes detected for auto distribution rule ${id}, skipping database update`);
      return res.json({
        success: true,
        data: currentRule,
        message: 'No changes detected - rule not updated',
        optimized: true
      });
    }
    
    if (Object.keys(validUpdates).length === 0) {
      await client.query('ROLLBACK');
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
    
    console.log(`Executing database update for auto distribution rule ${id} with changes:`, validUpdates);
    
    const { rows } = await client.query(query, values);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Auto distribution rule updated successfully',
      changedFields: Object.keys(validUpdates)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating auto distribution rule:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
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
 * POST /auto-distribution/apply - Apply auto distribution rules for a user
 */
app.post('/auto-distribution/apply', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { user_id, month_year } = req.body;
    
    if (!user_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }
    
    // Get all auto distribution rules for the user  
    // First get the rules without joins, then resolve category names separately
    const rulesQuery = `
      SELECT 
        adr.id,
        adr.rule_name,
        adr.amount,
        adr.source_bucket,
        adr.dest_bucket
      FROM auto_distribution_rules adr
      WHERE adr.user_id = $1
      ORDER BY adr.id
    `;
    
    const rulesResult = await client.query(rulesQuery, [user_id]);
    const rawRules = rulesResult.rows;
    
    // Resolve category names for each rule separately to avoid JOIN type issues
    const rules = [];
    for (const rule of rawRules) {
      let sourceCategoryName = null;
      let destCategoryName = null;
      
      // Get source category name - handle both IDs and names
      if (rule.source_bucket) {
        try {
          // Check if it's already a number (ID)
          if (typeof rule.source_bucket === 'number' || /^\d+$/.test(rule.source_bucket)) {
            const sourceResult = await client.query(
              'SELECT category FROM personal_category WHERE id = $1',
              [parseInt(rule.source_bucket)]
            );
            if (sourceResult.rows.length > 0) {
              sourceCategoryName = sourceResult.rows[0].category;
            }
          } else {
            // It's a category name, use it directly
            sourceCategoryName = rule.source_bucket;
          }
        } catch (err) {
          console.log(`Could not resolve source category for rule ${rule.id}:`, err.message);
          // If it's a name and lookup failed, use the name itself
          sourceCategoryName = rule.source_bucket;
        }
      }
      
      // Get destination category name - handle both IDs and names
      if (rule.dest_bucket) {
        try {
          // Check if it's already a number (ID)
          if (typeof rule.dest_bucket === 'number' || /^\d+$/.test(rule.dest_bucket)) {
            const destResult = await client.query(
              'SELECT category FROM personal_category WHERE id = $1',
              [parseInt(rule.dest_bucket)]
            );
            if (destResult.rows.length > 0) {
              destCategoryName = destResult.rows[0].category;
            }
          } else {
            // It's a category name, use it directly
            destCategoryName = rule.dest_bucket;
          }
        } catch (err) {
          console.log(`Could not resolve destination category for rule ${rule.id}:`, err.message);
          // If it's a name and lookup failed, use the name itself
          destCategoryName = rule.dest_bucket;
        }
      }
      
      rules.push({
        ...rule,
        source_category_name: sourceCategoryName,
        dest_category_name: destCategoryName
      });
    }
    
    if (rules.length === 0) {
      await client.query('ROLLBACK');
      return res.json({
        success: true,
        message: 'No auto distribution rules found',
        appliedCount: 0
      });
    }
    
    const currentDate = new Date();
    const monthYearStr = month_year || `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`;
    
    let successCount = 0;
    let failureCount = 0;
    const createdTransactions = [];
    
    for (const rule of rules) {
      try {
        // Validate rule data more robustly (check for null/undefined, but allow 0 as valid ID)
        if (rule.source_bucket === null || rule.source_bucket === undefined || 
            rule.dest_bucket === null || rule.dest_bucket === undefined || 
            !rule.amount || rule.amount <= 0) {
          failureCount++;
          console.log(`Skipping rule ${rule.id}: Invalid source/dest bucket or amount`, {
            source_bucket: rule.source_bucket,
            dest_bucket: rule.dest_bucket,
            amount: rule.amount
          });
          continue;
        }
        
        // Convert category names or IDs to valid integer IDs
        let sourceBucketId, destBucketId;
        try {
          sourceBucketId = await resolveCategoryNameOrIdToId(client, rule.source_bucket, 'personal_category');
          destBucketId = await resolveCategoryNameOrIdToId(client, rule.dest_bucket, 'personal_category');
        } catch (err) {
          failureCount++;
          console.log(`Skipping rule ${rule.id}: Could not resolve category IDs - ${err.message}`, {
            source_bucket: rule.source_bucket,
            dest_bucket: rule.dest_bucket
          });
          continue;
        }
        
        if (sourceBucketId === null || destBucketId === null) {
          failureCount++;
          console.log(`Skipping rule ${rule.id}: Resolved category IDs are null`, {
            source_bucket: rule.source_bucket,
            dest_bucket: rule.dest_bucket,
            sourceBucketId,
            destBucketId
          });
          continue;
        }
        
        // Create source transaction (negative amount) - using the validated integer category ID
        const sourceResult = await client.query(
          `INSERT INTO personal_transactions 
           (date, description, amount, category)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [
            currentDate.toISOString().split('T')[0],
            `${rule.rule_name || 'Monthly Budget Distribution'} - ${monthYearStr}`,
            -Math.abs(rule.amount),
            sourceBucketId // Use the validated integer ID
          ]
        );
        
        // Create destination transaction (positive amount) - using the validated integer category ID
        const destResult = await client.query(
          `INSERT INTO personal_transactions 
           (date, description, amount, category)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [
            currentDate.toISOString().split('T')[0],
            `${rule.rule_name || 'Monthly Budget Distribution'} - ${monthYearStr}`,
            Math.abs(rule.amount),
            destBucketId // Use the validated integer ID
          ]
        );
        
        createdTransactions.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          source_transaction_id: sourceResult.rows[0].id,
          dest_transaction_id: destResult.rows[0].id,
          amount: rule.amount,
          source_category: rule.source_category_name,
          dest_category: rule.dest_category_name
        });
        
        successCount++;
      } catch (err) {
        console.error(`Error applying rule ${rule.id}:`, err);
        failureCount++;
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Auto distribution completed: ${successCount} rules applied successfully, ${failureCount} failed`,
      data: {
        appliedCount: successCount,
        failedCount: failureCount,
        createdTransactions: createdTransactions,
        monthYear: monthYearStr
      }
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error applying auto distribution:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: err.message 
    });
  } finally {
    client.release();
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
    
    // Get the original transaction from the generalized view to verify it exists and extract data
    const originalTransactionResult = await client.query(
      'SELECT * FROM shared_transactions_generalized WHERE id = $1',
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
    
    // Update the original transaction with the remaining amount and mark it as split (update base table)
    await client.query(
      'UPDATE shared_transactions SET amount = $1, has_split = TRUE WHERE id = $2',
      [remainingAmount, originalTransactionId]
    );
    
    // Insert split transactions (insert into base table)
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
  console.log('📊 Database optimization features enabled:');
  console.log('  - Value comparison before database updates');
  console.log('  - Skips unnecessary database operations');
  console.log('  - Detailed logging of changes vs. no-changes');
  console.log('  - Optimized responses for unchanged data');
  console.log('🚀 Enhanced features:');
  console.log('  - Auto distribution rules support category names');
  console.log('  - Personal/offset transaction creation handles category name-to-ID conversion');
  console.log('  - Transaction splits handle category name-to-ID conversion');
  console.log('  - New /auto-distribution/apply endpoint for applying rules');
});