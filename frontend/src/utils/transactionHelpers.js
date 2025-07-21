// Transaction helper utility functions

/**
 * Format currency with proper symbols and abbreviations
 * @param {number} amount - Amount to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, options = {}) => {
  const absAmount = Math.abs(amount);
  const showSign = options.showSign !== false;
  const precision = options.precision !== undefined ? options.precision : 2;
  
  let formatted;
  
  if (absAmount >= 1000000) {
    formatted = `$${(absAmount / 1000000).toFixed(1)}M`;
  } else if (absAmount >= 1000) {
    formatted = `$${(absAmount / 1000).toFixed(1)}k`;
  } else {
    formatted = `$${absAmount.toFixed(precision)}`;
  }
  
  if (showSign && amount < 0) {
    formatted = `-${formatted}`;
  }
  
  return formatted;
};

/**
 * Calculate transaction balance
 * @param {Array} transactions - Array of transactions
 * @param {string} userId - User ID to calculate balance for
 * @returns {number} Balance amount
 */
export const calculateBalance = (transactions, userId) => {
  if (!transactions || !Array.isArray(transactions)) return 0;
  
  return transactions.reduce((total, transaction) => {
    return total + (transaction.amount || 0);
  }, 0);
};
