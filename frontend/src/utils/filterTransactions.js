/**
 * Filter transactions based on date range
 * @param {Array} transactions - Original transactions array
 * @param {Object} dateFilter - Object with startDate and endDate
 * @returns {Array} - Filtered transactions
 */
export const filterByDate = (transactions, dateFilter) => {
  if (!dateFilter.startDate && !dateFilter.endDate) {
    return transactions;
  }
  
  let filtered = [...transactions];
  
  if (dateFilter.startDate) {
    const startDate = new Date(dateFilter.startDate);
    filtered = filtered.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate;
    });
  }
  
  if (dateFilter.endDate) {
    const endDate = new Date(dateFilter.endDate);
    endDate.setHours(23, 59, 59, 999); // End of day
    filtered = filtered.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate <= endDate;
    });
  }
  
  return filtered;
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
  
  return transactions.filter(transaction => {
    const category = transaction.bank_category;
    
    // Check if filtering for null values
    if (bankCategoryFilter.includes(null) && 
        (category === null || category === undefined || category === '')) {
      return true;
    }
    
    // Check if category is in the filter list
    return bankCategoryFilter.includes(category);
  });
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
 * Sort transactions by amount
 * @param {Array} transactions - Original transactions array
 * @param {string} sortDirection - Sorting direction ('asc' or 'desc')
 * @returns {Array} - Sorted transactions
 */
export const sortByAmount = (transactions, sortDirection) => {
  return [...transactions].sort((a, b) => {
    const amountA = parseFloat(a.amount) || 0;
    const amountB = parseFloat(b.amount) || 0;
    return sortDirection === 'asc' 
      ? amountA - amountB 
      : amountB - amountA;
  });
};

/**
 * Sort transactions by description
 * @param {Array} transactions - Original transactions array
 * @param {string} sortDirection - Sorting direction ('asc' or 'desc')
 * @returns {Array} - Sorted transactions
 */
export const sortByDescription = (transactions, sortDirection) => {
  return [...transactions].sort((a, b) => {
    const descA = (a.description || '').toLowerCase();
    const descB = (b.description || '').toLowerCase();
    
    if (descA < descB) return sortDirection === 'asc' ? -1 : 1;
    if (descA > descB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Apply all filters and sorting to transactions
 * @param {Array} transactions - Original transactions array
 * @param {Object} filters - Object containing all filter and sort options
 * @returns {Array} - Filtered and sorted transactions
 */
export const applyFilters = (transactions, filters) => {
  const { dateFilter = {}, bankCategoryFilter = [], labelFilter = [], sortBy } = filters;
  
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
    
    switch (field) {
      case 'date':
        filtered = sortByDate(filtered, direction);
        break;
      case 'amount':
        filtered = sortByAmount(filtered, direction);
        break;
      case 'description':
        filtered = sortByDescription(filtered, direction);
        break;
      default:
        // Default to date descending if no valid sort option
        filtered = sortByDate(filtered, 'desc');
    }
  }
  
  return filtered;
};