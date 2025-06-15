/**
 * Groups split transactions together with their original transactions
 * @param {Array} transactions - Array of transactions to group
 * @returns {Array} - Grouped transactions with split transactions following their originals
 */
export const groupSplitTransactions = (transactions) => {
  const grouped = [];
  const processedIds = new Set();
  
  transactions.forEach(transaction => {
    if (processedIds.has(transaction.id)) return;
    
    // If this is an original transaction that has been split
    if (transaction.has_split) {
      // Add the original transaction first
      grouped.push(transaction);
      processedIds.add(transaction.id);
      
      // Find and add all split transactions that came from this original
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
    // If this is a split transaction but we haven't processed its group yet
    else if (transaction.split_from_id && !processedIds.has(transaction.split_from_id)) {
      // Find the original transaction
      const originalTransaction = transactions.find(t => t.id === transaction.split_from_id);
      
      if (originalTransaction) {
        // Add the original transaction first
        grouped.push(originalTransaction);
        processedIds.add(originalTransaction.id);
        
        // Find and add all split transactions from this original
        const allSplitTransactions = transactions.filter(t => 
          t.split_from_id === originalTransaction.id && !processedIds.has(t.id)
        );
        
        // Sort split transactions by date
        allSplitTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        allSplitTransactions.forEach(splitTx => {
          grouped.push(splitTx);
          processedIds.add(splitTx.id);
        });
      }
    }
    // Regular transaction (not split)
    else if (!transaction.split_from_id && !transaction.has_split) {
      grouped.push(transaction);
      processedIds.add(transaction.id);
    }
  });
  
  return grouped;
}; 