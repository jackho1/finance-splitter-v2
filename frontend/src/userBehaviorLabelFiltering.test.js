import { describe, expect, test, vi } from 'vitest';
import { applyFilters } from './utils/filterTransactions';
import { getTransactionLabel } from './utils/calculateTotals';
import { getLabelFilterOptions } from './utils/getLabelFilterOptions';

// User behavior-focused test for the label filtering bug fix
describe('User Behavior - Label Filtering Bug Fix', () => {
  // Realistic scenario: User has transactions from both before and after the system change
  const mockUsers = [
    { id: 1, display_name: 'John', username: 'john', is_active: true },
    { id: 2, display_name: 'Sarah', username: 'sarah', is_active: true },
    { id: 999, display_name: 'System', username: 'default', is_active: true }
  ];

  // Mix of old and new transactions as they would exist in production
  const productionLikeTransactions = [
    // Old transactions (before system change) - have static labels
    { id: 100, amount: -45.50, date: '2024-06-15', label: 'John', bank_category: 'Groceries', description: 'Woolworths' },
    { id: 101, amount: -120.00, date: '2024-07-01', label: 'Sarah', bank_category: 'Utilities', description: 'Electricity bill' },
    { id: 102, amount: -89.99, date: '2024-07-10', label: 'Both', bank_category: 'Entertainment', description: 'Movie tickets' },
    { id: 103, amount: -25.00, date: '2024-07-15', label: null, bank_category: 'Transport', description: 'Bus fare' },
    
    // New transactions (after system change) - no static labels, use split allocations
    { id: 200, amount: -67.80, date: '2024-08-05', label: null, bank_category: 'Groceries', description: 'Coles shopping' },
    { id: 201, amount: -150.00, date: '2024-08-12', label: null, bank_category: 'Utilities', description: 'Gas bill' },
    { id: 202, amount: -78.50, date: '2024-08-20', label: null, bank_category: 'Entertainment', description: 'Concert tickets' },
    { id: 203, amount: -30.00, date: '2024-08-25', label: null, bank_category: 'Transport', description: 'Taxi ride' },
    { id: 204, amount: -200.00, date: '2024-09-01', label: null, bank_category: 'Rent', description: 'Monthly rent' },
  ];

  // Split allocations for new transactions
  const productionSplitAllocations = {
    200: [{ user_id: 1, display_name: 'John', amount: -67.80, split_type_code: 'fixed' }],
    201: [{ user_id: 2, display_name: 'Sarah', amount: -150.00, split_type_code: 'fixed' }],
    202: [
      { user_id: 1, display_name: 'John', amount: -39.25, split_type_code: 'equal', percentage: 50 },
      { user_id: 2, display_name: 'Sarah', amount: -39.25, split_type_code: 'equal', percentage: 50 }
    ],
    // 203 has no allocation (unallocated)
    204: [
      { user_id: 1, display_name: 'John', amount: -100.00, split_type_code: 'equal', percentage: 50 },
      { user_id: 2, display_name: 'Sarah', amount: -100.00, split_type_code: 'equal', percentage: 50 }
    ]
  };

  const createLabelFunction = () => {
    return (transaction) => getTransactionLabel(
      transaction, 
      productionSplitAllocations, 
      mockUsers, 
      false
    );
  };

  describe('User Story: "As a user, I want to filter transactions by label and see both old and new transactions"', () => {
    test('SCENARIO: User filters by "John" to see all his transactions', () => {
      // Given: User selects "John" from the label filter dropdown
      const userSelectedFilters = { labelFilter: ['John'] };
      const getLabelFn = createLabelFunction();
      
      // When: System applies the filter
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Then: User sees both old and new John transactions
      expect(result).toHaveLength(2);
      
      // Should include old John transaction
      const oldJohnTx = result.find(t => t.id === 100);
      expect(oldJohnTx).toBeDefined();
      expect(oldJohnTx.label).toBe('John');
      expect(oldJohnTx.description).toBe('Woolworths');
      
      // Should include new John transactions
      const newJohnTx1 = result.find(t => t.id === 200);
      expect(newJohnTx1).toBeDefined();
      expect(getLabelFn(newJohnTx1)).toBe('John');
      expect(newJohnTx1.description).toBe('Coles shopping');
      
      // Transaction 204 should NOT be included when filtering by "John" 
      // because it's labeled as "Both" (equal split)
      const sharedTx = result.find(t => t.id === 204);
      expect(sharedTx).toBeUndefined();
    });

    test('SCENARIO: User filters by "Both" to see shared expenses', () => {
      // Given: User wants to see all shared expenses
      const userSelectedFilters = { labelFilter: ['Both'] };
      const getLabelFn = createLabelFunction();
      
      // When: System applies the filter
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Then: User sees both old and new shared transactions
      expect(result).toHaveLength(3);
      
      // Old "Both" transaction
      expect(result.find(t => t.id === 102)).toBeDefined();
      
      // New "Both" transactions (equal splits)
      expect(result.find(t => t.id === 202)).toBeDefined(); // Concert tickets
      expect(result.find(t => t.id === 204)).toBeDefined(); // Rent
    });

    test('SCENARIO: User filters by unallocated transactions', () => {
      // Given: User wants to see unallocated transactions that need attention
      const userSelectedFilters = { labelFilter: [null] };
      const getLabelFn = createLabelFunction();
      
      // When: System applies the filter
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Then: User sees both old and new unallocated transactions
      expect(result).toHaveLength(2);
      
      // Old unallocated
      expect(result.find(t => t.id === 103)).toBeDefined();
      
      // New unallocated
      expect(result.find(t => t.id === 203)).toBeDefined();
    });

    test('SCENARIO: User combines label filter with date range', () => {
      // Given: User wants to see John's transactions from August onwards
      const userSelectedFilters = {
        labelFilter: ['John'],
        dateFilter: { startDate: '2024-08-01', endDate: '' }
      };
      const getLabelFn = createLabelFunction();
      
      // When: System applies the filter
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Then: User sees only John's recent transactions (excluding shared ones)
      expect(result).toHaveLength(1);
      expect(result.map(t => t.id)).toEqual([200]);
    });

    test('SCENARIO: User combines label filter with category', () => {
      // Given: User wants to see all grocery transactions by John
      const userSelectedFilters = {
        labelFilter: ['John'],
        bankCategoryFilter: ['Groceries']
      };
      const getLabelFn = createLabelFunction();
      
      // When: System applies the filter
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Then: User sees John's grocery transactions from both periods
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id).sort()).toEqual([100, 200]);
      expect(result.every(t => t.bank_category === 'Groceries')).toBe(true);
    });
  });

  describe('User Story: "As a user, I want to see all available label options in the filter dropdown"', () => {
    test('SCENARIO: User opens label filter dropdown', () => {
      // Given: User clicks on the label filter button
      // When: System generates available label options
      const availableOptions = getLabelFilterOptions(
        mockUsers, 
        productionSplitAllocations, 
        productionLikeTransactions
      );
      
      // Then: User sees all relevant label options
      expect(availableOptions).toContain('John');
      expect(availableOptions).toContain('Sarah');
      expect(availableOptions).toContain('Both'); // Because there are equal splits
      expect(availableOptions).toContain(null); // Because there are unallocated transactions
      expect(availableOptions).not.toContain('System'); // System user should be hidden
      
      // Options should be in the correct order
      const johnIndex = availableOptions.indexOf('John');
      const sarahIndex = availableOptions.indexOf('Sarah');
      const bothIndex = availableOptions.indexOf('Both');
      const nullIndex = availableOptions.indexOf(null);
      
      expect(johnIndex).toBeLessThan(sarahIndex); // Individual users sorted
      expect(sarahIndex).toBeLessThan(bothIndex); // Collective after individual
      expect(nullIndex).toBe(availableOptions.length - 1); // Null at the end
    });
  });

  describe('Bug Reproduction and Fix Verification', () => {
    test('BUG REPRODUCTION: Before fix - new transactions not showing in filter results', () => {
      // This simulates the exact bug scenario
      const userSelectedFilters = { labelFilter: ['John'] };
      
      // Before fix: filtering without dynamic label function
      const brokenResult = applyFilters(productionLikeTransactions, userSelectedFilters);
      
      // Only old transactions would show up
      const oldTransactionsInResult = brokenResult.filter(t => t.id < 200);
      const newTransactionsInResult = brokenResult.filter(t => t.id >= 200);
      
      expect(oldTransactionsInResult).toHaveLength(1); // Only old John transaction
      expect(newTransactionsInResult).toHaveLength(0); // NEW TRANSACTIONS MISSING!
    });

    test('FIX VERIFICATION: After fix - all relevant transactions showing', () => {
      // This verifies the fix works correctly
      const userSelectedFilters = { labelFilter: ['John'] };
      const getLabelFn = createLabelFunction();
      
      // After fix: filtering with dynamic label function
      const fixedResult = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Now both old and new transactions show up
      const oldTransactionsInResult = fixedResult.filter(t => t.id < 200);
      const newTransactionsInResult = fixedResult.filter(t => t.id >= 200);
      
      expect(oldTransactionsInResult).toHaveLength(1); // Old John transaction
      expect(newTransactionsInResult).toHaveLength(1); // NEW TRANSACTIONS NOW INCLUDED!
      expect(fixedResult).toHaveLength(2); // Total correct count
    });

    test('EDGE CASE: Mixed filtering with multiple label types', () => {
      // User selects multiple labels including collective ones
      const userSelectedFilters = { labelFilter: ['John', 'Both', null] };
      const getLabelFn = createLabelFunction();
      
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Should include:
      // - Old John (100)
      // - Old Both (102) 
      // - Old null (103)
      // - New John (200)
      // - New Both (202, 204)
      // - New null (203)
      expect(result).toHaveLength(7);
      
      // Verify specific transactions are included
      [100, 102, 103, 200, 202, 203, 204].forEach(id => {
        expect(result.find(t => t.id === id)).toBeDefined();
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    test('EDGE CASE: Empty filter should return all transactions', () => {
      const userSelectedFilters = { labelFilter: [] };
      const getLabelFn = createLabelFunction();
      
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      expect(result).toHaveLength(productionLikeTransactions.length);
    });

    test('EDGE CASE: Non-existent label should return no results', () => {
      const userSelectedFilters = { labelFilter: ['NonExistentUser'] };
      const getLabelFn = createLabelFunction();
      
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      expect(result).toHaveLength(0);
    });

    test('PERFORMANCE: Large dataset filtering should be efficient', () => {
      // Create a larger dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: 10000 + i,
        amount: -(Math.random() * 100),
        date: `2024-08-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        label: i % 2 === 0 ? 'John' : null,
        bank_category: 'Test',
        description: `Test transaction ${i}`
      }));
      
      const userSelectedFilters = { labelFilter: ['John'] };
      const getLabelFn = createLabelFunction();
      
      const start = performance.now();
      const result = applyFilters(largeDataset, userSelectedFilters, getLabelFn);
      const end = performance.now();
      
      // Should complete within reasonable time (less than 100ms for 1000 items)
      expect(end - start).toBeLessThan(100);
      
      // Should return correct number of John transactions (approximately 500)
      expect(result.length).toBeCloseTo(500, 50);
    });
  });

  describe('Real User Scenarios', () => {
    test('REAL SCENARIO: Month-end review of shared expenses', () => {
      // User wants to review all shared expenses for August
      const userSelectedFilters = {
        labelFilter: ['Both'],
        dateFilter: { startDate: '2024-08-01', endDate: '2024-08-31' }
      };
      const getLabelFn = createLabelFunction();
      
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Should only show August shared expenses
      expect(result).toHaveLength(1); // Only concert tickets (202)
      expect(result[0].id).toBe(202);
      expect(result[0].description).toBe('Concert tickets');
    });

    test('REAL SCENARIO: Expense cleanup - finding unallocated transactions', () => {
      // User wants to find and fix unallocated transactions
      const userSelectedFilters = { labelFilter: [null] };
      const getLabelFn = createLabelFunction();
      
      const result = applyFilters(productionLikeTransactions, userSelectedFilters, getLabelFn);
      
      // Should show both old and new unallocated transactions for cleanup
      expect(result).toHaveLength(2);
      expect(result.map(t => t.description).sort()).toEqual(['Bus fare', 'Taxi ride']);
    });
  });
});
