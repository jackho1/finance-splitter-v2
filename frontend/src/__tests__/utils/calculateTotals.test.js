import { calculateTotals } from './calculateTotals';
import { USER_CONFIG } from '../config/userConfig';

describe('calculateTotals', () => {
  // Use the configuration for test setup
  const { PRIMARY_USER_1, PRIMARY_USER_2, BOTH_LABEL } = USER_CONFIG;
  
  test('calculates totals correctly with configuration', () => {
    const transactions = [
      { id: 1, label: PRIMARY_USER_1, amount: 100 },
      { id: 2, label: PRIMARY_USER_2, amount: 200 },
      { id: 3, label: BOTH_LABEL, amount: 300 }
    ];
    
    // Use default labels from config
    const result = calculateTotals(transactions);
    
    // Test assertions using the config values
    expect(result[PRIMARY_USER_1]).toBe(100 + 300 / 2);  // Ruby gets full amount + half of Both
    expect(result[PRIMARY_USER_2]).toBe(200 + 300 / 2);  // Jack gets full amount + half of Both
    expect(result[BOTH_LABEL]).toBe(300);  // Both gets full amount
  });
  
  test('handles invalid transactions', () => {
    const transactions = [
      { id: 1, label: PRIMARY_USER_1, amount: '100abc' },  // Invalid amount
      { id: 2, label: null, amount: 200 },  // No label
    ];
    
    const result = calculateTotals(transactions);
    
    // Should handle invalid amount by parsing relevant portion
    expect(result[PRIMARY_USER_1]).toBe(100);
    // No label should be ignored
    expect(result).toEqual({ [PRIMARY_USER_1]: 100, [PRIMARY_USER_2]: 0, [BOTH_LABEL]: 0 });
  });

  test('should handle negative amounts', () => {
    const mockTransactions = [
      { id: 1, label: PRIMARY_USER_1, amount: -50 },
      { id: 2, label: PRIMARY_USER_2, amount: -100 },
      { id: 3, label: BOTH_LABEL, amount: -200 }
    ];

    const result = calculateTotals(mockTransactions);

    expect(result).toEqual({
      [PRIMARY_USER_1]: -150,  // -50 + (-200/2)
      [PRIMARY_USER_2]: -200,  // -100 + (-200/2)
      [BOTH_LABEL]: -200   // -200
    });
  });

  test('should skip transactions with null or undefined labels', () => {
    const mockTransactions = [
      { id: 1, label: PRIMARY_USER_1, amount: 100 },
      { id: 2, label: null, amount: 200 },
      { id: 3, label: undefined, amount: 300 },
      { id: 4, label: '', amount: 400 },
      { id: 5, label: PRIMARY_USER_2, amount: 500 }
    ];

    const result = calculateTotals(mockTransactions);

    expect(result).toEqual({
      [PRIMARY_USER_1]: 100,
      [PRIMARY_USER_2]: 500,
      [BOTH_LABEL]: 0
    });
  });

  test('should handle empty transactions array', () => {
    const result = calculateTotals([]);

    expect(result).toEqual({
      [PRIMARY_USER_1]: 0,
      [PRIMARY_USER_2]: 0,
      [BOTH_LABEL]: 0
    });
  });

  test('should handle custom labels', () => {
    const customLabels = ['Alice', 'Bob', 'Shared'];
    const mockTransactions = [
      { id: 1, label: 'Alice', amount: 100 },
      { id: 2, label: 'Bob', amount: 200 },
      { id: 3, label: 'Shared', amount: 300 }
    ];

    const result = calculateTotals(mockTransactions, customLabels);

    expect(result).toEqual({
      'Alice': 250,  // 100 + (300/2)
      'Bob': 350,    // 200 + (300/2)
      'Shared': 300  // 300
    });
  });

  test('should handle non-numeric amounts', () => {
    const mockTransactions = [
      { id: 1, label: PRIMARY_USER_1, amount: '100' },     // String should be parsed
      { id: 2, label: PRIMARY_USER_2, amount: '200abc' },  // Invalid number - JavaScript's parseFloat will return 200 for this
      { id: 3, label: BOTH_LABEL, amount: null }           // Null amount
    ];

    const result = calculateTotals(mockTransactions);

    expect(result).toEqual({
      [PRIMARY_USER_1]: 100,  // Parsed from string
      [PRIMARY_USER_2]: 200,  // parseFloat returns 200 from '200abc'
      [BOTH_LABEL]: 0         // Null parsed to 0
    });
  });
}); 