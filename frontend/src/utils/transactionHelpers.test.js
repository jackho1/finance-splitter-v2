// Transaction helper utility functions and tests
// These functions could be extracted from components for better reusability

describe('Transaction Helper Functions', () => {
  describe('formatCurrency', () => {
    const formatCurrency = (amount, options = {}) => {
      const absAmount = Math.abs(amount);
      const showSign = options.showSign !== false;
      const precision = options.precision !== undefined ? options.precision : 2;
      
      let formatted;
      
      if (absAmount >= 1000000) {
        formatted = `$${(absAmount / 1000000).toFixed(1)}M`;
      } else if (absAmount >= 1000) {
        formatted = `$${(absAmount / 1000).toFixed(1)}k`;
      } else {
        formatted = `$${absAmount.toFixed(precision)}`;
      }
      
      if (showSign && amount < 0) {
        formatted = `-${formatted}`;
      }
      
      return formatted;
    };

    test('should format small amounts correctly', () => {
      expect(formatCurrency(50)).toBe('$50.00');
      expect(formatCurrency(123.45)).toBe('$123.45');
    });

    test('should format negative amounts with sign', () => {
      expect(formatCurrency(-75)).toBe('-$75.00');
      expect(formatCurrency(-123.45)).toBe('-$123.45');
    });

    test('should format thousands correctly', () => {
      expect(formatCurrency(1000)).toBe('$1.0k');
      expect(formatCurrency(1500)).toBe('$1.5k');
      expect(formatCurrency(-2500)).toBe('-$2.5k');
    });

    test('should format millions correctly', () => {
      expect(formatCurrency(1000000)).toBe('$1.0M');
      expect(formatCurrency(1500000)).toBe('$1.5M');
      expect(formatCurrency(-2500000)).toBe('-$2.5M');
    });

    test('should handle options correctly', () => {
      expect(formatCurrency(-75, { showSign: false })).toBe('$75.00');
      expect(formatCurrency(123.456, { precision: 1 })).toBe('$123.5');
      expect(formatCurrency(123.456, { precision: 0 })).toBe('$123');
    });

    test('should handle edge cases', () => {
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(999.99)).toBe('$999.99');
      expect(formatCurrency(999999)).toBe('$1000.0k');
    });
  });

  describe('parseTransactionAmount', () => {
    const parseTransactionAmount = (amount) => {
      if (amount === null || amount === undefined || amount === '') {
        return 0;
      }
      
      const parsed = parseFloat(amount);
      return isNaN(parsed) ? 0 : parsed;
    };

    test('should parse valid number strings', () => {
      expect(parseTransactionAmount('100')).toBe(100);
      expect(parseTransactionAmount('123.45')).toBe(123.45);
      expect(parseTransactionAmount('-50.99')).toBe(-50.99);
    });

    test('should parse actual numbers', () => {
      expect(parseTransactionAmount(100)).toBe(100);
      expect(parseTransactionAmount(123.45)).toBe(123.45);
      expect(parseTransactionAmount(-50.99)).toBe(-50.99);
    });

    test('should handle invalid inputs', () => {
      expect(parseTransactionAmount('invalid')).toBe(0);
      expect(parseTransactionAmount('')).toBe(0);
      expect(parseTransactionAmount(null)).toBe(0);
      expect(parseTransactionAmount(undefined)).toBe(0);
    });

    test('should handle edge cases', () => {
      expect(parseTransactionAmount('0')).toBe(0);
      expect(parseTransactionAmount('000123')).toBe(123);
      expect(parseTransactionAmount('123.000')).toBe(123);
      expect(parseTransactionAmount('123.456789')).toBeCloseTo(123.456789);
    });
  });

  describe('generateTransactionId', () => {
    const generateTransactionId = () => {
      return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    test('should generate unique IDs', () => {
      const id1 = generateTransactionId();
      const id2 = generateTransactionId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^txn_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^txn_\d+_[a-z0-9]+$/);
    });

    test('should have consistent format', () => {
      const id = generateTransactionId();
      expect(id).toMatch(/^txn_\d+_[a-z0-9]+$/);
      expect(id.startsWith('txn_')).toBe(true);
    });
  });

  describe('validateTransactionData', () => {
    const validateTransactionData = (transactionData) => {
      const errors = [];
      
      if (!transactionData.date) {
        errors.push('Date is required');
      } else {
        const date = new Date(transactionData.date);
        if (isNaN(date.getTime())) {
          errors.push('Invalid date format');
        }
      }
      
      if (!transactionData.description || transactionData.description.trim() === '') {
        errors.push('Description is required');
      }
      
      if (!transactionData.amount && transactionData.amount !== 0) {
        errors.push('Amount is required');
      } else {
        const amount = parseFloat(transactionData.amount);
        if (isNaN(amount)) {
          errors.push('Amount must be a valid number');
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    };

    test('should validate correct transaction data', () => {
      const transaction = {
        date: '2023-06-15',
        description: 'Test transaction',
        amount: '100.50',
        category: 'Food'
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should detect missing date', () => {
      const transaction = {
        description: 'Test transaction',
        amount: '100.50'
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date is required');
    });

    test('should detect invalid date format', () => {
      const transaction = {
        date: 'invalid-date',
        description: 'Test transaction',
        amount: '100.50'
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid date format');
    });

    test('should detect missing description', () => {
      const transaction = {
        date: '2023-06-15',
        amount: '100.50'
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    test('should detect empty description', () => {
      const transaction = {
        date: '2023-06-15',
        description: '   ',
        amount: '100.50'
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    test('should detect missing amount', () => {
      const transaction = {
        date: '2023-06-15',
        description: 'Test transaction'
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount is required');
    });

    test('should detect invalid amount', () => {
      const transaction = {
        date: '2023-06-15',
        description: 'Test transaction',
        amount: 'invalid'
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be a valid number');
    });

    test('should allow zero amount', () => {
      const transaction = {
        date: '2023-06-15',
        description: 'Test transaction',
        amount: 0
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(true);
    });

    test('should accumulate multiple errors', () => {
      const transaction = {
        // Missing date
        // Missing description
        amount: 'invalid'
      };
      
      const result = validateTransactionData(transaction);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors).toContain('Date is required');
      expect(result.errors).toContain('Description is required');
      expect(result.errors).toContain('Amount must be a valid number');
    });
  });

  describe('groupTransactionsByCategory', () => {
    const groupTransactionsByCategory = (transactions) => {
      const grouped = {};
      
      transactions.forEach(transaction => {
        const category = transaction.category || 'Uncategorized';
        
        if (!grouped[category]) {
          grouped[category] = {
            transactions: [],
            total: 0,
            count: 0
          };
        }
        
        grouped[category].transactions.push(transaction);
        grouped[category].total += parseTransactionAmount(transaction.amount);
        grouped[category].count += 1;
      });
      
      return grouped;
    };

    const parseTransactionAmount = (amount) => {
      const parsed = parseFloat(amount);
      return isNaN(parsed) ? 0 : parsed;
    };

    test('should group transactions by category', () => {
      const transactions = [
        { id: 1, category: 'Food', amount: '100' },
        { id: 2, category: 'Transport', amount: '50' },
        { id: 3, category: 'Food', amount: '75' }
      ];
      
      const result = groupTransactionsByCategory(transactions);
      
      expect(result.Food.count).toBe(2);
      expect(result.Food.total).toBe(175);
      expect(result.Transport.count).toBe(1);
      expect(result.Transport.total).toBe(50);
    });

    test('should handle uncategorized transactions', () => {
      const transactions = [
        { id: 1, amount: '100' }, // No category
        { id: 2, category: null, amount: '50' },
        { id: 3, category: '', amount: '75' }
      ];
      
      const result = groupTransactionsByCategory(transactions);
      
      expect(result.Uncategorized.count).toBe(3);
      expect(result.Uncategorized.total).toBe(225);
    });

    test('should handle empty transactions array', () => {
      const result = groupTransactionsByCategory([]);
      expect(result).toEqual({});
    });

    test('should handle negative amounts correctly', () => {
      const transactions = [
        { id: 1, category: 'Food', amount: '100' },
        { id: 2, category: 'Food', amount: '-50' }
      ];
      
      const result = groupTransactionsByCategory(transactions);
      
      expect(result.Food.total).toBe(50);
    });
  });

  describe('calculateRunningBalance', () => {
    const calculateRunningBalance = (transactions, initialBalance = 0) => {
      let balance = initialBalance;
      
      return transactions.map(transaction => {
        balance += parseTransactionAmount(transaction.amount);
        
        return {
          ...transaction,
          runningBalance: balance
        };
      });
    };

    const parseTransactionAmount = (amount) => {
      const parsed = parseFloat(amount);
      return isNaN(parsed) ? 0 : parsed;
    };

    test('should calculate running balance correctly', () => {
      const transactions = [
        { id: 1, amount: '100' },
        { id: 2, amount: '-50' },
        { id: 3, amount: '25' }
      ];
      
      const result = calculateRunningBalance(transactions, 0);
      
      expect(result[0].runningBalance).toBe(100);
      expect(result[1].runningBalance).toBe(50);
      expect(result[2].runningBalance).toBe(75);
    });

    test('should handle initial balance', () => {
      const transactions = [
        { id: 1, amount: '100' },
        { id: 2, amount: '-50' }
      ];
      
      const result = calculateRunningBalance(transactions, 200);
      
      expect(result[0].runningBalance).toBe(300);
      expect(result[1].runningBalance).toBe(250);
    });

    test('should handle empty transactions', () => {
      const result = calculateRunningBalance([]);
      expect(result).toEqual([]);
    });

    test('should preserve original transaction properties', () => {
      const transactions = [
        { id: 1, description: 'Test', amount: '100', category: 'Food' }
      ];
      
      const result = calculateRunningBalance(transactions);
      
      expect(result[0].id).toBe(1);
      expect(result[0].description).toBe('Test');
      expect(result[0].category).toBe('Food');
      expect(result[0].runningBalance).toBe(100);
    });
  });

  describe('findDuplicateTransactions', () => {
    const findDuplicateTransactions = (transactions, tolerance = 0.01) => {
      const duplicates = [];
      
      for (let i = 0; i < transactions.length; i++) {
        for (let j = i + 1; j < transactions.length; j++) {
          const t1 = transactions[i];
          const t2 = transactions[j];
          
          const sameDate = t1.date === t2.date;
          const sameDescription = t1.description === t2.description;
          const amountDiff = Math.abs(
            parseTransactionAmount(t1.amount) - parseTransactionAmount(t2.amount)
          );
          const similarAmount = amountDiff <= tolerance;
          
          if (sameDate && sameDescription && similarAmount) {
            const duplicateGroup = [t1.id, t2.id];
            if (!duplicates.some(group => 
              group.includes(t1.id) || group.includes(t2.id)
            )) {
              duplicates.push(duplicateGroup);
            }
          }
        }
      }
      
      return duplicates;
    };

    const parseTransactionAmount = (amount) => {
      const parsed = parseFloat(amount);
      return isNaN(parsed) ? 0 : parsed;
    };

    test('should find exact duplicates', () => {
      const transactions = [
        { id: 1, date: '2023-06-01', description: 'Store A', amount: '100' },
        { id: 2, date: '2023-06-01', description: 'Store A', amount: '100' },
        { id: 3, date: '2023-06-02', description: 'Store B', amount: '50' }
      ];
      
      const duplicates = findDuplicateTransactions(transactions);
      
      expect(duplicates).toEqual([[1, 2]]);
    });

    test('should find duplicates within tolerance', () => {
      const transactions = [
        { id: 1, date: '2023-06-01', description: 'Store A', amount: '100.00' },
        { id: 2, date: '2023-06-01', description: 'Store A', amount: '100.01' }
      ];
      
      const duplicates = findDuplicateTransactions(transactions, 0.02);
      
      expect(duplicates).toEqual([[1, 2]]);
    });

    test('should not find duplicates outside tolerance', () => {
      const transactions = [
        { id: 1, date: '2023-06-01', description: 'Store A', amount: '100.00' },
        { id: 2, date: '2023-06-01', description: 'Store A', amount: '100.05' }
      ];
      
      const duplicates = findDuplicateTransactions(transactions, 0.01);
      
      expect(duplicates).toEqual([]);
    });

    test('should not find duplicates with different dates', () => {
      const transactions = [
        { id: 1, date: '2023-06-01', description: 'Store A', amount: '100' },
        { id: 2, date: '2023-06-02', description: 'Store A', amount: '100' }
      ];
      
      const duplicates = findDuplicateTransactions(transactions);
      
      expect(duplicates).toEqual([]);
    });

    test('should not find duplicates with different descriptions', () => {
      const transactions = [
        { id: 1, date: '2023-06-01', description: 'Store A', amount: '100' },
        { id: 2, date: '2023-06-01', description: 'Store B', amount: '100' }
      ];
      
      const duplicates = findDuplicateTransactions(transactions);
      
      expect(duplicates).toEqual([]);
    });

    test('should handle empty transactions array', () => {
      const duplicates = findDuplicateTransactions([]);
      expect(duplicates).toEqual([]);
    });
  });
});
