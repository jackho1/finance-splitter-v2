import { describe, expect, test } from 'vitest';
import { getLabelFilterOptions, getLabelDropdownOptions } from './getLabelFilterOptions';

// Mock data for testing
const mockUsers = [
  { id: 1, display_name: 'Alice', username: 'alice', is_active: true },
  { id: 2, display_name: 'Bob', username: 'bob', is_active: true },
  { id: 3, display_name: 'Charlie', username: 'charlie', is_active: true },
  { id: 4, display_name: 'System', username: 'default', is_active: true } // Should be excluded
];

const mockSplitAllocations = {
  // Single user allocation
  1: [{ user_id: 1, display_name: 'Alice', split_type_code: 'fixed', percentage: 100 }],
  
  // Equal split between two users
  2: [
    { user_id: 1, display_name: 'Alice', split_type_code: 'equal', percentage: 50 },
    { user_id: 2, display_name: 'Bob', split_type_code: 'equal', percentage: 50 }
  ],
  
  // Equal split between all users
  3: [
    { user_id: 1, display_name: 'Alice', split_type_code: 'equal', percentage: 33.33 },
    { user_id: 2, display_name: 'Bob', split_type_code: 'equal', percentage: 33.33 },
    { user_id: 3, display_name: 'Charlie', split_type_code: 'equal', percentage: 33.34 }
  ],
  
  // Non-equal split (should not trigger collective labels)
  4: [
    { user_id: 1, display_name: 'Alice', split_type_code: 'fixed', percentage: 70 },
    { user_id: 2, display_name: 'Bob', split_type_code: 'fixed', percentage: 30 }
  ]
};

const mockTransactions = [
  { id: 1 }, // Single user
  { id: 2 }, // Both users equal
  { id: 3 }, // All users equal
  { id: 4 }, // Mixed split
  { id: 5 }  // No allocation
];

describe('getLabelFilterOptions', () => {
  test('should return empty array when users not loaded', () => {
    const result = getLabelFilterOptions(null, mockSplitAllocations, mockTransactions);
    expect(result).toEqual([]);
  });

  test('should return empty array when users is empty', () => {
    const result = getLabelFilterOptions([], mockSplitAllocations, mockTransactions);
    expect(result).toEqual([]);
  });

  test('should return empty array when splitAllocations not provided', () => {
    const result = getLabelFilterOptions(mockUsers, null, mockTransactions);
    expect(result).toEqual([]);
  });

  test('should return empty array when transactions not provided', () => {
    const result = getLabelFilterOptions(mockUsers, mockSplitAllocations, null);
    expect(result).toEqual([]);
  });

  test('should return individual user names', () => {
    const result = getLabelFilterOptions(mockUsers, mockSplitAllocations, mockTransactions);
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('Charlie');
    expect(result).not.toContain('System'); // Default user should be excluded
  });

  test('should include "Both" when two-user equal splits exist', () => {
    const result = getLabelFilterOptions(mockUsers, mockSplitAllocations, mockTransactions);
    expect(result).toContain('Both');
  });

  test('should include "All users" when multi-user equal splits exist', () => {
    const result = getLabelFilterOptions(mockUsers, mockSplitAllocations, mockTransactions);
    expect(result).toContain('All users');
  });

  test('should include null when unallocated transactions exist', () => {
    const result = getLabelFilterOptions(mockUsers, mockSplitAllocations, mockTransactions);
    expect(result).toContain(null);
  });

  test('should order options correctly: individual users, collective, null', () => {
    const result = getLabelFilterOptions(mockUsers, mockSplitAllocations, mockTransactions);
    
    // Individual users should come first (sorted)
    const individualUsers = result.filter(option => 
      typeof option === 'string' && 
      option !== 'Both' && 
      option !== 'All users'
    );
    expect(individualUsers).toEqual(['Alice', 'Bob', 'Charlie']);
    
    // Check that Both comes after individual users
    const bothIndex = result.indexOf('Both');
    const aliceIndex = result.indexOf('Alice');
    expect(bothIndex).toBeGreaterThan(aliceIndex);
    
    // Check that null comes last
    const nullIndex = result.indexOf(null);
    expect(nullIndex).toBe(result.length - 1);
  });

  test('should not include "Both" when no two-user equal splits exist', () => {
    const noTwoUserSplitAllocations = {
      1: [{ user_id: 1, display_name: 'Alice', split_type_code: 'fixed', percentage: 100 }],
      3: [
        { user_id: 1, display_name: 'Alice', split_type_code: 'equal', percentage: 33.33 },
        { user_id: 2, display_name: 'Bob', split_type_code: 'equal', percentage: 33.33 },
        { user_id: 3, display_name: 'Charlie', split_type_code: 'equal', percentage: 33.34 }
      ]
    };
    
    const result = getLabelFilterOptions(mockUsers, noTwoUserSplitAllocations, mockTransactions);
    expect(result).not.toContain('Both');
  });

  test('should not include "All users" when no multi-user equal splits exist', () => {
    const noMultiUserSplitAllocations = {
      1: [{ user_id: 1, display_name: 'Alice', split_type_code: 'fixed', percentage: 100 }],
      2: [
        { user_id: 1, display_name: 'Alice', split_type_code: 'equal', percentage: 50 },
        { user_id: 2, display_name: 'Bob', split_type_code: 'equal', percentage: 50 }
      ]
    };
    
    const result = getLabelFilterOptions(mockUsers, noMultiUserSplitAllocations, mockTransactions);
    expect(result).not.toContain('All users');
  });

  test('should not include null when all transactions have allocations', () => {
    const allAllocatedTransactions = mockTransactions.slice(0, 4); // Exclude transaction 5
    const result = getLabelFilterOptions(mockUsers, mockSplitAllocations, allAllocatedTransactions);
    expect(result).not.toContain(null);
  });

  test('should handle only two active users scenario', () => {
    const twoUsersList = [
      { id: 1, display_name: 'Alice', username: 'alice', is_active: true },
      { id: 2, display_name: 'Bob', username: 'bob', is_active: true },
      { id: 4, display_name: 'System', username: 'default', is_active: true }
    ];
    
    const result = getLabelFilterOptions(twoUsersList, mockSplitAllocations, mockTransactions);
    expect(result).toContain('Both');
    expect(result).not.toContain('All users'); // Since we only have 2 active users
  });
});

describe('getLabelDropdownOptions', () => {
  test('should return default options when users not loaded', () => {
    const result = getLabelDropdownOptions(null);
    expect(result).toEqual([{ value: '', label: 'None' }]);
  });

  test('should return default options when users is not array', () => {
    const result = getLabelDropdownOptions('invalid');
    expect(result).toEqual([{ value: '', label: 'None' }]);
  });

  test('should include None option and individual users', () => {
    const result = getLabelDropdownOptions(mockUsers);
    
    expect(result[0]).toEqual({ value: '', label: 'None' });
    expect(result).toContainEqual({ value: 'Alice', label: 'Alice' });
    expect(result).toContainEqual({ value: 'Bob', label: 'Bob' });
    expect(result).toContainEqual({ value: 'Charlie', label: 'Charlie' });
    expect(result).not.toContainEqual(expect.objectContaining({ value: 'System' }));
  });

  test('should include "Both" option for two active users', () => {
    const twoUsersList = [
      { id: 1, display_name: 'Alice', username: 'alice', is_active: true },
      { id: 2, display_name: 'Bob', username: 'bob', is_active: true },
      { id: 4, display_name: 'System', username: 'default', is_active: true }
    ];
    
    const result = getLabelDropdownOptions(twoUsersList);
    expect(result).toContainEqual({ value: 'Both', label: 'Both (Equal Split)' });
    expect(result).not.toContainEqual(expect.objectContaining({ value: 'All users' }));
  });

  test('should include "All users" option for three or more active users', () => {
    const result = getLabelDropdownOptions(mockUsers);
    expect(result).toContainEqual({ value: 'All users', label: 'All users (Equal Split)' });
    expect(result).not.toContainEqual({ value: 'Both', label: 'Both (Equal Split)' });
  });

  test('should exclude default system user from count', () => {
    const usersWithDefault = [
      { id: 1, display_name: 'Alice', username: 'alice', is_active: true },
      { id: 4, display_name: 'System', username: 'default', is_active: true }
    ];
    
    const result = getLabelDropdownOptions(usersWithDefault);
    // Should not have Both or All users since only 1 active user
    expect(result).not.toContainEqual(expect.objectContaining({ value: 'Both' }));
    expect(result).not.toContainEqual(expect.objectContaining({ value: 'All users' }));
  });

  test('should handle inactive users correctly', () => {
    const usersWithInactive = [
      { id: 1, display_name: 'Alice', username: 'alice', is_active: true },
      { id: 2, display_name: 'Bob', username: 'bob', is_active: false },
      { id: 3, display_name: 'Charlie', username: 'charlie', is_active: true }
    ];
    
    const result = getLabelDropdownOptions(usersWithInactive);
    expect(result).toContainEqual({ value: 'Alice', label: 'Alice' });
    expect(result).not.toContainEqual({ value: 'Bob', label: 'Bob' });
    expect(result).toContainEqual({ value: 'Charlie', label: 'Charlie' });
    expect(result).toContainEqual({ value: 'Both', label: 'Both (Equal Split)' });
  });
});
