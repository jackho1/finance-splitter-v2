/**
 * Filter transactions based on date range
 * @param {Array} transactions - Original transactions array
 * @param {Object} dateFilter - Object with startDate and endDate
 * @returns {Array} - Filtered transactions
 */
export const filterByDate = (transactions, dateFilter) => {
  if (!dateFilter.startDate || !dateFilter.endDate) {
    return transactions;
  }
  
  const startDate = new Date(dateFilter.startDate);
  const endDate = new Date(dateFilter.endDate);
  endDate.setHours(23, 59, 59, 999); // End of day
  
  return transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
    return transactionDate >= startDate && transactionDate <= endDate;
  });
};

/**
 * Filter transactions based on bank categories
 * @param {Array} transactions - Original transactions array
 * @param {Array} bankCategoryFilter - Array of selected bank categories
 * @returns {Array} - Filtered transactions
 */
export const filterByBankCategory = (transactions, bankCategoryFilter) => {
  if (!bankCategoryFilter.length) {
    return transactions;
  }
  
  return transactions.filter(transaction => 
    bankCategoryFilter.includes(transaction.bank_category)
  );
};

/**
 * Filter transactions based on labels
 * @param {Array} transactions - Original transactions array
 * @param {Array} labelFilter - Array of selected labels
 * @returns {Array} - Filtered transactions
 */
export const filterByLabel = (transactions, labelFilter) => {
  if (!labelFilter.length) {
    return transactions;
  }
  
  return transactions.filter(transaction => 
    labelFilter.includes(transaction.label)
  );
};

/**
 * Sort transactions by date
 * @param {Array} transactions - Original transactions array
 * @param {string} sortDirection - Sorting direction ('asc' or 'desc')
 * @returns {Array} - Sorted transactions
 */
export const sortByDate = (transactions, sortDirection) => {
  return [...transactions].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return sortDirection === 'asc' 
      ? dateA - dateB 
      : dateB - dateA;
  });
};

/**
 * Apply all filters and sorting to transactions
 * @param {Array} transactions - Original transactions array
 * @param {Object} filters - Object containing all filter and sort options
 * @returns {Array} - Filtered and sorted transactions
 */
export const applyFilters = (transactions, filters) => {
  const { dateFilter, bankCategoryFilter, labelFilter, sortBy } = filters;
  
  let filtered = [...transactions];
  
  // Apply date filter
  filtered = filterByDate(filtered, dateFilter);
  
  // Apply bank category filter
  filtered = filterByBankCategory(filtered, bankCategoryFilter);
  
  // Apply label filter
  filtered = filterByLabel(filtered, labelFilter);
  
  // Apply sorting
  if (sortBy) {
    const [field, direction] = sortBy.split('-');
    
    if (field === 'date') {
      filtered = sortByDate(filtered, direction);
    }
  }
  
  return filtered;
}; 