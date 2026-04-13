/**
 * Filters transactions by category and/or label
 * @param {Array} transactions - Array of transactions to filter
 * @param {Array} categoryFilter - Array of categories to filter by
 * @param {Array} labelFilter - Array of labels to filter by
 * @param {Function} getTransactionLabel - Function to get transaction label
 * @returns {Array} - Filtered transactions
 */
export const filterTransactionsByCategoryAndLabel = (
  transactions, 
  categoryFilter, 
  labelFilter, 
  getTransactionLabel
) => {
  let filtered = transactions;

  // Apply category filter
  if (categoryFilter.length > 0) {
    filtered = filtered.filter(transaction => {
      if (categoryFilter.includes(null) && !transaction.category) {
        return true;
      }
      return categoryFilter.includes(transaction.category);
    });
  }

  // Apply label filter
  if (labelFilter.length > 0) {
    filtered = filtered.filter(transaction => {
      const transactionLabel = getTransactionLabel(transaction);
      if (labelFilter.includes(null) && !transactionLabel) {
        return true;
      }
      return labelFilter.includes(transactionLabel);
    });
  }

  return filtered;
};

/**
 * Groups split transactions together with their original transactions
 * Handles cases where parent transactions might be filtered out
 * @param {Array} transactions - Array of transactions to group
 * @param {Array} allTransactions - Complete array of all transactions (for finding missing parents)
 * @returns {Array} - Grouped transactions with split transactions following their originals
 */
export const groupSplitTransactions = (transactions, allTransactions = null) => {
  const grouped = [];
  const processedIds = new Set();
  const transactionMap = new Map(transactions.map(t => [t.id, t]));
  
  // If allTransactions provided, create a map for lookup
  const allTransactionsMap = allTransactions 
    ? new Map(allTransactions.map(t => [t.id, t]))
    : transactionMap;
  
  transactions.forEach(transaction => {
    if (processedIds.has(transaction.id)) return;
    
    // If this is an original transaction that has been split
    if (transaction.has_split) {
      // Add the original transaction first
      grouped.push(transaction);
      processedIds.add(transaction.id);
      
      // Find and add all split transactions that came from this original (only those in filtered set)
      const splitTransactions = transactions.filter(t => 
        t.split_from_id === transaction.id && !processedIds.has(t.id)
      );
      
      // Sort split transactions by date to maintain consistency
      splitTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      splitTransactions.forEach(splitTx => {
        grouped.push(splitTx);
        processedIds.add(splitTx.id);
      });
    }
    // If this is a split transaction
    else if (transaction.split_from_id) {
      // Check if the parent is in the filtered set
      const parentInFilteredSet = transactionMap.has(transaction.split_from_id);
      
      if (parentInFilteredSet && !processedIds.has(transaction.split_from_id)) {
        // Parent exists in filtered set, add it first
        const originalTransaction = transactionMap.get(transaction.split_from_id);
        grouped.push(originalTransaction);
        processedIds.add(originalTransaction.id);
        
        // Find and add all split transactions from this original (only those in filtered set)
        const allSplitTransactions = transactions.filter(t => 
          t.split_from_id === originalTransaction.id && !processedIds.has(t.id)
        );
        
        // Sort split transactions by date
        allSplitTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        allSplitTransactions.forEach(splitTx => {
          grouped.push(splitTx);
          processedIds.add(splitTx.id);
        });
      } else if (!parentInFilteredSet) {
        // Parent was filtered out, treat this split transaction as standalone
        grouped.push(transaction);
        processedIds.add(transaction.id);
      }
    }
    // Regular transaction (not split)
    else {
      grouped.push(transaction);
      processedIds.add(transaction.id);
    }
  });
  
  return grouped;
};

/**
 * Applies month filtering to transactions and re-groups split transactions
 * @param {Array} transactions - Array of transactions to filter
 * @param {number} currentMonth - Month to filter by (0-11)
 * @param {number} currentYear - Year to filter by
 * @param {Array} allTransactions - Complete array of all transactions (for maintaining split relationships)
 * @returns {Array} - Filtered and grouped transactions
 */
export const filterByMonth = (transactions, currentMonth, currentYear, allTransactions = null) => {
  const filtered = transactions.filter(transaction => {
    const date = new Date(transaction.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
  
  // Re-group after month filtering to maintain split transaction grouping
  return groupSplitTransactions(filtered, allTransactions);
};