import { describe, expect, test } from 'vitest';
import { applyFilters } from './utils/filterTransactions';
import { getTransactionLabel } from './utils/calculateTotals';
import { getLabelFilterOptions } from './utils/getLabelFilterOptions';

// Integration test to verify the label filtering bug fix
describe('Label Filtering Integration - Bug Fix', () => {
  // Mock data representing the situation described in the bug
  const mockUsers = [
    { id: 1, display_name: 'Alice', username: 'alice', is_active: true },
    { id: 2, display_name: 'Bob', username: 'bob', is_active: true },
    { id: 4, display_name: 'System', username: 'default', is_active: true }
  ];

  // Legacy transactions (before July/August) - use static labels
  const legacyTransactions = [
    { id: 1, amount: -100, date: '2024-06-01', label: 'Alice', bank_category: 'Food' },
    { id: 2, amount: -150, date: '2024-06-02', label: 'Bob', bank_category: 'Transport' },
    { id: 3, amount: -200, date: '2024-06-03', label: 'Both', bank_category: 'Utilities' },
    { id: 4, amount: -50, date: '2024-06-04', label: null, bank_category: 'Entertainment' },
  ];

  // New transactions (after July/August) - use split allocations for labels
  const newTransactions = [
    { id: 5, amount: -80, date: '2024-08-01', label: null, bank_category: 'Food' },
    { id: 6, amount: -120, date: '2024-08-02', label: null, bank_category: 'Transport' },
    { id: 7, amount: -160, date: '2024-08-03', label: null, bank_category: 'Utilities' },
    { id: 8, amount: -40, date: '2024-08-04', label: null, bank_category: 'Entertainment' }
  ];

  // Split allocations for new transactions
  const mockSplitAllocations = {
    // Single user allocation - Alice
    5: [{ user_id: 1, display_name: 'Alice', amount: -80, split_type_code: 'fixed' }],
    
    // Single user allocation - Bob
    6: [{ user_id: 2, display_name: 'Bob', amount: -120, split_type_code: 'fixed' }],
    
    // Equal split between both users
    7: [
      { user_id: 1, display_name: 'Alice', amount: -80, split_type_code: 'equal', percentage: 50 },
      { user_id: 2, display_name: 'Bob', amount: -80, split_type_code: 'equal', percentage: 50 }
    ],
    
    // No allocation for transaction 8 - should be unallocated
  };

  const allTransactions = [...legacyTransactions, ...newTransactions];

  // Helper function to create dynamic label generator
  const createLabelGenerator = (splitAllocations, users) => {
    return (transaction) => getTransactionLabel(transaction, splitAllocations, users, false);
  };

  describe('Label filtering before and after July/August changes', () => {
    test('should filter legacy transactions by static labels correctly', () => {
      const filters = { labelFilter: ['Alice'] };
      
      // Filter only legacy transactions
      const result = applyFilters(legacyTransactions, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].label).toBe('Alice');
    });

    test('should filter new transactions by dynamic labels correctly', () => {
      const filters = { labelFilter: ['Alice'] };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      // Filter only new transactions
      const result = applyFilters(newTransactions, filters, getLabelFn);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
      expect(getLabelFn(result[0])).toBe('Alice');
    });

    test('should filter mixed legacy and new transactions correctly', () => {
      const filters = { labelFilter: ['Alice'] };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      // Filter all transactions (mixed legacy and new)
      const result = applyFilters(allTransactions, filters, getLabelFn);
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([1, 5]); // Both Alice transactions
      
      // Verify labels
      expect(result[0].label).toBe('Alice'); // Legacy
      expect(getLabelFn(result[1])).toBe('Alice'); // New (dynamic)
    });

    test('should filter by "Both" label correctly across legacy and new', () => {
      const filters = { labelFilter: ['Both'] };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      const result = applyFilters(allTransactions, filters, getLabelFn);
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([3, 7]); // Legacy Both + New Both
      
      // Verify labels
      expect(result[0].label).toBe('Both'); // Legacy
      expect(getLabelFn(result[1])).toBe('Both'); // New (dynamic)
    });

    test('should filter by Bob correctly across legacy and new', () => {
      const filters = { labelFilter: ['Bob'] };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      const result = applyFilters(allTransactions, filters, getLabelFn);
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([2, 6]); // Legacy Bob + New Bob
    });

    test('should filter by null/unallocated correctly', () => {
      const filters = { labelFilter: [null] };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      const result = applyFilters(allTransactions, filters, getLabelFn);
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([4, 8]); // Legacy null + New unallocated
      
      // Verify labels
      expect(result[0].label).toBeNull(); // Legacy
      expect(getLabelFn(result[1])).toBeNull(); // New (no allocation)
    });

    test('should handle multiple label filters correctly', () => {
      const filters = { labelFilter: ['Alice', 'Bob'] };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      const result = applyFilters(allTransactions, filters, getLabelFn);
      
      expect(result).toHaveLength(4);
      expect(result.map(t => t.id)).toEqual([1, 2, 5, 6]); // All Alice and Bob transactions
    });

    test('should combine label filter with other filters correctly', () => {
      const filters = {
        labelFilter: ['Alice'],
        bankCategoryFilter: ['Food']
      };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      const result = applyFilters(allTransactions, filters, getLabelFn);
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([1, 5]); // Both Alice Food transactions
    });
  });

  describe('Label filter options generation', () => {
    test('should generate correct label options for mixed data', () => {
      const options = getLabelFilterOptions(mockUsers, mockSplitAllocations, allTransactions);
      
      // Should include individual users
      expect(options).toContain('Alice');
      expect(options).toContain('Bob');
      expect(options).not.toContain('System'); // Default user excluded
      
      // Should include collective options based on split allocations
      expect(options).toContain('Both'); // Because transaction 7 has equal 2-user split
      
      // Should include null because transactions 4 and 8 are unallocated
      expect(options).toContain(null);
    });

    test('should order options correctly: individual, collective, null', () => {
      const options = getLabelFilterOptions(mockUsers, mockSplitAllocations, allTransactions);
      
      const aliceIndex = options.indexOf('Alice');
      const bobIndex = options.indexOf('Bob');
      const bothIndex = options.indexOf('Both');
      const nullIndex = options.indexOf(null);
      
      // Individual users should come first (sorted)
      expect(aliceIndex).toBeLessThan(bobIndex);
      
      // Both should come after individual users
      expect(bothIndex).toBeGreaterThan(aliceIndex);
      expect(bothIndex).toBeGreaterThan(bobIndex);
      
      // Null should come last
      expect(nullIndex).toBe(options.length - 1);
    });
  });

  describe('Bug fix verification', () => {
    test('BUG FIX: new transactions without dynamic label support should show no results', () => {
      // This simulates the bug where new transactions were not showing when filtered by label
      const filters = { labelFilter: ['Alice'] };
      
      // Using the old approach (without dynamic label function)
      const brokenResult = applyFilters(newTransactions, filters); // No label function
      
      // Should return no results because new transactions have null labels
      expect(brokenResult).toHaveLength(0);
    });

    test('BUG FIX: new transactions with dynamic label support should show correct results', () => {
      // This simulates the fix where new transactions work correctly with dynamic labels
      const filters = { labelFilter: ['Alice'] };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      // Using the new approach (with dynamic label function)
      const fixedResult = applyFilters(newTransactions, filters, getLabelFn);
      
      // Should return Alice's transaction correctly
      expect(fixedResult).toHaveLength(1);
      expect(fixedResult[0].id).toBe(5);
      expect(getLabelFn(fixedResult[0])).toBe('Alice');
    });

    test('BUG FIX: mixed data filtering demonstrates the complete fix', () => {
      const filters = { labelFilter: ['Alice'] };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      // Without fix: only legacy transactions would be found
      const legacyOnlyResult = applyFilters(legacyTransactions, filters);
      expect(legacyOnlyResult).toHaveLength(1);
      
      // Without fix: new transactions would show no results
      const newOnlyBrokenResult = applyFilters(newTransactions, filters);
      expect(newOnlyBrokenResult).toHaveLength(0);
      
      // With fix: both legacy and new transactions are found correctly
      const fixedResult = applyFilters(allTransactions, filters, getLabelFn);
      expect(fixedResult).toHaveLength(2);
      expect(fixedResult.map(t => t.id)).toEqual([1, 5]);
    });
  });

  describe('Real world scenarios', () => {
    test('should handle date-based filtering with labels correctly', () => {
      const filters = {
        labelFilter: ['Alice'],
        dateFilter: { startDate: '2024-08-01', endDate: '2024-08-31' }
      };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      const result = applyFilters(allTransactions, filters, getLabelFn);
      
      // Should only include Alice's August transaction
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
      expect(result[0].date).toBe('2024-08-01');
    });

    test('should handle complex multi-filter scenarios', () => {
      const filters = {
        labelFilter: ['Both', null],
        bankCategoryFilter: ['Utilities', 'Entertainment'],
        sortBy: 'date-desc'
      };
      const getLabelFn = createLabelGenerator(mockSplitAllocations, mockUsers);
      
      const result = applyFilters(allTransactions, filters, getLabelFn);
      
      // Should include: transaction 3 (Both+Utilities), transaction 7 (Both+Utilities), 
      // transaction 4 (null+Entertainment), transaction 8 (null+Entertainment)
      expect(result).toHaveLength(4);
      expect(result.map(t => t.id)).toEqual([8, 7, 4, 3]); // Sorted by date desc
    });
  });
});
