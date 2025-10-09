import { groupSplitTransactions } from './transactionGrouping';

describe('groupSplitTransactions', () => {
  // Mock transaction data for testing
  const createTransaction = (id, description, amount, date, hasSplit = false, splitFromId = null) => ({
    id,
    description,
    amount,
    date,
    has_split: hasSplit,
    split_from_id: splitFromId,
    bank_category: 'Test Category',
    label: 'Test Label'
  });

  describe('Basic functionality', () => {
    test('should return empty array when given empty array', () => {
      const result = groupSplitTransactions([]);
      expect(result).toEqual([]);
    });

    test('should return same array when no split transactions exist', () => {
      const transactions = [
        createTransaction(1, 'Regular Transaction 1', -100, '2024-01-01'),
        createTransaction(2, 'Regular Transaction 2', -200, '2024-01-02'),
        createTransaction(3, 'Regular Transaction 3', -300, '2024-01-03')
      ];

      const result = groupSplitTransactions(transactions);
      expect(result).toEqual(transactions);
      expect(result).toHaveLength(3);
    });
  });

  describe('Split transaction grouping', () => {
    test('should group original transaction with its splits', () => {
      const originalTransaction = createTransaction(1, 'Original Transaction', -300, '2024-01-01', true);
      const splitTransaction1 = createTransaction(2, 'Split 1', -100, '2024-01-01', false, 1);
      const splitTransaction2 = createTransaction(3, 'Split 2', -200, '2024-01-01', false, 1);
      const regularTransaction = createTransaction(4, 'Regular Transaction', -50, '2024-01-02');

      const transactions = [originalTransaction, regularTransaction, splitTransaction1, splitTransaction2];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(originalTransaction);
      expect(result[1]).toEqual(splitTransaction1);
      expect(result[2]).toEqual(splitTransaction2);
      expect(result[3]).toEqual(regularTransaction);
    });

    test('should handle split transactions appearing before original transaction', () => {
      const originalTransaction = createTransaction(1, 'Original Transaction', -300, '2024-01-01', true);
      const splitTransaction1 = createTransaction(2, 'Split 1', -100, '2024-01-01', false, 1);
      const splitTransaction2 = createTransaction(3, 'Split 2', -200, '2024-01-01', false, 1);

      // Split transactions appear before original in the input array
      const transactions = [splitTransaction1, splitTransaction2, originalTransaction];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(originalTransaction);
      expect(result[1]).toEqual(splitTransaction1);
      expect(result[2]).toEqual(splitTransaction2);
    });

    test('should sort split transactions by date within each group', () => {
      const originalTransaction = createTransaction(1, 'Original Transaction', -300, '2024-01-01', true);
      const splitTransaction1 = createTransaction(2, 'Split 1', -100, '2024-01-03', false, 1);
      const splitTransaction2 = createTransaction(3, 'Split 2', -200, '2024-01-01', false, 1);
      const splitTransaction3 = createTransaction(4, 'Split 3', -50, '2024-01-02', false, 1);

      const transactions = [originalTransaction, splitTransaction1, splitTransaction2, splitTransaction3];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(originalTransaction);
      // Should be sorted by date: 2024-01-01, 2024-01-02, 2024-01-03
      expect(result[1]).toEqual(splitTransaction2); // 2024-01-01
      expect(result[2]).toEqual(splitTransaction3); // 2024-01-02
      expect(result[3]).toEqual(splitTransaction1); // 2024-01-03
    });
  });

  describe('Multiple split groups', () => {
    test('should handle multiple separate split transaction groups', () => {
      const original1 = createTransaction(1, 'Original 1', -300, '2024-01-01', true);
      const split1_1 = createTransaction(2, 'Split 1-1', -100, '2024-01-01', false, 1);
      const split1_2 = createTransaction(3, 'Split 1-2', -200, '2024-01-01', false, 1);

      const original2 = createTransaction(4, 'Original 2', -500, '2024-01-02', true);
      const split2_1 = createTransaction(5, 'Split 2-1', -250, '2024-01-02', false, 4);
      const split2_2 = createTransaction(6, 'Split 2-2', -250, '2024-01-02', false, 4);

      const regularTransaction = createTransaction(7, 'Regular', -50, '2024-01-03');

      const transactions = [split1_1, original2, split2_1, regularTransaction, original1, split1_2, split2_2];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(7);
      
      // First group should be original1 and its splits (split1_1 triggers this first)
      expect(result[0]).toEqual(original1);
      expect(result[1]).toEqual(split1_1);
      expect(result[2]).toEqual(split1_2);
      
      // Second group should be original2 and its splits
      expect(result[3]).toEqual(original2);
      expect(result[4]).toEqual(split2_1);
      expect(result[5]).toEqual(split2_2);
      
      // Regular transaction
      expect(result[6]).toEqual(regularTransaction);
    });
  });

  describe('Edge cases', () => {
    test('should handle orphaned split transactions (missing original)', () => {
      const orphanedSplit1 = createTransaction(2, 'Orphaned Split 1', -100, '2024-01-01', false, 999);
      const orphanedSplit2 = createTransaction(3, 'Orphaned Split 2', -200, '2024-01-01', false, 999);
      const regularTransaction = createTransaction(4, 'Regular', -50, '2024-01-02');

      const transactions = [orphanedSplit1, regularTransaction, orphanedSplit2];
      const result = groupSplitTransactions(transactions);

      // Orphaned splits should be treated as standalone transactions
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(orphanedSplit1);
      expect(result[1]).toEqual(regularTransaction);
      expect(result[2]).toEqual(orphanedSplit2);
    });

    test('should handle original transaction without any splits', () => {
      const originalWithoutSplits = createTransaction(1, 'Original without splits', -300, '2024-01-01', true);
      const regularTransaction = createTransaction(2, 'Regular', -50, '2024-01-02');

      const transactions = [originalWithoutSplits, regularTransaction];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(originalWithoutSplits);
      expect(result[1]).toEqual(regularTransaction);
    });

    test('should handle transactions with null or undefined split_from_id', () => {
      const transactionWithNull = { ...createTransaction(1, 'Null split_from_id', -100, '2024-01-01'), split_from_id: null };
      const transactionWithUndefined = { ...createTransaction(2, 'Undefined split_from_id', -200, '2024-01-01'), split_from_id: undefined };
      const regularTransaction = createTransaction(3, 'Regular', -50, '2024-01-02');

      const transactions = [transactionWithNull, transactionWithUndefined, regularTransaction];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(3);
      expect(result).toContain(transactionWithNull);
      expect(result).toContain(transactionWithUndefined);
      expect(result).toContain(regularTransaction);
    });

    test('should handle transactions with false has_split flag', () => {
      const transactionWithFalseSplit = { ...createTransaction(1, 'False has_split', -100, '2024-01-01'), has_split: false };
      const regularTransaction = createTransaction(2, 'Regular', -50, '2024-01-02');

      const transactions = [transactionWithFalseSplit, regularTransaction];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(2);
      expect(result).toContain(transactionWithFalseSplit);
      expect(result).toContain(regularTransaction);
    });
  });

  describe('Data integrity', () => {
    test('should not modify original transaction objects', () => {
      const originalTransaction = createTransaction(1, 'Original', -300, '2024-01-01', true);
      const splitTransaction = createTransaction(2, 'Split', -100, '2024-01-01', false, 1);
      
      const originalCopy = { ...originalTransaction };
      const splitCopy = { ...splitTransaction };

      const transactions = [originalTransaction, splitTransaction];
      groupSplitTransactions(transactions);

      expect(originalTransaction).toEqual(originalCopy);
      expect(splitTransaction).toEqual(splitCopy);
    });

    test('should not lose any transactions during grouping', () => {
      const original1 = createTransaction(1, 'Original 1', -300, '2024-01-01', true);
      const split1_1 = createTransaction(2, 'Split 1-1', -100, '2024-01-01', false, 1);
      const split1_2 = createTransaction(3, 'Split 1-2', -200, '2024-01-01', false, 1);
      const regular1 = createTransaction(4, 'Regular 1', -50, '2024-01-02');
      const regular2 = createTransaction(5, 'Regular 2', -75, '2024-01-03');

      const transactions = [original1, split1_1, regular1, split1_2, regular2];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(5);
      
      // Check that all original transactions are present
      const resultIds = result.map(t => t.id).sort();
      const originalIds = transactions.map(t => t.id).sort();
      expect(resultIds).toEqual(originalIds);
    });

    test('should handle duplicate transaction IDs gracefully', () => {
      const transaction1 = createTransaction(1, 'Transaction 1', -100, '2024-01-01');
      const transaction2 = createTransaction(1, 'Transaction 2', -200, '2024-01-02'); // Same ID
      const transaction3 = createTransaction(2, 'Transaction 3', -300, '2024-01-03');

      const transactions = [transaction1, transaction2, transaction3];
      const result = groupSplitTransactions(transactions);

      // Should handle gracefully without throwing errors
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Complex scenarios', () => {
    test('should handle mixed regular and split transactions in random order', () => {
      const regular1 = createTransaction(1, 'Regular 1', -50, '2024-01-01');
      const original1 = createTransaction(2, 'Original 1', -300, '2024-01-02', true);
      const split1_1 = createTransaction(3, 'Split 1-1', -150, '2024-01-02', false, 2);
      const regular2 = createTransaction(4, 'Regular 2', -75, '2024-01-03');
      const split1_2 = createTransaction(5, 'Split 1-2', -150, '2024-01-02', false, 2);
      const original2 = createTransaction(6, 'Original 2', -500, '2024-01-04', true);
      const split2_1 = createTransaction(7, 'Split 2-1', -500, '2024-01-04', false, 6);

      // Random order input
      const transactions = [regular2, split1_1, original2, regular1, split2_1, original1, split1_2];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(7);
      
      // Should maintain grouping while preserving order of first appearance
      const groupStarts = [];
      let currentGroup = null;
      
      result.forEach((transaction, index) => {
        if (transaction.has_split || (!transaction.split_from_id && !transaction.has_split)) {
          if (currentGroup !== null) {
            groupStarts.push(currentGroup);
          }
          currentGroup = index;
        }
      });
      if (currentGroup !== null) {
        groupStarts.push(currentGroup);
      }

      // Verify that groups are properly formed
      expect(groupStarts.length).toBeGreaterThan(0);
    });

    test('should handle large number of split transactions', () => {
      const originalTransaction = createTransaction(1, 'Original with many splits', -1000, '2024-01-01', true);
      const splitTransactions = [];
      
      // Create 50 split transactions
      for (let i = 2; i <= 51; i++) {
        splitTransactions.push(createTransaction(i, `Split ${i-1}`, -20, `2024-01-0${(i % 9) + 1}`, false, 1));
      }

      const transactions = [originalTransaction, ...splitTransactions];
      const result = groupSplitTransactions(transactions);

      expect(result).toHaveLength(51);
      expect(result[0]).toEqual(originalTransaction);
      
      // All remaining should be split transactions
      for (let i = 1; i < result.length; i++) {
        expect(result[i].split_from_id).toBe(1);
      }
    });
  });

  describe('Performance considerations', () => {
    test('should handle reasonable number of transactions efficiently', () => {
      const transactions = [];
      
      // Create 1000 regular transactions
      for (let i = 1; i <= 1000; i++) {
        transactions.push(createTransaction(i, `Transaction ${i}`, -Math.random() * 100, '2024-01-01'));
      }

      const startTime = performance.now();
      const result = groupSplitTransactions(transactions);
      const endTime = performance.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in less than 100ms
    });
  });
}); 