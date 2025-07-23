import { USER_CONFIG } from '../config/userConfig';

/**
 * Returns a label for a transaction based on split allocations and users.
 * @param {Object} transaction - The transaction object.
 * @param {Object} splitAllocations - Map of transactionId to allocations array.
 * @param {Array} users - Array of user objects.
 * @param {boolean} isTransactionsLoading - Whether transactions are loading.
 * @returns {string|null}
 */
export function getTransactionLabel(transaction, splitAllocations, users, isTransactionsLoading) {
  if (isTransactionsLoading || !users || users.length === 0) {
    return null;
  }
  if (splitAllocations === null || splitAllocations === undefined) {
    return null;
  }
  const allocations = splitAllocations[transaction.id];
  if (allocations && Array.isArray(allocations) && allocations.length > 0) {
    if (allocations.length === 1) {
      return allocations[0].display_name;
    }
    const isEqualSplit = () => {
      const allEqualType = allocations.every(allocation => allocation.split_type_code === 'equal');
      if (allEqualType) return true;
      if (allocations.length > 1 && allocations[0].percentage) {
        const expectedPercentage = 100 / allocations.length;
        const tolerance = 0.1;
        return allocations.every(allocation => {
          const percentage = parseFloat(allocation.percentage);
          return Math.abs(percentage - expectedPercentage) < tolerance;
        });
      }
      if (allocations.length > 1) {
        const firstAmount = Math.abs(parseFloat(allocations[0].amount));
        const tolerance = 0.01;
        return allocations.every(allocation => {
          const amount = Math.abs(parseFloat(allocation.amount));
          return Math.abs(amount - firstAmount) < tolerance;
        });
      }
      return false;
    };
    if (isEqualSplit()) {
      if (allocations.length === 2) return 'Both';
      if (allocations.length >= 3) return 'All users';
    }
    return `${allocations[0].display_name} +${allocations.length - 1}`;
  } else {
    return null;
  }
}

/**
 * Calculates the total amount for a specific user from filtered transactions.
 * @param {number} userId - The user ID to calculate totals for.
 * @param {Array} filteredTransactions - Transactions filtered by date/other criteria.
 * @param {Object} splitAllocations - Map of transactionId to allocations array.
 * @param {Array} users - Array of user objects.
 * @returns {number} Total amount allocated to the user.
 */
export function getUserTotalFromAllocations(userId, filteredTransactions, splitAllocations, users) {
  let total = 0;
  if (!Array.isArray(filteredTransactions)) {
    return 0;
  }
  filteredTransactions.forEach(transaction => {
    const allocations = splitAllocations[transaction.id];
    if (allocations && Array.isArray(allocations)) {
      const userAllocation = allocations.find(allocation => allocation.user_id === userId);
      if (userAllocation && typeof userAllocation.amount === 'number') {
        total += userAllocation.amount;
      }
    } else {
      if (users && Array.isArray(users) && transaction.label) {
        const user = users.find(u => u.id === userId);
        const activeUsers = users.filter(u => u.username !== 'default' && u.is_active);
        if (user && transaction.label === user.display_name) {
          total += parseFloat(transaction.amount) || 0;
        } else if (user && transaction.label === 'Both' && activeUsers.length >= 2) {
          total += (parseFloat(transaction.amount) || 0) / Math.max(2, activeUsers.length);
        } else if (user && transaction.label === 'All users' && activeUsers.length >= 2) {
          total += (parseFloat(transaction.amount) || 0) / activeUsers.length;
        }
      }
    }
  });
  return typeof total === 'number' && !isNaN(total) ? total : 0;
}

/**
 * Calculates totals for all users based on filtered transactions.
 * @param {Array} filteredTransactions - Transactions filtered by date range, labels, etc.
 * @param {Array} users - Array of user objects.
 * @param {Object} splitAllocations - Map of transactionId to allocations array.
 * @returns {Object} Object with user display names as keys and their totals as values.
 */
export function calculateTotalsFromAllocations(filteredTransactions, users, splitAllocations) {
  const totals = {};
  if (!users || !Array.isArray(users)) {
    return totals;
  }
  const activeUsers = users.filter(user => user.username !== 'default' && user.is_active);
  activeUsers.forEach(user => {
    const userTotal = getUserTotalFromAllocations(user.id, filteredTransactions, splitAllocations, users);
    totals[user.display_name] = typeof userTotal === 'number' && !isNaN(userTotal) ? userTotal : 0;
  });
  return totals;
} 