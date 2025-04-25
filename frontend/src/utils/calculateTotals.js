/**
 * Calculates totals for each label based on transaction data
 * @param {Array} filtered - Filtered transactions array
 * @param {Array} labels - Array of labels (usually ['Ruby', 'Jack', 'Both'])
 * @returns {Object} - Object with label totals
 */
export const calculateTotals = (filtered, labels) => {
  const totals = {};
  const bothLabel = labels.length >= 3 ? labels[2] : null;
  const rubyLabel = labels.length >= 1 ? labels[0] : null;
  const jackLabel = labels.length >= 2 ? labels[1] : null;

  // Initialize totals for all labels
  if (rubyLabel) totals[rubyLabel] = 0;
  if (jackLabel) totals[jackLabel] = 0;
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

      // Add half of the amount to Ruby and Jack totals
      if (rubyLabel) totals[rubyLabel] += amount / 2;
      if (jackLabel) totals[jackLabel] += amount / 2;
    } else if (transaction.label && totals[transaction.label] !== undefined) {
      // Add to the specific label's total
      totals[transaction.label] += amount;
    }
  });

  return totals;
}; 