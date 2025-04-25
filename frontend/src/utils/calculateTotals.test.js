import { calculateTotals } from './calculateTotals.js';

describe('calculateTotals', () => {
  const mockLabels = ['Ruby', 'Jack', 'Both'];

  test('should correctly calculate totals for transactions with different labels', () => {
    const mockTransactions = [
      { id: 1, label: 'Ruby', amount: 100 },
      { id: 2, label: 'Jack', amount: 200 },
      { id: 3, label: 'Both', amount: 300 }
    ];

    const result = calculateTotals(mockTransactions, mockLabels);

    expect(result).toEqual({
      'Ruby': 250,  // 100 + (300/2)
      'Jack': 350,  // 200 + (300/2)
      'Both': 300   // 300
    });
  });

  test('should handle negative amounts', () => {
    const mockTransactions = [
      { id: 1, label: 'Ruby', amount: -50 },
      { id: 2, label: 'Jack', amount: -100 },
      { id: 3, label: 'Both', amount: -200 }
    ];

    const result = calculateTotals(mockTransactions, mockLabels);

    expect(result).toEqual({
      'Ruby': -150,  // -50 + (-200/2)
      'Jack': -200,  // -100 + (-200/2)
      'Both': -200   // -200
    });
  });

  test('should skip transactions with null or undefined labels', () => {
    const mockTransactions = [
      { id: 1, label: 'Ruby', amount: 100 },
      { id: 2, label: null, amount: 200 },
      { id: 3, label: undefined, amount: 300 },
      { id: 4, label: '', amount: 400 },
      { id: 5, label: 'Jack', amount: 500 }
    ];

    const result = calculateTotals(mockTransactions, mockLabels);

    expect(result).toEqual({
      'Ruby': 100,
      'Jack': 500,
      'Both': 0
    });
  });

  test('should handle empty transactions array', () => {
    const result = calculateTotals([], mockLabels);

    expect(result).toEqual({
      'Ruby': 0,
      'Jack': 0,
      'Both': 0
    });
  });

  test('should handle missing labels', () => {
    const incompleteLabels = ['Ruby'];
    const mockTransactions = [
      { id: 1, label: 'Ruby', amount: 100 },
      { id: 2, label: 'Jack', amount: 200 },
      { id: 3, label: 'Both', amount: 300 }
    ];

    const result = calculateTotals(mockTransactions, incompleteLabels);

    expect(result).toEqual({
      'Ruby': 100
    });
  });

  test('should handle non-numeric amounts', () => {
    const mockTransactions = [
      { id: 1, label: 'Ruby', amount: '100' },  // String should be parsed
      { id: 2, label: 'Jack', amount: '200abc' },  // Invalid number - JavaScript's parseFloat will return 200 for this
      { id: 3, label: 'Both', amount: null }  // Null amount
    ];

    const result = calculateTotals(mockTransactions, mockLabels);

    expect(result).toEqual({
      'Ruby': 100,  // Parsed from string
      'Jack': 200,  // parseFloat returns 200 from '200abc'
      'Both': 0     // Null parsed to 0
    });
  });
}); 