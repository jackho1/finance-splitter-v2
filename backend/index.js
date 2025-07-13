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

// Check and create personal split tables if they don't exist
const ensurePersonalSplitTablesExist = async () => {
  const client = await pool.connect();
  try {
    // Create personal_split_groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS personal_split_groups (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        group_name VARCHAR(255) NOT NULL,
        personal_category VARCHAR(255) NOT NULL,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, group_name)
      )
    `);

    // Create personal_split_mapping table
    await client.query(`
      CREATE TABLE IF NOT EXISTS personal_split_mapping (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        personal_split_group_id INTEGER NOT NULL,
        budget_category VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, personal_split_group_id, budget_category),
        FOREIGN KEY (personal_split_group_id) REFERENCES personal_split_groups(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Personal split tables ensured');
  } catch (err) {
    console.error('❌ Error ensuring personal split tables exist:', err);
  } finally {
    client.release();
  }
};

const ensureBudgetCategoriesExist = async () => {
  const client = await pool.connect();
  try {
    // Check if budget_category table has any data
    const countResult = await client.query('SELECT COUNT(*) as count FROM budget_category');
    const count = parseInt(countResult.rows[0].count);

    if (count === 0) {
      console.log('📊 Budget category table is empty, populating with default categories...');

      // Common budget categories with default budgets
      const defaultCategories = [
        { category: 'Vehicle', budget: 100.00 },
        { category: 'Entertainment', budget: 100.00 },
        { category: 'Food', budget: 500.00 },
        { category: 'Home', budget: 100.00 },
        { category: 'Medical', budget: 50.00 },
        { category: 'Personal Items', budget: 120.00 },
        { category: 'Travel', budget: 50.00 },
        { category: 'Other', budget: 100 },
        { category: 'Mortgage', budget: 2500.00 },
        { category: 'Bills', budget: 1000.00 },
        { category: 'Savings', budget: 1000.00 },
        { category: 'Gifts', budget: 150.00 },
        { category: 'Holidays', budget: 300.00 }
      ];

      for (const { category, budget } of defaultCategories) {
        await client.query(
          'INSERT INTO budget_category (category, budget) VALUES ($1, $2) ON CONFLICT (category) DO NOTHING',
          [category, budget]
        );
      }

      console.log(`✅ Populated budget_category table with ${defaultCategories.length} default categories`);
    } else {
      console.log(`✅ Budget category table already has ${count} categories`);
    }
  } catch (err) {
    console.error('❌ Error ensuring budget categories exist:', err);
  } finally {
    client.release();
  }
};

// Run the checks when the server starts
ensureSplitColumnsExist().catch(err => {
  console.error("Error ensuring split columns exist:", err);
});

ensurePersonalSplitTablesExist().catch(err => {
  console.error("Error ensuring personal split tables exist:", err);
});

ensureBudgetCategoriesExist().catch(err => {
  console.error("Error ensuring budget categories exist:", err);
});

// Middleware
app.use(cors());
app.use(express.json()); // For parsing JSON request bodies

// Allowed columns for filtering and field selection
const allowedFields = ['id', 'date', 'description', 'amount', 'category', 'bank_category', 'label', 'has_split', 'split_from_id', 'mark'];

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
    case 'boolean':
      if (value === null || value === undefined) return null;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        if (value.trim() === '') return null;
        return value.toLowerCase() === 'true' || value === '1';
      }
      return Boolean(value);
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
    case 'mark':
    case 'has_split':
      return 'boolean';
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

// Helper function to resolve category ID back to category name
const resolveCategoryIdToName = async (client, categoryValue, categoryTable) => {
  // Handle null/undefined/empty values
  if (!categoryValue || categoryValue === '') {
    return null;
  }

  // Check if it's already a category name (string that's not a number)
  if (typeof categoryValue === 'string' && !/^\d+$/.test(categoryValue)) {
    return categoryValue;
  }

  // It's a number/ID, so resolve to name
  const result = await client.query(
    `SELECT category FROM ${categoryTable} WHERE id = $1`,
    [parseInt(categoryValue)]
  );

  if (result.rows.length === 0) {
    throw new Error(`Category ID '${categoryValue}' not found in ${categoryTable}`);
  }

  return result.rows[0].category;
};

// OPTIMIZED COMBINED ENDPOINTS - Reduces database connections by fetching related data in single transactions

// Combined initial data endpoint to reduce database connections
app.get('/initial-data', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching all initial data in single transaction...');

    // Get transaction type ID for shared transactions
    const transactionTypeResult = await client.query(
      'SELECT id FROM transaction_types WHERE code = $1',
      ['shared']
    );
    
    const sharedTransactionTypeId = transactionTypeResult.rows[0]?.id || 1;

    // Execute all queries in parallel using the same connection
    const [
      categoryMappingsResult,
      transactionsResult,
      labelsResult,
      bankCategoriesResult,
      usersResult,
      splitAllocationsResult
    ] = await Promise.all([
      client.query('SELECT * FROM shared_category ORDER BY bank_category'),
      client.query('SELECT * FROM shared_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM users'),
      client.query('SELECT DISTINCT bank_category FROM shared_transactions_generalized WHERE bank_category IS NOT NULL ORDER BY bank_category'),
      // New: Fetch all active users
      client.query(`
        SELECT id, username, display_name, email, is_active, created_at, preferences, metadata
        FROM users 
        WHERE is_active = true 
        ORDER BY display_name, username
      `),
      // New: Fetch bulk split allocation data for all shared transactions
      client.query(`
        SELECT 
          tsc.transaction_id,
          tsa.id as allocation_id,
          tsa.split_id,
          tsa.user_id,
          tsa.amount,
          tsa.percentage,
          tsa.is_paid,
          tsa.paid_date,
          tsa.notes,
          tsa.created_at,
          u.username,
          u.display_name,
          tsc.id as config_id,
          st.code as split_type_code,
          st.label as split_type_label
        FROM transaction_split_allocations tsa
        JOIN transaction_split_configs tsc ON tsa.split_id = tsc.id
        JOIN split_types st ON tsc.split_type_id = st.id
        JOIN users u ON tsa.user_id = u.id
        WHERE tsc.transaction_type_id = $1
        ORDER BY tsc.transaction_id, u.display_name, u.username
      `, [sharedTransactionTypeId])
    ]);

    // Process the results
    const categoryMappings = {};
    categoryMappingsResult.rows.forEach(row => {
      categoryMappings[row.bank_category] = row.category;
    });

    const bankCategories = bankCategoriesResult.rows.map(row => row.bank_category);
    bankCategories.push(null); // Add null as a valid option

    const labels = labelsResult.rows.map(row => row.label);

    // Process split allocations into a transaction-keyed structure for frontend performance
    const splitAllocations = {};
    splitAllocationsResult.rows.forEach(allocation => {
      const transactionId = allocation.transaction_id;
      if (!splitAllocations[transactionId]) {
        splitAllocations[transactionId] = [];
      }
      splitAllocations[transactionId].push({
        allocation_id: allocation.allocation_id,
        split_id: allocation.split_id,
        user_id: allocation.user_id,
        amount: parseFloat(allocation.amount),
        percentage: allocation.percentage,
        is_paid: allocation.is_paid,
        paid_date: allocation.paid_date,
        notes: allocation.notes,
        created_at: allocation.created_at,
        username: allocation.username,
        display_name: allocation.display_name,
        config_id: allocation.config_id,
        split_type_code: allocation.split_type_code,
        split_type_label: allocation.split_type_label
      });
    });

    console.log(`Successfully fetched all initial data: ${transactionsResult.rows.length} transactions, ${Object.keys(categoryMappings).length} mappings, ${labels.length} labels, ${bankCategories.length} bank categories, ${usersResult.rows.length} users, ${Object.keys(splitAllocations).length} transactions with split allocations`);

    res.json({
      success: true,
      data: {
        transactions: transactionsResult.rows,
        categoryMappings,
        labels,
        bankCategories,
        users: usersResult.rows,
        splitAllocations: splitAllocations
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

    // Get the default user ID (assuming username 'Jack' or create one if doesn't exist)
    let defaultUserId = 1; // fallback default
    try {
      const defaultUserResult = await client.query('SELECT id FROM users WHERE username = $1', ['Jack']);
      if (defaultUserResult.rows.length > 0) {
        defaultUserId = defaultUserResult.rows[0].id;
      }
    } catch (userErr) {
      console.log('Note: Could not fetch default user, using fallback ID 1:', userErr.message);
    }

    const [
      personalTransactionsResult,
      personalCategoriesResult,
      autoDistributionRulesResult,
      personalSettingsResult
    ] = await Promise.all([
      client.query('SELECT * FROM personal_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM personal_category ORDER BY category'),
      client.query('SELECT * FROM auto_distribution_rules WHERE user_id = $1 ORDER BY id', [defaultUserId]),
      client.query('SELECT * FROM personal_settings WHERE user_id = $1', [defaultUserId])
    ]);

    // Resolve category IDs back to category names for auto distribution rules
    const rulesWithNames = await Promise.all(autoDistributionRulesResult.rows.map(async (rule) => {
      const sourceBucket = rule.source_bucket ?
        await resolveCategoryIdToName(client, rule.source_bucket, 'personal_category') :
        null;
      const destBucket = rule.dest_bucket ?
        await resolveCategoryIdToName(client, rule.dest_bucket, 'personal_category') :
        null;

      return {
        ...rule,
        source_bucket: sourceBucket,
        dest_bucket: destBucket
      };
    }));

    console.log(`Successfully fetched personal data: ${personalTransactionsResult.rows.length} transactions, ${personalCategoriesResult.rows.length} categories, ${autoDistributionRulesResult.rows.length} rules`);

    res.json({
      success: true,
      data: {
        personalTransactions: personalTransactionsResult.rows,
        personalCategories: personalCategoriesResult.rows,
        autoDistributionRules: rulesWithNames,
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

    // Get the offset transaction type ID
    const offsetTransactionTypeResult = await client.query('SELECT id FROM transaction_types WHERE code = $1', ['offset']);
    const offsetTransactionTypeId = offsetTransactionTypeResult.rows.length > 0 ? offsetTransactionTypeResult.rows[0].id : null;

    const [
      offsetTransactionsResult,
      offsetCategoriesResult,
      labelsResult,
      // New: Fetch all active users
      usersResult,
      // New: Fetch bulk split allocation data for all offset transactions
      splitAllocationsResult
    ] = await Promise.all([
      client.query('SELECT * FROM offset_transactions_generalized ORDER BY date DESC'),
      client.query('SELECT * FROM offset_category ORDER BY category'),
      client.query('SELECT * FROM users'),
      client.query(`
        SELECT id, username, display_name, email, is_active, created_at, preferences, metadata
        FROM users 
        WHERE is_active = true 
        ORDER BY display_name, username
      `),
      // Get split allocations for offset transactions if offset transaction type exists
      offsetTransactionTypeId ? client.query(`
        SELECT 
          tsc.transaction_id,
          tsa.id as allocation_id,
          tsa.split_id,
          tsa.user_id,
          tsa.amount,
          tsa.percentage,
          tsa.is_paid,
          tsa.paid_date,
          tsa.notes,
          tsa.created_at,
          u.username,
          u.display_name,
          tsc.id as config_id,
          st.code as split_type_code,
          st.label as split_type_label
        FROM transaction_split_allocations tsa
        JOIN transaction_split_configs tsc ON tsa.split_id = tsc.id
        JOIN split_types st ON tsc.split_type_id = st.id
        JOIN users u ON tsa.user_id = u.id
        WHERE tsc.transaction_type_id = $1
        ORDER BY tsc.transaction_id, u.display_name, u.username
      `, [offsetTransactionTypeId]) : { rows: [] }
    ]);

    // Process split allocations into a transaction-keyed structure for frontend performance
    const splitAllocations = {};
    splitAllocationsResult.rows.forEach(allocation => {
      const transactionId = allocation.transaction_id;
      if (!splitAllocations[transactionId]) {
        splitAllocations[transactionId] = [];
      }
      splitAllocations[transactionId].push({
        allocation_id: allocation.allocation_id,
        split_id: allocation.split_id,
        user_id: allocation.user_id,
        amount: parseFloat(allocation.amount),
        percentage: allocation.percentage,
        is_paid: allocation.is_paid,
        paid_date: allocation.paid_date,
        notes: allocation.notes,
        created_at: allocation.created_at,
        username: allocation.username,
        display_name: allocation.display_name,
        config_id: allocation.config_id,
        split_type_code: allocation.split_type_code,
        split_type_label: allocation.split_type_label
      });
    });

    console.log(`Successfully fetched offset data: ${offsetTransactionsResult.rows.length} transactions, ${offsetCategoriesResult.rows.length} categories, ${usersResult.rows.length} users, ${Object.keys(splitAllocations).length} transactions with split allocations`);

    res.json({
      success: true,
      data: {
        offsetTransactions: offsetTransactionsResult.rows,
        offsetCategories: offsetCategoriesResult.rows.map(item => item.category),
        labels: labelsResult.rows.map(row => row.label),
        users: usersResult.rows,
        splitAllocations: splitAllocations
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
 * PUT /transactions/bulk-update-mark - Bulk update mark field for multiple transactions
 */
app.put('/transactions/bulk-update-mark', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { transaction_ids, mark_value, date_from, date_to, filters } = req.body;

    // Validate that mark_value is provided and is boolean
    if (mark_value === undefined || mark_value === null) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'mark_value is required and must be a boolean (true/false)'
      });
    }

    // Convert mark_value to boolean
    const markBoolean = Boolean(mark_value);

    // Build WHERE clause based on provided criteria
    const whereConditions = [];
    const queryParams = [markBoolean]; // First parameter is always the mark value
    let paramIndex = 2;

    // Filter by specific transaction IDs if provided
    if (transaction_ids && Array.isArray(transaction_ids) && transaction_ids.length > 0) {
      // Convert IDs to integers to match the database column type
      const intIds = transaction_ids.map(id => parseInt(id, 10));
      whereConditions.push(`id = ANY($${paramIndex}::integer[])`);
      queryParams.push(intIds);
      paramIndex++;
    }

    // Filter by date range if provided
    if (date_from) {
      whereConditions.push(`date >= $${paramIndex}`);
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereConditions.push(`date <= $${paramIndex}`);
      queryParams.push(date_to);
      paramIndex++;
    }

    // Apply additional filters if provided
    if (filters && typeof filters === 'object') {
      for (const [key, value] of Object.entries(filters)) {
        if (allowedFields.includes(key) && key !== 'mark') { // Don't filter by mark since we're updating it
          whereConditions.push(`${key} = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        }
      }
    }

    // Ensure we have at least one condition to prevent updating all records
    if (whereConditions.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'At least one filter condition is required (transaction_ids, date_from, date_to, or filters)'
      });
    }

    const whereClause = whereConditions.join(' AND ');

    // First, get the transactions that will be updated for logging
    // Build separate query params for the SELECT (without mark_value)
    const selectQueryParams = [];
    const selectWhereConditions = [];
    let selectParamIndex = 1;

    // Rebuild WHERE clause for SELECT query (without mark_value parameter)
    if (transaction_ids && Array.isArray(transaction_ids) && transaction_ids.length > 0) {
      const intIds = transaction_ids.map(id => parseInt(id, 10));
      selectWhereConditions.push(`id = ANY($${selectParamIndex}::integer[])`);
      selectQueryParams.push(intIds);
      selectParamIndex++;
    }

    if (date_from) {
      selectWhereConditions.push(`date >= $${selectParamIndex}`);
      selectQueryParams.push(date_from);
      selectParamIndex++;
    }

    if (date_to) {
      selectWhereConditions.push(`date <= $${selectParamIndex}`);
      selectQueryParams.push(date_to);
      selectParamIndex++;
    }

    if (filters && typeof filters === 'object') {
      for (const [key, value] of Object.entries(filters)) {
        if (allowedFields.includes(key) && key !== 'mark') {
          selectWhereConditions.push(`${key} = $${selectParamIndex}`);
          selectQueryParams.push(value);
          selectParamIndex++;
        }
      }
    }

    const selectWhereClause = selectWhereConditions.join(' AND ');
    const selectQuery = `SELECT id, date, description, amount, mark FROM shared_transactions WHERE ${selectWhereClause}`;

    const selectResult = await client.query(selectQuery, selectQueryParams);
    const transactionsToUpdate = selectResult.rows;

    if (transactionsToUpdate.length === 0) {
      await client.query('ROLLBACK');
      return res.json({
        success: true,
        message: 'No transactions found matching the specified criteria',
        updated_count: 0,
        transactions: []
      });
    }

    // Count how many will actually change
    const transactionsToChange = transactionsToUpdate.filter(tx => tx.mark !== markBoolean);

    if (transactionsToChange.length === 0) {
      await client.query('ROLLBACK');
      return res.json({
        success: true,
        message: `All ${transactionsToUpdate.length} matching transactions already have mark=${markBoolean}`,
        updated_count: 0,
        transactions: transactionsToUpdate,
        optimized: true
      });
    }

    // Execute the bulk update
    const updateQuery = `
      UPDATE shared_transactions 
      SET mark = $1 
      WHERE ${whereClause} 
      AND mark != $1
      RETURNING id, date, description, amount, mark
    `;

    console.log('Update query:', updateQuery);
    console.log('Update query params:', queryParams);
    const updateResult = await client.query(updateQuery, queryParams);
    const updatedTransactions = updateResult.rows;

    await client.query('COMMIT');

    console.log(`✅ Bulk updated ${updatedTransactions.length} transactions with mark=${markBoolean}`);

    res.json({
      success: true,
      message: `Successfully updated ${updatedTransactions.length} transactions`,
      updated_count: updatedTransactions.length,
      mark_value: markBoolean,
      transactions: updatedTransactions,
      filters_applied: {
        transaction_ids: transaction_ids?.length || 0,
        date_from,
        date_to,
        additional_filters: filters ? Object.keys(filters).length : 0
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in bulk update mark:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({
      success: false,
      error: 'Server error during bulk update',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  } finally {
    client.release();
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

        case 'mark':
          // Handle boolean mark field
          if (value === null || value === undefined || value === '') {
            processedValue = false; // Default to false for empty values
          } else if (typeof value === 'boolean') {
            processedValue = value;
          } else if (typeof value === 'string') {
            // Convert string representations to boolean
            processedValue = value.toLowerCase() === 'true' || value === '1';
          } else {
            // Convert other truthy/falsy values
            processedValue = Boolean(value);
          }
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
    const { userId: userIdParam } = req.params;
    const updates = req.body;

    // Convert userId to integer (handle 'default' or string values)
    let userId = 1; // fallback default
    if (userIdParam && userIdParam !== 'default') {
      const parsedId = parseInt(userIdParam, 10);
      if (!isNaN(parsedId)) {
        userId = parsedId;
      }
    }

    const allowedFields = [
      'hide_zero_balance_buckets',
      'enable_negative_offset_bucket',
      'selected_negative_offset_bucket',
      'category_order',
      'auto_distribution_enabled',
      'last_auto_distribution_month',
      'personal_split_enabled',
      'personal_split_default_days'
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
        last_auto_distribution_month: null,
        personal_split_enabled: false,
        personal_split_default_days: 7
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

        case 'mark':
          // Handle boolean mark field for new transactions
          if (value === null || value === undefined || value === '') {
            validFields[key] = false; // Default to false for empty values
          } else if (typeof value === 'boolean') {
            validFields[key] = value;
          } else if (typeof value === 'string') {
            // Convert string representations to boolean
            validFields[key] = value.toLowerCase() === 'true' || value === '1';
          } else {
            // Convert other truthy/falsy values
            validFields[key] = Boolean(value);
          }
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
    const { rows } = await pool.query(`SELECT label 
FROM (
  SELECT DISTINCT label 
  FROM shared_transactions_generalized
) AS sub
ORDER BY CASE 
  WHEN label = 'Ruby' THEN 1 
  WHEN label = 'Jack' THEN 2 
  WHEN label = 'Both' THEN 3 
  ELSE 4 
END;
`);
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
app.get('/budget-categories-with-budgets', async (req, res) => {
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
    const { userId: userIdParam } = req.params;

    // Convert userId to integer (handle 'default' or string values)
    let userId = 1; // fallback default
    if (userIdParam && userIdParam !== 'default') {
      const parsedId = parseInt(userIdParam, 10);
      if (!isNaN(parsedId)) {
        userId = parsedId;
      }
    }

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
          last_auto_distribution_month: null,
          personal_split_enabled: false,
          personal_split_default_days: 7
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
  const client = await pool.connect();
  try {
    const { userId: userIdParam } = req.params;

    // Convert userId to integer (handle 'default' or string values)
    let userId = 1; // fallback default
    if (userIdParam && userIdParam !== 'default') {
      const parsedId = parseInt(userIdParam, 10);
      if (!isNaN(parsedId)) {
        userId = parsedId;
      }
    }

    const query = 'SELECT * FROM auto_distribution_rules WHERE user_id = $1 ORDER BY id';
    const { rows } = await client.query(query, [userId]);

    // Resolve category IDs back to category names
    const rulesWithNames = await Promise.all(rows.map(async (rule) => {
      const sourceBucket = rule.source_bucket ?
        await resolveCategoryIdToName(client, rule.source_bucket, 'personal_category') :
        null;
      const destBucket = rule.dest_bucket ?
        await resolveCategoryIdToName(client, rule.dest_bucket, 'personal_category') :
        null;

      return {
        ...rule,
        source_bucket: sourceBucket,
        dest_bucket: destBucket
      };
    }));

    res.json({
      success: true,
      data: rulesWithNames
    });
  } catch (err) {
    console.error('Error fetching auto distribution rules:', err);
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

    // Update the last auto distribution month in personal settings
    const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    
    // Check if settings exist for this user
    const settingsCheck = await client.query('SELECT * FROM personal_settings WHERE user_id = $1', [user_id]);
    
    if (settingsCheck.rows.length === 0) {
      // Create new settings record with last distribution month
      await client.query(`
        INSERT INTO personal_settings (user_id, last_auto_distribution_month) 
        VALUES ($1, $2)
      `, [user_id, currentMonthKey]);
    } else {
      // Update existing settings record
      await client.query(`
        UPDATE personal_settings 
        SET last_auto_distribution_month = $1 
        WHERE user_id = $2
      `, [currentMonthKey, user_id]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Auto distribution completed: ${successCount} rules applied successfully, ${failureCount} failed`,
      data: {
        appliedCount: successCount,
        failedCount: failureCount,
        createdTransactions: createdTransactions,
        monthYear: monthYearStr,
        lastDistributionMonth: currentMonthKey
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
        'INSERT INTO shared_transactions (date, description, amount, bank_category, label, split_from_id, mark) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          originalTransaction.date,
          splitTransaction.description,
          splitTransaction.amount,
          splitTransaction.bank_category || originalTransaction.bank_category,
          splitTransaction.label || originalTransaction.label,
          originalTransactionId,
          splitTransaction.mark !== undefined ? splitTransaction.mark : originalTransaction.mark || false
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

/**
 * GET /shared-transactions-filtered - Get filtered shared transactions for personal splitting
 * Query params: startDate, endDate, user (defaults to current user when authentication is implemented)
 */
app.get('/shared-transactions-filtered', async (req, res) => {
  try {
    const { startDate, endDate, user = 'Jack', userId: userIdParam } = req.query;

    // Build dynamic query with filters
    let query = 'SELECT * FROM shared_transactions_generalized WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    // Add date filters if provided (inclusive)
    if (startDate) {
      query += ` AND date >= $${paramIndex}`;
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND date <= $${paramIndex}`;
      values.push(endDate);
      paramIndex++;
    }

    // Filter by user (user's transactions and Both transactions)
    query += ` AND (label = $${paramIndex} OR label = 'Both')`;
    values.push(user);
    paramIndex++;

    // Add ordering
    query += ' ORDER BY date DESC';

    const { rows } = await pool.query(query, values);

    // Convert userId to integer (handle 'default' or string values)
    let userId = 1; // fallback default
    if (userIdParam && userIdParam !== 'default') {
      const parsedId = parseInt(userIdParam, 10);
      if (!isNaN(parsedId)) {
        userId = parsedId;
      }
    }

    // Get user's personal split configuration from database
    const splitConfigQuery = `
      SELECT psg.group_name, psg.personal_category, 
             array_agg(psm.budget_category) as categories
      FROM personal_split_groups psg
      LEFT JOIN personal_split_mapping psm ON psg.id = psm.personal_split_group_id
      WHERE psg.user_id = $1 AND psg.is_active = true
      GROUP BY psg.id, psg.group_name, psg.personal_category, psg.display_order
      ORDER BY psg.display_order, psg.group_name
    `;

    const splitConfigResult = await pool.query(splitConfigQuery, [userId]);

    // Group transactions by budget category for splitting calculation
    const categoryTotals = {};
    let totalAmount = 0;

    rows.forEach(transaction => {
      const category = transaction.category || 'Uncategorized';
      let amount = parseFloat(transaction.amount) || 0;

      // Only process transactions with label "user" or "Both"
      if (transaction.label !== user && transaction.label !== 'Both') {
        return; // Skip this transaction
      }

      // For "Both" transactions, divide by 2 to get user's portion
      if (transaction.label === 'Both') {
        amount = amount / 2;
      }

      if (!categoryTotals[category]) {
        categoryTotals[category] = {
          total: 0,
          count: 0,
          transactions: []
        };
      }

      // Keep the actual negative amounts for expenses
      categoryTotals[category].total += amount;
      categoryTotals[category].count += 1;
      categoryTotals[category].transactions.push(transaction);
      totalAmount += amount;
    });

    // Initialize grouped totals based on user configuration
    const groupedTotals = {};

    // Process user's split configuration
    splitConfigResult.rows.forEach(config => {
      const groupName = config.group_name;
      const categories = config.categories || [];

      groupedTotals[groupName] = {
        total: 0,
        count: 0,
        categories: categories.filter(cat => cat !== null), // Remove null categories
        personalCategory: config.personal_category,
        transactions: []
      };
    });

    // Add a default group for unconfigured categories if none exists
    const hasDefaultGroup = Object.keys(groupedTotals).some(groupName =>
      groupedTotals[groupName].personalCategory === 'original' ||
      groupName.toLowerCase().includes('expenditure') ||
      groupName.toLowerCase().includes('default')
    );

    if (!hasDefaultGroup) {
      groupedTotals['Uncategorized'] = {
        total: 0,
        count: 0,
        categories: [],
        personalCategory: 'original', // Stays in original transaction
        transactions: []
      };
    }

    // Aggregate categories into groups based on user configuration
    Object.entries(categoryTotals).forEach(([category, data]) => {
      let assignedToGroup = false;

      Object.entries(groupedTotals).forEach(([groupName, groupData]) => {
        if (groupData.categories.includes(category)) {
          groupData.total += data.total;
          groupData.count += data.count;
          groupData.transactions.push(...data.transactions);
          assignedToGroup = true;
        }
      });

      // If category doesn't match any configured group, assign to default/uncategorized group
      if (!assignedToGroup) {
        const defaultGroupName = Object.keys(groupedTotals).find(groupName =>
          groupedTotals[groupName].personalCategory === 'original' ||
          groupName.toLowerCase().includes('expenditure') ||
          groupName.toLowerCase().includes('default') ||
          groupName === 'Uncategorized'
        ) || 'Uncategorized';

        if (groupedTotals[defaultGroupName]) {
          groupedTotals[defaultGroupName].total += data.total;
          groupedTotals[defaultGroupName].count += data.count;
          groupedTotals[defaultGroupName].transactions.push(...data.transactions);
        }
      }
    });

    // Calculate grand total
    const grandTotal = Object.values(groupedTotals).reduce((sum, group) => sum + group.total, 0);

    res.json({
      success: true,
      data: {
        transactions: rows,
        categoryTotals,
        groupedTotals,
        totalAmount: grandTotal,
        filters: { startDate, endDate, user, userId },
        count: rows.length,
        userSplitConfig: splitConfigResult.rows
      }
    });
  } catch (err) {
    console.error('Error fetching filtered shared transactions:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * GET /personal-split-groups/:userId - Get user's personal split groups
 */
app.get('/personal-split-groups/:userId', async (req, res) => {
  try {
    const { userId: userIdParam } = req.params;

    // Convert userId to integer (handle 'default' or string values)
    let userId = 1; // fallback default
    if (userIdParam && userIdParam !== 'default') {
      const parsedId = parseInt(userIdParam, 10);
      if (!isNaN(parsedId)) {
        userId = parsedId;
      }
    }

    const query = `
      SELECT psg.*, 
             array_agg(
               json_build_object(
                 'id', psm.id,
                 'budget_category', psm.budget_category
               ) ORDER BY psm.budget_category
             ) FILTER (WHERE psm.id IS NOT NULL) as mapped_categories
      FROM personal_split_groups psg
      LEFT JOIN personal_split_mapping psm ON psg.id = psm.personal_split_group_id AND psm.user_id = $1
      WHERE psg.user_id = $1 AND psg.is_active = true
      GROUP BY psg.id
      ORDER BY psg.display_order, psg.id
    `;

    const { rows } = await pool.query(query, [userId]);

    // Convert array_agg result to proper format
    const processedRows = rows.map(row => ({
      ...row,
      mapped_categories: row.mapped_categories && row.mapped_categories[0] ? row.mapped_categories : []
    }));

    res.json({
      success: true,
      data: processedRows
    });
  } catch (err) {
    console.error('Error fetching personal split groups:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * POST /personal-split-groups - Create a new personal split group
 */
app.post('/personal-split-groups', async (req, res) => {
  try {
    const { user_id, group_name, personal_category, display_order = 0 } = req.body;

    if (!user_id || !group_name || !personal_category) {
      return res.status(400).json({
        success: false,
        error: 'User ID, group name, and personal category are required'
      });
    }

    const query = `
      INSERT INTO personal_split_groups (user_id, group_name, personal_category, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [user_id, group_name, personal_category, display_order]);

    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Personal split group created successfully'
    });
  } catch (err) {
    console.error('Error creating personal split group:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * PUT /personal-split-groups/:id - Update a personal split group
 */
app.put('/personal-split-groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['group_name', 'personal_category', 'display_order', 'is_active'];

    // Get current group for comparison
    const checkResult = await pool.query('SELECT * FROM personal_split_groups WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Personal split group not found'
      });
    }

    const currentGroup = checkResult.rows[0];
    const validUpdates = {};
    let hasChanges = false;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const fieldType = getFieldType(key);
        if (!valuesAreEqual(currentGroup[key], value, fieldType)) {
          validUpdates[key] = value;
          hasChanges = true;
          console.log(`Personal split group field '${key}' changed: '${currentGroup[key]}' -> '${value}'`);
        }
      }
    }

    if (!hasChanges) {
      return res.json({
        success: true,
        data: currentGroup,
        message: 'No changes detected - group not updated',
        optimized: true
      });
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
      UPDATE personal_split_groups 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length} 
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);

    res.json({
      success: true,
      data: rows[0],
      message: 'Personal split group updated successfully',
      changedFields: Object.keys(validUpdates)
    });
  } catch (err) {
    console.error('Error updating personal split group:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * DELETE /personal-split-groups/:id - Delete/deactivate a personal split group
 */
app.delete('/personal-split-groups/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check if the group exists
    const checkResult = await client.query('SELECT * FROM personal_split_groups WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Personal split group not found'
      });
    }

    // Delete associated mappings first
    await client.query('DELETE FROM personal_split_mapping WHERE personal_split_group_id = $1', [id]);

    // Delete the group
    await client.query('DELETE FROM personal_split_groups WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Personal split group and associated mappings deleted successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting personal split group:', err);
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
 * GET /personal-split-mapping/:userId - Get user's personal split category mappings
 */
app.get('/personal-split-mapping/:userId', async (req, res) => {
  try {
    const { userId: userIdParam } = req.params;

    // Convert userId to integer (handle 'default' or string values)
    let userId = 1; // fallback default
    if (userIdParam && userIdParam !== 'default') {
      const parsedId = parseInt(userIdParam, 10);
      if (!isNaN(parsedId)) {
        userId = parsedId;
      }
    }

    const query = `
      SELECT psm.*, psg.group_name, psg.personal_category
      FROM personal_split_mapping psm
      JOIN personal_split_groups psg ON psm.personal_split_group_id = psg.id
      WHERE psm.user_id = $1 AND psg.is_active = true
      ORDER BY psg.display_order, psg.group_name, psm.budget_category
    `;

    const { rows } = await pool.query(query, [userId]);

    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching personal split mappings:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * POST /personal-split-mapping - Create new personal split category mappings
 */
app.post('/personal-split-mapping', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { user_id, personal_split_group_id, budget_categories } = req.body;

    if (!user_id || !personal_split_group_id || !Array.isArray(budget_categories)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'User ID, personal split group ID, and budget categories array are required'
      });
    }

    // Verify the group exists and belongs to the user
    const groupCheck = await client.query(
      'SELECT id FROM personal_split_groups WHERE id = $1 AND user_id = $2',
      [personal_split_group_id, user_id]
    );

    if (groupCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Personal split group not found or does not belong to user'
      });
    }

    const insertedMappings = [];

    // Insert each category mapping
    for (const budget_category of budget_categories) {
      try {
        const result = await client.query(`
          INSERT INTO personal_split_mapping (user_id, personal_split_group_id, budget_category)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, personal_split_group_id, budget_category) DO NOTHING
          RETURNING *
        `, [user_id, personal_split_group_id, budget_category]);

        if (result.rows.length > 0) {
          insertedMappings.push(result.rows[0]);
        }
      } catch (mappingErr) {
        console.warn(`Skipping duplicate mapping for category ${budget_category}:`, mappingErr.message);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: insertedMappings,
      message: `${insertedMappings.length} personal split mappings created successfully`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating personal split mappings:', err);
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
 * DELETE /personal-split-mapping/:id - Delete a personal split category mapping
 */
app.delete('/personal-split-mapping/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the mapping exists
    const checkResult = await pool.query('SELECT * FROM personal_split_mapping WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Personal split mapping not found'
      });
    }

    await pool.query('DELETE FROM personal_split_mapping WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Personal split mapping deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting personal split mapping:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * DELETE /personal-split-mapping/bulk/:userId - Delete multiple mappings for a user
 */
app.delete('/personal-split-mapping/bulk/:userId', async (req, res) => {
  try {
    const { userId: userIdParam } = req.params;
    const { personal_split_group_id, budget_categories } = req.body;

    // Convert userId to integer (handle 'default' or string values)
    let userId = 1; // fallback default
    if (userIdParam && userIdParam !== 'default') {
      const parsedId = parseInt(userIdParam, 10);
      if (!isNaN(parsedId)) {
        userId = parsedId;
      }
    }

    if (!personal_split_group_id || !Array.isArray(budget_categories)) {
      return res.status(400).json({
        success: false,
        error: 'Personal split group ID and budget categories array are required'
      });
    }

    const placeholders = budget_categories.map((_, index) => `$${index + 3}`).join(', ');
    const query = `
      DELETE FROM personal_split_mapping 
      WHERE user_id = $1 
      AND personal_split_group_id = $2 
      AND budget_category IN (${placeholders})
    `;

    const values = [userId, personal_split_group_id, ...budget_categories];
    const result = await pool.query(query, values);

    res.json({
      success: true,
      message: `${result.rowCount} personal split mappings deleted successfully`
    });
  } catch (err) {
    console.error('Error bulk deleting personal split mappings:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * GET /budget-categories - Get all available budget categories for configuration
 */
app.get('/budget-categories', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT category 
      FROM budget_category 
      WHERE category IS NOT NULL 
      ORDER BY category
    `;

    const { rows } = await pool.query(query);

    res.json({
      success: true,
      data: rows.map(row => row.category)
    });
  } catch (err) {
    console.error('Error fetching budget categories:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

// ===== NEW USER MANAGEMENT AND SPLIT ALLOCATION ENDPOINTS =====

/**
 * Helper function to determine transaction table and validate transaction exists
 * Uses transaction_types table for dynamic table resolution
 */
const getTransactionTable = async (client, transactionId, transactionTypeCode) => {
  // Get transaction type and table name from database
  const transactionTypeResult = await client.query(
    'SELECT id, code, label, table_name FROM transaction_types WHERE code = $1',
    [transactionTypeCode]
  );

  if (transactionTypeResult.rows.length === 0) {
    throw new Error(`Invalid transaction type: ${transactionTypeCode}`);
  }

  const transactionType = transactionTypeResult.rows[0];
  const tableName = transactionType.table_name;

  if (!tableName) {
    throw new Error(`No table name configured for transaction type: ${transactionTypeCode}`);
  }

  // Verify transaction exists
  const result = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [transactionId]);
  if (result.rows.length === 0) {
    throw new Error(`Transaction not found in ${tableName}`);
  }

  return { 
    table: tableName, 
    transaction: result.rows[0],
    transactionType: transactionType
  };
};

/**
 * Helper function to calculate split allocations based on split type
 */
const calculateSplitAllocations = (totalAmount, splitType, users) => {
  const allocations = [];
  const absAmount = Math.abs(totalAmount);
  
  switch (splitType.code) {
    case 'equal':
      const equalAmount = absAmount / users.length;
      users.forEach(user => {
        allocations.push({
          user_id: user.id,
          amount: totalAmount < 0 ? -equalAmount : equalAmount,
          percentage: (100 / users.length).toFixed(2)
        });
      });
      break;
      
    case 'percentage':
      // For percentage splits, percentages should be provided in the request
      users.forEach(user => {
        if (!user.percentage) {
          throw new Error(`Percentage not provided for user ${user.id}`);
        }
        const amount = (absAmount * user.percentage / 100);
        allocations.push({
          user_id: user.id,
          amount: totalAmount < 0 ? -amount : amount,
          percentage: user.percentage
        });
      });
      break;
      
    case 'fixed':
      // For fixed splits, amounts should be provided in the request
      users.forEach(user => {
        if (!user.amount) {
          throw new Error(`Fixed amount not provided for user ${user.id}`);
        }
        
        // Ensure fixed amounts respect the original transaction's sign direction
        const userAbsAmount = Math.abs(user.amount);
        const signCorrectedAmount = totalAmount < 0 ? -userAbsAmount : userAbsAmount;
        const percentage = ((userAbsAmount / absAmount) * 100).toFixed(2);
        
        allocations.push({
          user_id: user.id,
          amount: signCorrectedAmount,
          percentage: percentage
        });
      });
      break;
      
    default:
      throw new Error(`Unsupported split type: ${splitType.code}`);
  }
  
  return allocations;
};

/**
 * Helper function to validate split allocations sum to 100%
 */
const validateSplitAllocations = (allocations, totalAmount) => {
  const totalAllocated = allocations.reduce((sum, allocation) => sum + Math.abs(allocation.amount), 0);
  const totalPercentage = allocations.reduce((sum, allocation) => sum + parseFloat(allocation.percentage), 0);
  
  const tolerance = 0.01; // 1 cent tolerance for floating-point issues
  const absTotalAmount = Math.abs(totalAmount);
  
  if (Math.abs(totalAllocated - absTotalAmount) > tolerance) {
    throw new Error(`Split allocations total (${totalAllocated.toFixed(2)}) does not match transaction amount (${absTotalAmount.toFixed(2)})`);
  }
  
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Split percentages total (${totalPercentage.toFixed(2)}%) does not equal 100%`);
  }
};

/**
 * GET /users - Fetch all active users
 */
app.get('/users', async (req, res) => {
  try {
    const query = `
      SELECT id, username, display_name, email, is_active, created_at, preferences, metadata
      FROM users 
      WHERE is_active = true 
      ORDER BY display_name, username
    `;
    
    const { rows } = await pool.query(query);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * GET /split-types - Get available split types
 */
app.get('/split-types', async (req, res) => {
  try {
    const query = 'SELECT * FROM split_types ORDER BY is_default DESC, id';
    const { rows } = await pool.query(query);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching split types:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * GET /transaction-types - Get available transaction types
 */
app.get('/transaction-types', async (req, res) => {
  try {
    const query = 'SELECT * FROM transaction_types ORDER BY is_default DESC, id';
    const { rows } = await pool.query(query);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching transaction types:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  }
});

/**
 * GET /transactions/:id/split-config - Get split configuration for any transaction
 * Query params: transaction_type (required) - 'shared', 'personal', or 'offset'
 */
app.get('/transactions/:id/split-config', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { transaction_type } = req.query;
    
    if (!transaction_type) {
      return res.status(400).json({
        success: false,
        error: 'transaction_type query parameter is required (shared, personal, or offset)'
      });
    }
    
    // Verify transaction exists using dynamic table resolution
    const { table, transaction, transactionType } = await getTransactionTable(client, id, transaction_type);
    
    // Get split configuration
    const splitConfigQuery = `
      SELECT tsc.*, st.code as split_type_code, st.label as split_type_label, 
             tt.code as transaction_type_code, tt.label as transaction_type_label
      FROM transaction_split_configs tsc
      JOIN split_types st ON tsc.split_type_id = st.id
      JOIN transaction_types tt ON tsc.transaction_type_id = tt.id
      WHERE tsc.transaction_id = $1 AND tsc.transaction_type_id = $2
    `;
    
    const splitConfigResult = await client.query(splitConfigQuery, [id, transactionType.id]);
    
    if (splitConfigResult.rows.length === 0) {
      // ===== BACKWARDS COMPATIBILITY SECTION - MARK FOR FUTURE DELETION =====
      console.log(`🔄 LEGACY FALLBACK: No split config found for ${transaction_type} transaction ${id}, checking for legacy label-based splitting`);
      
      // Check if this is a legacy transaction with label-based splitting
      let legacyData = null;
      if (transaction_type === 'shared' && transaction.label) {
        if (transaction.label === 'Both') {
          // Legacy "Both" transaction - would be split equally between Ruby and Jack
          const usersResult = await client.query('SELECT id, username, display_name FROM users WHERE username IN ($1, $2)', ['Ruby', 'Jack']);
          legacyData = {
            legacy_mode: true,
            original_label: transaction.label,
            split_type: 'equal',
            users: usersResult.rows,
            estimated_allocations: usersResult.rows.map(user => ({
              user_id: user.id,
              username: user.username,
              display_name: user.display_name,
              amount: parseFloat(transaction.amount) / 2,
              percentage: 50
            }))
          };
        } else if (transaction.label === 'Ruby' || transaction.label === 'Jack') {
          // Legacy single-user transaction
          const userResult = await client.query('SELECT id, username, display_name FROM users WHERE username = $1', [transaction.label]);
          if (userResult.rows.length > 0) {
            legacyData = {
              legacy_mode: true,
              original_label: transaction.label,
              split_type: 'equal',
              users: userResult.rows,
              estimated_allocations: [{
                user_id: userResult.rows[0].id,
                username: userResult.rows[0].username,
                display_name: userResult.rows[0].display_name,
                amount: parseFloat(transaction.amount),
                percentage: 100
              }]
            };
          }
        }
      }
      // ===== END BACKWARDS COMPATIBILITY SECTION =====
      
      return res.json({
        success: true,
        data: null,
        message: 'No split configuration found for this transaction',
        legacy_data: legacyData
      });
    }
    
    const splitConfig = splitConfigResult.rows[0];
    
    res.json({
      success: true,
      data: {
        config: splitConfig,
        transaction: transaction,
        table_used: table
      }
    });
    
  } catch (err) {
    console.error('Error fetching split configuration:', err);
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
 * GET /transactions/:id/allocations - Get split allocations for any transaction
 * Query params: transaction_type (required) - 'shared', 'personal', or 'offset'
 */
app.get('/transactions/:id/allocations', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { transaction_type } = req.query;
    
    if (!transaction_type) {
      return res.status(400).json({
        success: false,
        error: 'transaction_type query parameter is required (shared, personal, or offset)'
      });
    }
    
    // Verify transaction exists using dynamic table resolution
    const { table, transaction, transactionType } = await getTransactionTable(client, id, transaction_type);
    
    // Get split configuration and allocations
    const allocationsQuery = `
      SELECT tsa.*, u.username, u.display_name, 
             tsc.id as config_id, st.code as split_type_code, st.label as split_type_label
      FROM transaction_split_allocations tsa
      JOIN transaction_split_configs tsc ON tsa.split_id = tsc.id
      JOIN split_types st ON tsc.split_type_id = st.id
      JOIN users u ON tsa.user_id = u.id
      WHERE tsc.transaction_id = $1 AND tsc.transaction_type_id = $2
      ORDER BY u.display_name, u.username
    `;
    
    const allocationsResult = await client.query(allocationsQuery, [id, transactionType.id]);
    
    if (allocationsResult.rows.length === 0) {
      // ===== BACKWARDS COMPATIBILITY SECTION - MARK FOR FUTURE DELETION =====
      console.log(`🔄 LEGACY FALLBACK: No split allocations found for ${transaction_type} transaction ${id}, checking for legacy label-based splitting`);
      
      // Check if this is a legacy transaction with label-based splitting
      let legacyAllocations = null;
      if (transaction_type === 'shared' && transaction.label) {
        if (transaction.label === 'Both') {
          // Legacy "Both" transaction - split equally between Ruby and Jack
          const usersResult = await client.query('SELECT id, username, display_name FROM users WHERE username IN ($1, $2)', ['Ruby', 'Jack']);
          legacyAllocations = usersResult.rows.map(user => ({
            user_id: user.id,
            username: user.username,
            display_name: user.display_name,
            amount: parseFloat(transaction.amount) / 2,
            percentage: 50,
            is_paid: false,
            legacy_mode: true
          }));
        } else if (transaction.label === 'Ruby' || transaction.label === 'Jack') {
          // Legacy single-user transaction
          const userResult = await client.query('SELECT id, username, display_name FROM users WHERE username = $1', [transaction.label]);
          if (userResult.rows.length > 0) {
            legacyAllocations = [{
              user_id: userResult.rows[0].id,
              username: userResult.rows[0].username,
              display_name: userResult.rows[0].display_name,
              amount: parseFloat(transaction.amount),
              percentage: 100,
              is_paid: false,
              legacy_mode: true
            }];
          }
        }
      }
      // ===== END BACKWARDS COMPATIBILITY SECTION =====
      
      return res.json({
        success: true,
        data: legacyAllocations || [],
        message: legacyAllocations ? 'Showing legacy label-based allocation data' : 'No split allocations found for this transaction',
        legacy_mode: !!legacyAllocations,
        transaction: transaction,
        table_used: table
      });
    }
    
    res.json({
      success: true,
      data: allocationsResult.rows,
      count: allocationsResult.rows.length,
      transaction: transaction,
      table_used: table,
      total_allocated: allocationsResult.rows.reduce((sum, allocation) => sum + parseFloat(allocation.amount), 0)
    });
    
  } catch (err) {
    console.error('Error fetching split allocations:', err);
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
 * POST /transactions/:id/split-config - Create split configuration and allocations
 * Body: { transaction_type, split_type_code, users: [{ id, percentage?, amount? }] }
 */
app.post('/transactions/:id/split-config', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { transaction_type, split_type_code, users, created_by } = req.body;
    
    if (!transaction_type || !split_type_code || !users || !Array.isArray(users)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'transaction_type, split_type_code, and users array are required'
      });
    }
    
    if (users.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'At least one user must be specified for split allocation'
      });
    }
    
    // Verify transaction exists using dynamic table resolution
    const { table, transaction, transactionType } = await getTransactionTable(client, id, transaction_type);
    
    // Get split type
    const splitTypeResult = await client.query('SELECT * FROM split_types WHERE code = $1', [split_type_code]);
    
    if (splitTypeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Invalid split type: ${split_type_code}`
      });
    }
    
    const splitType = splitTypeResult.rows[0];
    
    // Check if split configuration already exists
    const existingConfigResult = await client.query(
      'SELECT id FROM transaction_split_configs WHERE transaction_id = $1 AND transaction_type_id = $2',
      [id, transactionType.id]
    );
    
    if (existingConfigResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Split configuration already exists for this transaction'
      });
    }
    
    // Validate and get user details
    const userIds = users.map(user => user.id);
    const usersResult = await client.query(
      'SELECT id, username, display_name FROM users WHERE id = ANY($1) AND is_active = true',
      [userIds]
    );
    
    if (usersResult.rows.length !== users.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'One or more specified users not found or inactive'
      });
    }
    
    // Calculate split allocations
    const allocations = calculateSplitAllocations(parseFloat(transaction.amount), splitType, users);
    
    // Validate allocations sum to 100%
    validateSplitAllocations(allocations, parseFloat(transaction.amount));
    
    // Create split configuration
    const splitConfigResult = await client.query(`
      INSERT INTO transaction_split_configs (transaction_id, transaction_type_id, split_type_id, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, transactionType.id, splitType.id, created_by || null]);
    
    const splitConfigId = splitConfigResult.rows[0].id;
    
    // Create split allocations
    const createdAllocations = [];
    for (const allocation of allocations) {
      const allocationResult = await client.query(`
        INSERT INTO transaction_split_allocations (split_id, user_id, amount, percentage)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [splitConfigId, allocation.user_id, allocation.amount, allocation.percentage]);
      
      // Join with user data for response
      const userInfo = usersResult.rows.find(user => user.id === allocation.user_id);
      createdAllocations.push({
        ...allocationResult.rows[0],
        username: userInfo.username,
        display_name: userInfo.display_name
      });
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ Created split configuration for ${transaction_type} transaction ${id} with ${users.length} allocations using ${split_type_code} split type (table: ${table})`);
    
    res.status(201).json({
      success: true,
      data: {
        config: splitConfigResult.rows[0],
        allocations: createdAllocations,
        transaction: transaction,
        split_type: splitType,
        table_used: table
      },
      message: 'Split configuration created successfully'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating split configuration:', err);
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
 * PUT /transactions/:id/split-config - Update split configuration and allocations
 * Body: { transaction_type, split_type_code?, users: [{ id, percentage?, amount? }] }
 */
app.put('/transactions/:id/split-config', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { transaction_type, split_type_code, users } = req.body;
    
    if (!transaction_type || !users || !Array.isArray(users)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'transaction_type and users array are required'
      });
    }
    
    // Verify transaction exists using dynamic table resolution
    const { table, transaction, transactionType } = await getTransactionTable(client, id, transaction_type);
    
    // Get existing split configuration
    const existingConfigResult = await client.query(`
      SELECT tsc.*, st.code as split_type_code 
      FROM transaction_split_configs tsc
      JOIN split_types st ON tsc.split_type_id = st.id
      WHERE tsc.transaction_id = $1 AND tsc.transaction_type_id = $2
    `, [id, transactionType.id]);
    
    if (existingConfigResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Split configuration not found for this transaction'
      });
    }
    
    const existingConfig = existingConfigResult.rows[0];
    const currentSplitTypeCode = split_type_code || existingConfig.split_type_code;
    
    // Get split type (current or new)
    const splitTypeResult = await client.query('SELECT * FROM split_types WHERE code = $1', [currentSplitTypeCode]);
    if (splitTypeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Invalid split type: ${currentSplitTypeCode}`
      });
    }
    
    const splitType = splitTypeResult.rows[0];
    
    // Validate users
    const userIds = users.map(user => user.id);
    const usersResult = await client.query(
      'SELECT id, username, display_name FROM users WHERE id = ANY($1) AND is_active = true',
      [userIds]
    );
    
    if (usersResult.rows.length !== users.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'One or more specified users not found or inactive'
      });
    }
    
    // Calculate new allocations
    const allocations = calculateSplitAllocations(parseFloat(transaction.amount), splitType, users);
    
    // Validate allocations sum to 100%
    validateSplitAllocations(allocations, parseFloat(transaction.amount));
    
    // Update split configuration if split type changed
    if (split_type_code && split_type_code !== existingConfig.split_type_code) {
      await client.query(`
        UPDATE transaction_split_configs 
        SET split_type_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [splitType.id, existingConfig.id]);
    }
    
    // Delete existing allocations
    await client.query('DELETE FROM transaction_split_allocations WHERE split_id = $1', [existingConfig.id]);
    
    // Create new allocations
    const createdAllocations = [];
    for (const allocation of allocations) {
      const allocationResult = await client.query(`
        INSERT INTO transaction_split_allocations (split_id, user_id, amount, percentage)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [existingConfig.id, allocation.user_id, allocation.amount, allocation.percentage]);
      
      // Join with user data for response
      const userInfo = usersResult.rows.find(user => user.id === allocation.user_id);
      createdAllocations.push({
        ...allocationResult.rows[0],
        username: userInfo.username,
        display_name: userInfo.display_name
      });
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ Updated split configuration for ${transaction_type} transaction ${id} with ${users.length} allocations using ${currentSplitTypeCode} split type (table: ${table})`);
    
    res.json({
      success: true,
      data: {
        config: { ...existingConfig, split_type_id: splitType.id },
        allocations: createdAllocations,
        transaction: transaction,
        split_type: splitType,
        table_used: table
      },
      message: 'Split configuration updated successfully'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating split configuration:', err);
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
 * DELETE /transactions/:id/split-config - Delete split configuration with audit trail
 * Query params: transaction_type (required)
 * Body: { deleted_by? }
 */
app.delete('/transactions/:id/split-config', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { transaction_type } = req.query;
    const { deleted_by } = req.body || {};
    
    if (!transaction_type) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'transaction_type query parameter is required'
      });
    }
    
    // Verify transaction exists using dynamic table resolution
    const { table, transaction, transactionType } = await getTransactionTable(client, id, transaction_type);
    
    // Get existing split configuration with allocations for audit
    const splitDataQuery = `
      SELECT 
        tsc.*,
        json_agg(
          json_build_object(
            'allocation_id', tsa.id,
            'user_id', tsa.user_id,
            'amount', tsa.amount,
            'percentage', tsa.percentage,
            'is_paid', tsa.is_paid,
            'paid_date', tsa.paid_date,
            'notes', tsa.notes,
            'username', u.username,
            'display_name', u.display_name
          )
        ) as allocations
      FROM transaction_split_configs tsc
      LEFT JOIN transaction_split_allocations tsa ON tsc.id = tsa.split_id
      LEFT JOIN users u ON tsa.user_id = u.id
      WHERE tsc.transaction_id = $1 AND tsc.transaction_type_id = $2
      GROUP BY tsc.id
    `;
    
    const splitDataResult = await client.query(splitDataQuery, [id, transactionType.id]);
    
    if (splitDataResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Split configuration not found for this transaction'
      });
    }
    
    const splitConfig = splitDataResult.rows[0];
    
    // Create audit trail entry
    await client.query(`
      INSERT INTO transaction_split_audit (
        action, transaction_id, transaction_type, split_config_id, split_data, deleted_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'DELETE',
      id,
      transaction_type,
      splitConfig.id,
      JSON.stringify({
        config: splitConfig,
        allocations: splitConfig.allocations,
        transaction: transaction,
        table_used: table
      }),
      deleted_by || null
    ]);
    
    // Delete allocations first (due to foreign key constraint)
    await client.query('DELETE FROM transaction_split_allocations WHERE split_id = $1', [splitConfig.id]);
    
    // Delete split configuration
    await client.query('DELETE FROM transaction_split_configs WHERE id = $1', [splitConfig.id]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Deleted split configuration for ${transaction_type} transaction ${id} with audit trail (table: ${table})`);
    
    res.json({
      success: true,
      message: 'Split configuration deleted successfully',
      audit_id: splitConfig.id,
      deleted_allocations_count: splitConfig.allocations ? splitConfig.allocations.length : 0,
      table_used: table
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting split configuration:', err);
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
 * PUT /transactions/:id/allocations/:allocation_id/payment - Mark allocation as paid/unpaid
 * Body: { is_paid, paid_date?, notes? }
 */
app.put('/transactions/:id/allocations/:allocation_id/payment', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id, allocation_id } = req.params;
    const { is_paid, paid_date, notes } = req.body;
    
    if (is_paid === undefined || is_paid === null) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'is_paid field is required'
      });
    }
    
    // Verify allocation exists and belongs to the transaction
    const allocationResult = await client.query(`
      SELECT tsa.*, tsc.transaction_id, u.username, u.display_name,
             tt.code as transaction_type_code, tt.table_name
      FROM transaction_split_allocations tsa
      JOIN transaction_split_configs tsc ON tsa.split_id = tsc.id
      JOIN transaction_types tt ON tsc.transaction_type_id = tt.id
      JOIN users u ON tsa.user_id = u.id
      WHERE tsa.id = $1 AND tsc.transaction_id = $2
    `, [allocation_id, id]);
    
    if (allocationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Allocation not found for this transaction'
      });
    }
    
    const currentAllocation = allocationResult.rows[0];
    
    // Update allocation payment status
    const updateQuery = `
      UPDATE transaction_split_allocations 
      SET is_paid = $1, paid_date = $2, notes = $3
      WHERE id = $4
      RETURNING *
    `;
    
    const updatedResult = await client.query(updateQuery, [
      is_paid,
      is_paid ? (paid_date || new Date().toISOString()) : null,
      notes || currentAllocation.notes,
      allocation_id
    ]);
    
    await client.query('COMMIT');
    
    const updatedAllocation = {
      ...updatedResult.rows[0],
      username: currentAllocation.username,
      display_name: currentAllocation.display_name,
      transaction_type_code: currentAllocation.transaction_type_code,
      table_used: currentAllocation.table_name
    };
    
    console.log(`✅ Updated payment status for allocation ${allocation_id} to ${is_paid ? 'paid' : 'unpaid'} (transaction: ${currentAllocation.transaction_type_code} ${id})`);
    
    res.json({
      success: true,
      data: updatedAllocation,
      message: `Allocation marked as ${is_paid ? 'paid' : 'unpaid'} successfully`
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating allocation payment status:', err);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: err.message
    });
  } finally {
    client.release();
  }
});

// ===== END NEW USER MANAGEMENT AND SPLIT ALLOCATION ENDPOINTS =====

// Default route for root URL
app.get('/', (req, res) => {
  res.send('Welcome to the Finance Dashboard API! Use /transactions to get transaction data and ?column_name= to filter available data.');
});

app.listen(port, '0.0.0.0', () => {
  // Dynamically fetch BASE_URL from frontend/src/config/apiConfig.js
  const fs = require('fs');
  const path = require('path');

  function getFrontendBaseUrl() {
    try {
      const apiConfigPath = path.join(__dirname, '../frontend/src/config/apiConfig.js');
      const fileContent = fs.readFileSync(apiConfigPath, 'utf8');
      const match = fileContent.match(/BASE_URL:\s*['"`](.*?)['"`]/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (e) {
      // fallback or error
    }
    return `http://0.0.0.0:${port}`;
  }

  const frontendBaseUrl = getFrontendBaseUrl();
  console.log(`✅ Server running on ${frontendBaseUrl}`);
});
