import { describe, expect, test } from 'vitest';
import { getTransactionLabel, getUserTotalFromAllocations, calculateTotalsFromAllocations } from './calculateTotals';

// Mock data for testing
const mockUsers = [
  { id: 1, display_name: 'Alice', username: 'alice', is_active: true },
  { id: 2, display_name: 'Bob', username: 'bob', is_active: true },
  { id: 3, display_name: 'Charlie', username: 'charlie', is_active: true },
  { id: 4, display_name: 'System', username: 'default', is_active: true } // System user should be excluded
];

const mockSplitAllocations = {
  // Single user allocation
  1: [{ user_id: 1, display_name: 'Alice', amount: -100, split_type_code: 'fixed' }],
  
  // Equal split between two users (Both)
  2: [
    { user_id: 1, display_name: 'Alice', amount: -50, split_type_code: 'equal', percentage: 50 },
    { user_id: 2, display_name: 'Bob', amount: -50, split_type_code: 'equal', percentage: 50 }
  ],
  
  // Equal split between all users (All users)
  3: [
    { user_id: 1, display_name: 'Alice', amount: -33.33, split_type_code: 'equal', percentage: 33.33 },
    { user_id: 2, display_name: 'Bob', amount: -33.33, split_type_code: 'equal', percentage: 33.33 },
    { user_id: 3, display_name: 'Charlie', amount: -33.34, split_type_code: 'equal', percentage: 33.34 }
  ],
  
  // Mixed split
  4: [
    { user_id: 1, display_name: 'Alice', amount: -70, split_type_code: 'fixed' },
    { user_id: 2, display_name: 'Bob', amount: -30, split_type_code: 'fixed' }
  ]
};

const mockTransactions = [
  { id: 1, amount: -100, date: '2024-08-01', label: null }, // New system - Alice only
  { id: 2, amount: -100, date: '2024-08-02', label: null }, // New system - Both
  { id: 3, amount: -100, date: '2024-08-03', label: null }, // New system - All users
  { id: 4, amount: -100, date: '2024-08-04', label: null }, // New system - Mixed
  { id: 5, amount: -150, date: '2024-07-01', label: 'Alice' }, // Legacy system
  { id: 6, amount: -200, date: '2024-07-02', label: 'Both' }, // Legacy system
  { id: 7, amount: -300, date: '2024-07-03', label: 'All users' }, // Legacy system
  { id: 8, amount: -50, date: '2024-07-04', label: null }, // No allocation
];

describe('calculateTotals utilities', () => {
  describe('getTransactionLabel', () => {
    test('should return null when loading', () => {
      const result = getTransactionLabel(mockTransactions[0], mockSplitAllocations, mockUsers, true);
      expect(result).toBeNull();
    });

    test('should return null when users not loaded', () => {
      const result = getTransactionLabel(mockTransactions[0], mockSplitAllocations, null, false);
      expect(result).toBeNull();
    });

    test('should return null when splitAllocations not loaded', () => {
      const result = getTransactionLabel(mockTransactions[0], null, mockUsers, false);
      expect(result).toBeNull();
    });

    test('should return single user display name for single allocation', () => {
      const result = getTransactionLabel(mockTransactions[0], mockSplitAllocations, mockUsers, false);
      expect(result).toBe('Alice');
    });

    test('should return "Both" for equal split between 2 users', () => {
      const result = getTransactionLabel(mockTransactions[1], mockSplitAllocations, mockUsers, false);
      expect(result).toBe('Both');
    });

    test('should return "All users" for equal split between 3+ users', () => {
      const result = getTransactionLabel(mockTransactions[2], mockSplitAllocations, mockUsers, false);
      expect(result).toBe('All users');
    });

    test('should return mixed allocation format for non-equal splits', () => {
      const result = getTransactionLabel(mockTransactions[3], mockSplitAllocations, mockUsers, false);
      expect(result).toBe('Alice +1');
    });

    test('should return null for transaction without allocations', () => {
      const result = getTransactionLabel(mockTransactions[7], mockSplitAllocations, mockUsers, false);
      expect(result).toBeNull();
    });
  });

  describe('getUserTotalFromAllocations', () => {
    test('should return 0 for invalid inputs', () => {
      const result = getUserTotalFromAllocations(1, null, mockSplitAllocations, mockUsers);
      expect(result).toBe(0);
    });

    test('should calculate total from new allocation system', () => {
      const newTransactions = mockTransactions.slice(0, 4); // Only new system transactions
      const result = getUserTotalFromAllocations(1, newTransactions, mockSplitAllocations, mockUsers);
      // Alice gets: -100 (tx1) + -50 (tx2) + -33.33 (tx3) + -70 (tx4) = -253.33
      expect(result).toBeCloseTo(-253.33, 2);
    });

    test('should calculate total from legacy label system', () => {
      const legacyTransactions = mockTransactions.slice(4, 7); // Only legacy transactions
      const result = getUserTotalFromAllocations(1, legacyTransactions, {}, mockUsers);
      // Alice gets: -150 (direct) + -66.67 (Both split) + -100 (All users split) = -316.67
      expect(result).toBeCloseTo(-316.67, 2);
    });

    test('should handle mixed new and legacy systems', () => {
      const allTransactions = mockTransactions.slice(0, 7); // Exclude unallocated
      const result = getUserTotalFromAllocations(1, allTransactions, mockSplitAllocations, mockUsers);
      // New system: -253.33 + Legacy system: -316.67 = -570
      expect(result).toBeCloseTo(-570, 2);
    });

    test('should ignore unallocated transactions', () => {
      const result = getUserTotalFromAllocations(1, [mockTransactions[7]], mockSplitAllocations, mockUsers);
      expect(result).toBe(0);
    });

    test('should handle Bob\'s allocations correctly', () => {
      const newTransactions = mockTransactions.slice(0, 4);
      const result = getUserTotalFromAllocations(2, newTransactions, mockSplitAllocations, mockUsers);
      // Bob gets: 0 (tx1) + -50 (tx2) + -33.33 (tx3) + -30 (tx4) = -113.33
      expect(result).toBeCloseTo(-113.33, 2);
    });

    test('should handle Charlie\'s allocations correctly', () => {
      const newTransactions = mockTransactions.slice(0, 4);
      const result = getUserTotalFromAllocations(3, newTransactions, mockSplitAllocations, mockUsers);
      // Charlie gets: 0 (tx1) + 0 (tx2) + -33.34 (tx3) + 0 (tx4) = -33.34
      expect(result).toBeCloseTo(-33.34, 2);
    });
  });

  describe('calculateTotalsFromAllocations', () => {
    test('should return empty object for invalid users', () => {
      const result = calculateTotalsFromAllocations(mockTransactions, null, mockSplitAllocations);
      expect(result).toEqual({});
    });

    test('should calculate totals for all active users', () => {
      const allTransactions = mockTransactions.slice(0, 7); // Exclude unallocated
      const result = calculateTotalsFromAllocations(allTransactions, mockUsers, mockSplitAllocations);
      
      expect(result).toHaveProperty('Alice');
      expect(result).toHaveProperty('Bob');
      expect(result).toHaveProperty('Charlie');
      expect(result).not.toHaveProperty('System'); // Default user should be excluded
      
      expect(result.Alice).toBeCloseTo(-570, 2);
      expect(result.Bob).toBeCloseTo(-280, 2); // -113.33 (new) + -166.67 (legacy)
      expect(result.Charlie).toBeCloseTo(-200.01, 2); // -33.34 (new) + -166.67 (legacy)
    });

    test('should handle empty transactions gracefully', () => {
      const result = calculateTotalsFromAllocations([], mockUsers, mockSplitAllocations);
      expect(result.Alice).toBe(0);
      expect(result.Bob).toBe(0);
      expect(result.Charlie).toBe(0);
    });

    test('should filter out default system user', () => {
      const result = calculateTotalsFromAllocations(mockTransactions, mockUsers, mockSplitAllocations);
      expect(Object.keys(result)).not.toContain('System');
      expect(Object.keys(result).length).toBe(3); // Only Alice, Bob, Charlie
    });
  });
});
