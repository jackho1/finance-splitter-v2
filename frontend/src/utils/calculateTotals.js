import { USER_CONFIG } from '../config/userConfig';

/**
 * Calculates totals for each label based on transaction data
 * @param {Array} filtered - Filtered transactions array
 * @param {Array} labels - Array of labels
 * @returns {Object} - Object with label totals
 */
export const calculateTotals = (filtered, labels = USER_CONFIG.DEFAULT_LABELS) => {
  const totals = {};
  const bothLabel = labels.length >= 3 ? labels[2] : USER_CONFIG.BOTH_LABEL;
  const primaryUser1Label = labels.length >= 1 ? labels[0] : USER_CONFIG.PRIMARY_USER_1;
  const primaryUser2Label = labels.length >= 2 ? labels[1] : USER_CONFIG.PRIMARY_USER_2;

  // Initialize totals for all labels
  if (primaryUser1Label) totals[primaryUser1Label] = 0;
  if (primaryUser2Label) totals[primaryUser2Label] = 0;
  if (bothLabel) totals[bothLabel] = 0;

  // Calculate totals
  filtered.forEach(transaction => {
    // Skip transactions with null/undefined/empty labels
    if (!transaction.label) return;

    // Try to parse the amount and handle invalid values
    let parsed = parseFloat(transaction.amount);
    const amount = !isNaN(parsed) ? parsed : 0;

    if (transaction.label === bothLabel && bothLabel) {
      // Add full amount to "Both" total
      totals[bothLabel] += amount;

      // Add half of the amount to both user totals
      if (primaryUser1Label) totals[primaryUser1Label] += amount / 2;
      if (primaryUser2Label) totals[primaryUser2Label] += amount / 2;
    } else if (transaction.label && totals[transaction.label] !== undefined) {
      // Add to the specific label's total
      totals[transaction.label] += amount;
    }
  });

  return totals;
}; 