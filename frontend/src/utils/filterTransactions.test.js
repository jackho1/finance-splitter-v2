import { 
  filterByDate, 
  filterByBankCategory, 
  filterByLabel, 
  sortByDate,
  sortByAmount,
  sortByDescription,
  applyFilters 
} from './filterTransactions.js';

describe('Transaction Filtering Functions', () => {
  // Test data
  const testTransactions = [
    { id: 1, date: '2023-01-15', amount: 100, bank_category: 'Food', label: 'Ruby', description: 'Groceries' },
    { id: 2, date: '2023-02-20', amount: -200, bank_category: 'Transport', label: 'Jack', description: 'Uber ride' },
    { id: 3, date: '2023-03-10', amount: 300, bank_category: 'Entertainment', label: 'Both', description: 'Concert tickets' },
    { id: 4, date: '2023-04-05', amount: -150, bank_category: 'Food', label: 'Ruby', description: 'Restaurant' },
    { id: 5, date: '2023-05-25', amount: 500, bank_category: null, label: 'Jack', description: 'Bonus' },
    { id: 6, date: '2023-06-15', amount: 0, bank_category: '', label: 'Both', description: null },
    { id: 7, date: '2023-07-01', amount: '250.50', bank_category: undefined, label: 'Ruby', description: 'Apple Store' }
  ];

  describe('filterByDate', () => {
    test('should filter transactions by date range', () => {
      const dateFilter = {
        startDate: '2023-02-01',
        endDate: '2023-04-30'
      };

      const result = filterByDate(testTransactions, dateFilter);
      
      // Should include transactions from February to April (ids: 2, 3, 4)
      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual([2, 3, 4]);
    });

    test('should return all transactions if date filter is empty', () => {
      const dateFilter = {
        startDate: '',
        endDate: ''
      };

      const result = filterByDate(testTransactions, dateFilter);
      
      expect(result).toEqual(testTransactions);
    });

    test('should filter with only startDate provided', () => {
      const dateFilter = {
        startDate: '2023-04-01',
        endDate: ''
      };

      const result = filterByDate(testTransactions, dateFilter);
      
      // Should include transactions from April onwards (ids: 4, 5, 6, 7)
      expect(result).toHaveLength(4);
      expect(result.map(t => t.id)).toEqual([4, 5, 6, 7]);
    });

    test('should filter with only endDate provided', () => {
      const dateFilter = {
        startDate: '',
        endDate: '2023-03-31'
      };

      const result = filterByDate(testTransactions, dateFilter);
      
      // Should include transactions up to March (ids: 1, 2, 3)
      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual([1, 2, 3]);
    });

    test('should handle edge cases of dates exactly on the boundary', () => {
      const dateFilter = {
        startDate: '2023-02-20', // Exactly the date of one transaction
        endDate: '2023-03-10'    // Exactly the date of another transaction
      };

      const result = filterByDate(testTransactions, dateFilter);
      
      // Should include transactions on February 20 and March 10 (ids: 2, 3)
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([2, 3]);
    });
  });

  describe('filterByBankCategory', () => {
    test('should filter transactions by bank category', () => {
      const bankCategoryFilter = ['Food'];

      const result = filterByBankCategory(testTransactions, bankCategoryFilter);
      
      // Should include transactions with 'Food' category (ids: 1, 4)
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([1, 4]);
    });

    test('should filter transactions by multiple bank categories', () => {
      const bankCategoryFilter = ['Food', 'Transport'];

      const result = filterByBankCategory(testTransactions, bankCategoryFilter);
      
      // Should include transactions with 'Food' or 'Transport' categories (ids: 1, 2, 4)
      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual([1, 2, 4]);
    });

    test('should handle null, undefined, and empty string bank categories', () => {
      const bankCategoryFilter = [null];

      const result = filterByBankCategory(testTransactions, bankCategoryFilter);
      
      // Should include transactions with null, undefined, or empty bank category (ids: 5, 6, 7)
      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual([5, 6, 7]);
    });

    test('should handle mixed null and defined categories', () => {
      const bankCategoryFilter = ['Food', null];

      const result = filterByBankCategory(testTransactions, bankCategoryFilter);
      
      // Should include 'Food' category and null/empty categories (ids: 1, 4, 5, 6, 7)
      expect(result).toHaveLength(5);
      expect(result.map(t => t.id)).toEqual([1, 4, 5, 6, 7]);
    });

    test('should return all transactions if bank category filter is empty', () => {
      const bankCategoryFilter = [];

      const result = filterByBankCategory(testTransactions, bankCategoryFilter);
      
      expect(result).toEqual(testTransactions);
    });
  });

  describe('filterByLabel', () => {
    test('should filter transactions by label', () => {
      const labelFilter = ['Ruby'];

      const result = filterByLabel(testTransactions, labelFilter);
      
      // Should include transactions with 'Ruby' label (ids: 1, 4, 7)
      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual([1, 4, 7]);
    });

    test('should filter transactions by multiple labels', () => {
      const labelFilter = ['Ruby', 'Both'];

      const result = filterByLabel(testTransactions, labelFilter);
      
      // Should include transactions with 'Ruby' or 'Both' labels (ids: 1, 3, 4, 6, 7)
      expect(result).toHaveLength(5);
      expect(result.map(t => t.id)).toEqual([1, 3, 4, 6, 7]);
    });

    test('should return all transactions if label filter is empty', () => {
      const labelFilter = [];

      const result = filterByLabel(testTransactions, labelFilter);
      
      expect(result).toEqual(testTransactions);
    });
  });

  describe('sortByDate', () => {
    test('should sort transactions by date in ascending order', () => {
      const result = sortByDate(testTransactions, 'asc');
      
      // Should sort by date, oldest first
      expect(result.map(t => t.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    test('should sort transactions by date in descending order', () => {
      const result = sortByDate(testTransactions, 'desc');
      
      // Should sort by date, newest first
      expect(result.map(t => t.id)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    });
  });

  describe('sortByAmount', () => {
    test('should sort transactions by amount in ascending order', () => {
      const result = sortByAmount(testTransactions, 'asc');
      
      // Should sort by amount, lowest first (negative values first)
      // Expected order: -200, -150, 0, 100, 250.50, 300, 500
      expect(result.map(t => t.id)).toEqual([2, 4, 6, 1, 7, 3, 5]);
    });

    test('should sort transactions by amount in descending order', () => {
      const result = sortByAmount(testTransactions, 'desc');
      
      // Should sort by amount, highest first
      // Expected order: 500, 300, 250.50, 100, 0, -150, -200
      expect(result.map(t => t.id)).toEqual([5, 3, 7, 1, 6, 4, 2]);
    });

    test('should handle string amounts', () => {
      const result = sortByAmount(testTransactions, 'asc');
      
      // Transaction 7 has amount as string '250.50', should be converted properly
      const transaction7 = result.find(t => t.id === 7);
      expect(transaction7).toBeDefined();
      
      // Should be sorted correctly between 100 and 300
      const transaction7Index = result.findIndex(t => t.id === 7);
      const transaction1Index = result.findIndex(t => t.id === 1);
      const transaction3Index = result.findIndex(t => t.id === 3);
      
      expect(transaction7Index).toBeGreaterThan(transaction1Index);
      expect(transaction7Index).toBeLessThan(transaction3Index);
    });
  });

  describe('sortByDescription', () => {
    test('should sort transactions by description in ascending order', () => {
      const result = sortByDescription(testTransactions, 'asc');
      
      // Should sort alphabetically A-Z, null values should sort to beginning
      // Expected order: null, Apple Store, Bonus, Concert tickets, Groceries, Restaurant, Uber ride
      expect(result.map(t => t.id)).toEqual([6, 7, 5, 3, 1, 4, 2]);
    });

    test('should sort transactions by description in descending order', () => {
      const result = sortByDescription(testTransactions, 'desc');
      
      // Should sort alphabetically Z-A
      // Expected order: Uber ride, Restaurant, Groceries, Concert tickets, Bonus, Apple Store, null
      expect(result.map(t => t.id)).toEqual([2, 4, 1, 3, 5, 7, 6]);
    });

    test('should handle case-insensitive sorting', () => {
      const mixedCaseTransactions = [
        { id: 1, description: 'apple' },
        { id: 2, description: 'Banana' },
        { id: 3, description: 'CHERRY' }
      ];
      
      const result = sortByDescription(mixedCaseTransactions, 'asc');
      
      // Should sort ignoring case: apple, Banana, CHERRY
      expect(result.map(t => t.id)).toEqual([1, 2, 3]);
    });

    test('should handle null and undefined descriptions', () => {
      const result = sortByDescription(testTransactions, 'asc');
      
      // Should handle null description (transaction 6)
      const nullDescTransaction = result[0];
      expect(nullDescTransaction.id).toBe(6);
      expect(nullDescTransaction.description).toBe(null);
    });
  });

  describe('applyFilters', () => {
    test('should apply multiple filters together', () => {
      const filters = {
        dateFilter: {
          startDate: '2023-01-01',
          endDate: '2023-04-30'
        },
        bankCategoryFilter: ['Food', 'Transport'],
        labelFilter: ['Ruby', 'Jack'],
        sortBy: 'date-asc'
      };

      const result = applyFilters(testTransactions, filters);
      
      // Should filter by date (Jan-Apr), bank categories (Food, Transport), 
      // labels (Ruby, Jack), and sort by date ascending
      // Expected transactions: ids 1, 2, 4 in that order
      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual([1, 2, 4]);
    });

    test('should apply amount sorting', () => {
      const filters = {
        dateFilter: {},
        bankCategoryFilter: [],
        labelFilter: [],
        sortBy: 'amount-desc'
      };

      const result = applyFilters(testTransactions, filters);
      
      // Should sort all transactions by amount descending
      expect(result.map(t => t.id)).toEqual([5, 3, 7, 1, 6, 4, 2]);
    });

    test('should apply description sorting', () => {
      const filters = {
        dateFilter: {},
        bankCategoryFilter: [],
        labelFilter: [],
        sortBy: 'description-asc'
      };

      const result = applyFilters(testTransactions, filters);
      
      // Should sort all transactions by description ascending
      expect(result.map(t => t.id)).toEqual([6, 7, 5, 3, 1, 4, 2]);
    });

    test('should apply no filters when all filter objects are empty', () => {
      const filters = {
        dateFilter: {},
        bankCategoryFilter: [],
        labelFilter: [],
        sortBy: ''
      };

      const result = applyFilters(testTransactions, filters);
      
      // Should return all transactions unsorted
      expect(result).toEqual(testTransactions);
    });

    test('should handle undefined filter properties with defaults', () => {
      const filters = {
        sortBy: 'date-desc'
      };

      const result = applyFilters(testTransactions, filters);
      
      // Should apply only sorting, other filters should default to empty
      expect(result).toHaveLength(testTransactions.length);
      expect(result.map(t => t.id)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    });

    test('should default to date-desc sorting when invalid sort option provided', () => {
      const filters = {
        sortBy: 'invalid-option'
      };

      const result = applyFilters(testTransactions, filters);
      
      // Should fall back to date-desc sorting
      expect(result.map(t => t.id)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    });
  });
});