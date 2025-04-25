import { 
  filterByDate, 
  filterByBankCategory, 
  filterByLabel, 
  sortByDate,
  applyFilters 
} from './filterTransactions.js';

describe('Transaction Filtering Functions', () => {
  // Test data
  const testTransactions = [
    { id: 1, date: '2023-01-15', amount: 100, bank_category: 'Food', label: 'Ruby' },
    { id: 2, date: '2023-02-20', amount: 200, bank_category: 'Transport', label: 'Jack' },
    { id: 3, date: '2023-03-10', amount: 300, bank_category: 'Entertainment', label: 'Both' },
    { id: 4, date: '2023-04-05', amount: 400, bank_category: 'Food', label: 'Ruby' },
    { id: 5, date: '2023-05-25', amount: 500, bank_category: null, label: 'Jack' }
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

    test('should handle null bank categories', () => {
      const bankCategoryFilter = [null];

      const result = filterByBankCategory(testTransactions, bankCategoryFilter);
      
      // Should include transactions with null bank category (id: 5)
      expect(result).toHaveLength(1);
      expect(result.map(t => t.id)).toEqual([5]);
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
      
      // Should include transactions with 'Ruby' label (ids: 1, 4)
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([1, 4]);
    });

    test('should filter transactions by multiple labels', () => {
      const labelFilter = ['Ruby', 'Both'];

      const result = filterByLabel(testTransactions, labelFilter);
      
      // Should include transactions with 'Ruby' or 'Both' labels (ids: 1, 3, 4)
      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual([1, 3, 4]);
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
      expect(result.map(t => t.id)).toEqual([1, 2, 3, 4, 5]);
    });

    test('should sort transactions by date in descending order', () => {
      const result = sortByDate(testTransactions, 'desc');
      
      // Should sort by date, newest first
      expect(result.map(t => t.id)).toEqual([5, 4, 3, 2, 1]);
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

    test('should apply no filters when all filter objects are empty', () => {
      const filters = {
        dateFilter: { startDate: '', endDate: '' },
        bankCategoryFilter: [],
        labelFilter: [],
        sortBy: ''
      };

      const result = applyFilters(testTransactions, filters);
      
      // Should return all transactions unsorted
      expect(result).toEqual(testTransactions);
    });
  });
}); 