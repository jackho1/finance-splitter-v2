import { describe, expect, test, vi } from 'vitest';
import { filterByLabel, applyFilters } from './filterTransactions';

// Mock data for testing
const mockTransactions = [
  { id: 1, label: 'Alice', date: '2024-01-01', amount: -100, bank_category: 'Food' },
  { id: 2, label: 'Bob', date: '2024-01-02', amount: -50, bank_category: 'Transport' },
  { id: 3, label: 'Both', date: '2024-01-03', amount: -75, bank_category: 'Food' },
  { id: 4, label: null, date: '2024-01-04', amount: -25, bank_category: 'Entertainment' },
  { id: 5, label: 'All users', date: '2024-01-05', amount: -200, bank_category: 'Utilities' },
];

// Mock split allocations data
const mockSplitAllocations = {
  6: [{ user_id: 1, display_name: 'Alice', amount: -30 }],
  7: [
    { user_id: 1, display_name: 'Alice', amount: -40 },
    { user_id: 2, display_name: 'Bob', amount: -40 }
  ],
  8: [
    { user_id: 1, display_name: 'Alice', amount: -33.33 },
    { user_id: 2, display_name: 'Bob', amount: -33.33 },
    { user_id: 3, display_name: 'Charlie', amount: -33.34 }
  ]
};

// Mock users data
const mockUsers = [
  { id: 1, display_name: 'Alice', username: 'alice', is_active: true },
  { id: 2, display_name: 'Bob', username: 'bob', is_active: true },
  { id: 3, display_name: 'Charlie', username: 'charlie', is_active: true }
];

// Mock transactions with split allocations (new system)
const mockNewTransactions = [
  { id: 6, label: null, date: '2024-08-01', amount: -30, bank_category: 'Food' },
  { id: 7, label: null, date: '2024-08-02', amount: -80, bank_category: 'Transport' },
  { id: 8, label: null, date: '2024-08-03', amount: -100, bank_category: 'Utilities' }
];

describe('filterTransactions utilities', () => {
  describe('filterByLabel', () => {
    test('should return all transactions when labelFilter is empty', () => {
      const result = filterByLabel(mockTransactions, []);
      expect(result).toEqual(mockTransactions);
    });

    test('should filter by static label correctly', () => {
      const result = filterByLabel(mockTransactions, ['Alice']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('should filter by multiple static labels', () => {
      const result = filterByLabel(mockTransactions, ['Alice', 'Bob']);
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([1, 2]);
    });

    test('should include null label transactions when filtering for null', () => {
      const result = filterByLabel(mockTransactions, [null]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4);
    });

    test('should filter with dynamic label function for new transactions', () => {
      const mockGetTransactionLabel = vi.fn((transaction) => {
        const allocations = mockSplitAllocations[transaction.id];
        if (!allocations) return null;
        
        if (allocations.length === 1) {
          return allocations[0].display_name;
        }
        if (allocations.length === 2) {
          return 'Both';
        }
        if (allocations.length >= 3) {
          return 'All users';
        }
        return null;
      });

      const result = filterByLabel(mockNewTransactions, ['Alice'], mockGetTransactionLabel);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(6);
      expect(mockGetTransactionLabel).toHaveBeenCalledTimes(3);
    });

    test('should filter with dynamic label function for "Both" transactions', () => {
      const mockGetTransactionLabel = vi.fn((transaction) => {
        const allocations = mockSplitAllocations[transaction.id];
        if (!allocations) return null;
        
        if (allocations.length === 1) {
          return allocations[0].display_name;
        }
        if (allocations.length === 2) {
          return 'Both';
        }
        if (allocations.length >= 3) {
          return 'All users';
        }
        return null;
      });

      const result = filterByLabel(mockNewTransactions, ['Both'], mockGetTransactionLabel);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(7);
    });

    test('should filter with dynamic label function for "All users" transactions', () => {
      const mockGetTransactionLabel = vi.fn((transaction) => {
        const allocations = mockSplitAllocations[transaction.id];
        if (!allocations) return null;
        
        if (allocations.length === 1) {
          return allocations[0].display_name;
        }
        if (allocations.length === 2) {
          return 'Both';
        }
        if (allocations.length >= 3) {
          return 'All users';
        }
        return null;
      });

      const result = filterByLabel(mockNewTransactions, ['All users'], mockGetTransactionLabel);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(8);
    });

    test('should handle null values correctly with dynamic label function', () => {
      const mockGetTransactionLabel = vi.fn(() => null);

      const result = filterByLabel(mockNewTransactions, [null], mockGetTransactionLabel);
      expect(result).toHaveLength(3);
      expect(mockGetTransactionLabel).toHaveBeenCalledTimes(3);
    });

    test('should combine static and dynamic label filtering', () => {
      const mixedTransactions = [...mockTransactions, ...mockNewTransactions];
      
      const mockGetTransactionLabel = vi.fn((transaction) => {
        // For old transactions, use the static label
        if (transaction.label !== null) return transaction.label;
        
        // For new transactions, use dynamic allocation
        const allocations = mockSplitAllocations[transaction.id];
        if (!allocations) return null;
        
        if (allocations.length === 1) {
          return allocations[0].display_name;
        }
        if (allocations.length === 2) {
          return 'Both';
        }
        if (allocations.length >= 3) {
          return 'All users';
        }
        return null;
      });

      const result = filterByLabel(mixedTransactions, ['Alice'], mockGetTransactionLabel);
      expect(result).toHaveLength(2); // One static Alice + one dynamic Alice
      expect(result.map(t => t.id)).toEqual([1, 6]);
    });
  });

  describe('applyFilters', () => {
    test('should apply label filter with dynamic function correctly', () => {
      const mockGetTransactionLabel = vi.fn((transaction) => {
        if (transaction.id === 6) return 'Alice';
        if (transaction.id === 7) return 'Both';
        if (transaction.id === 8) return 'All users';
        return null;
      });

      const filters = {
        labelFilter: ['Alice'],
        sortBy: 'date-asc'
      };

      const result = applyFilters(mockNewTransactions, filters, mockGetTransactionLabel);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(6);
      expect(mockGetTransactionLabel).toHaveBeenCalledTimes(3);
    });

    test('should work without dynamic label function for legacy transactions', () => {
      const filters = {
        labelFilter: ['Alice'],
        sortBy: 'date-asc'
      };

      const result = applyFilters(mockTransactions, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('should apply multiple filters including dynamic labels', () => {
      const mockGetTransactionLabel = vi.fn((transaction) => {
        if (transaction.id === 6) return 'Alice';
        if (transaction.id === 7) return 'Both';
        if (transaction.id === 8) return 'All users';
        return null;
      });

      const filters = {
        labelFilter: ['Alice', 'Both'],
        bankCategoryFilter: ['Food', 'Transport'],
        sortBy: 'date-desc'
      };

      const result = applyFilters(mockNewTransactions, filters, mockGetTransactionLabel);
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([7, 6]); // Sorted by date desc
    });
  });
});
