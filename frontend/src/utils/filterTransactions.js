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
    // Set to start of day to ensure we include the entire start date
    startDate.setHours(0, 0, 0, 0);
    
    filtered = filtered.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      // Set transaction date to start of day for fair comparison
      transactionDate.setHours(0, 0, 0, 0);
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
 * @param {Function} getTransactionLabel - Optional function to get dynamic labels
 * @returns {Array} - Filtered transactions
 */
export const filterByLabel = (transactions, labelFilter, getTransactionLabel) => {
  if (!labelFilter.length) {
    return transactions;
  }
  
  return transactions.filter(transaction => {
    // Get both static and dynamic labels
    const staticLabel = transaction.label;
    const dynamicLabel = getTransactionLabel ? getTransactionLabel(transaction) : null;
    
    // Use dynamic label if available, otherwise use static label
    const transactionLabel = (dynamicLabel !== null && dynamicLabel !== undefined) 
      ? dynamicLabel 
      : staticLabel;
    
    // Handle null values properly
    if (labelFilter.includes(null) && (transactionLabel === null || transactionLabel === undefined)) {
      return true;
    }
    
    return labelFilter.includes(transactionLabel);
  });
};

/**
 * Sort transactions by date, then by ID for same date transactions
 * @param {Array} transactions - Original transactions array
 * @param {string} sortDirection - Sorting direction ('asc' or 'desc')
 * @returns {Array} - Sorted transactions
 */
export const sortByDate = (transactions, sortDirection) => {
  return [...transactions].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    
    // First compare by date
    const dateComparison = sortDirection === 'asc' 
      ? dateA - dateB 
      : dateB - dateA;
    
    // If dates are equal (same day), sort by ID
    if (dateComparison === 0) {
      // Assuming ID is numeric or can be converted to numeric
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      
      // For same date, maintain the same sort direction for IDs
      return sortDirection === 'asc' 
        ? idA - idB 
        : idB - idA;
    }
    
    return dateComparison;
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
 * Sort transactions by bank category
 * @param {Array} transactions - Original transactions array
 * @param {string} sortDirection - Sorting direction ('asc' or 'desc')
 * @returns {Array} - Sorted transactions
 */
export const sortByBankCategory = (transactions, sortDirection) => {
  return [...transactions].sort((a, b) => {
    // Handle null/empty values - put them at the end for 'asc', at the beginning for 'desc'
    const catA = (a.bank_category || '').toLowerCase();
    const catB = (b.bank_category || '').toLowerCase();
    
    // If one is empty and the other isn't
    if (!catA && catB) return sortDirection === 'asc' ? 1 : -1;
    if (catA && !catB) return sortDirection === 'asc' ? -1 : 1;
    
    // Both empty or both have values
    if (catA < catB) return sortDirection === 'asc' ? -1 : 1;
    if (catA > catB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Sort transactions by label
 * @param {Array} transactions - Original transactions array
 * @param {string} sortDirection - Sorting direction ('asc' or 'desc')
 * @returns {Array} - Sorted transactions
 */
export const sortByLabel = (transactions, sortDirection) => {
  return [...transactions].sort((a, b) => {
    const labelA = (a.label || '').toLowerCase();
    const labelB = (b.label || '').toLowerCase();
    
    // If one is empty and the other isn't
    if (!labelA && labelB) return sortDirection === 'asc' ? 1 : -1;
    if (labelA && !labelB) return sortDirection === 'asc' ? -1 : 1;
    
    // Both empty or both have values
    if (labelA < labelB) return sortDirection === 'asc' ? -1 : 1;
    if (labelA > labelB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Sort transactions by category (for PersonalTransactions)
 * @param {Array} transactions - Original transactions array
 * @param {string} sortDirection - Sorting direction ('asc' or 'desc')
 * @returns {Array} - Sorted transactions
 */
export const sortByCategory = (transactions, sortDirection) => {
  return [...transactions].sort((a, b) => {
    // Handle null/empty values - put them at the end for 'asc', at the beginning for 'desc'
    const catA = (a.category || '').toLowerCase();
    const catB = (b.category || '').toLowerCase();
    
    // If one is empty and the other isn't
    if (!catA && catB) return sortDirection === 'asc' ? 1 : -1;
    if (catA && !catB) return sortDirection === 'asc' ? -1 : 1;
    
    // Both empty or both have values
    if (catA < catB) return sortDirection === 'asc' ? -1 : 1;
    if (catA > catB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Apply all filters and sorting to transactions
 * @param {Array} transactions - Original transactions array
 * @param {Object} filters - Object containing all filter and sort options
 * @param {Function} getTransactionLabel - Optional function to get dynamic labels
 * @returns {Array} - Filtered and sorted transactions
 */
export const applyFilters = (transactions, filters, getTransactionLabel) => {
  const { dateFilter = {}, bankCategoryFilter = [], labelFilter = [], sortBy } = filters;
  
  let filtered = [...transactions];
  
  // Apply date filter
  filtered = filterByDate(filtered, dateFilter);
  
  // Apply bank category filter
  filtered = filterByBankCategory(filtered, bankCategoryFilter);
  
  // Apply label filter with dynamic label support
  filtered = filterByLabel(filtered, labelFilter, getTransactionLabel);
  
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
      case 'bank_category':
        filtered = sortByBankCategory(filtered, direction);
        break;
      case 'label':
        filtered = sortByLabel(filtered, direction);
        break;
      case 'category':
        filtered = sortByCategory(filtered, direction);
        break;
      default:
        // Default to date descending if no valid sort option
        filtered = sortByDate(filtered, 'desc');
    }
  }
  
  return filtered;
};