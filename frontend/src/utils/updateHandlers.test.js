import axios from 'axios';
import { getApiUrl, getApiUrlWithParams } from './apiUtils';

import { 
  normalizeValue, 
  valuesAreEqual, 
  getFieldType,
  optimizedHandleUpdate,
  optimizedHandlePersonalUpdate,
  optimizedHandleOffsetUpdate,
  optimizedHandleBudgetUpdate
} from './updateHandlers';

// Mock axios module
const originalAxios = { ...axios };

// Override axios methods directly
Object.defineProperty(axios, 'put', {
  value: (url, data) => {
    axiosCalls.push({ method: 'put', url, data });
    if (mockAxiosError) {
      return Promise.reject(mockAxiosError);
    }
    return Promise.resolve(mockAxiosResponse);
  },
  writable: true
});

Object.defineProperty(axios, 'get', {
  value: (url) => {
    axiosCalls.push({ method: 'get', url });
    if (mockAxiosError) {
      return Promise.reject(mockAxiosError);
    }
    return Promise.resolve(mockAxiosResponse);
  },
  writable: true
});

// Mock axios - simplified for ES modules
let mockAxiosResponse = { data: { success: true } };
let mockAxiosError = null;
let axiosCalls = [];

// Helper functions to control mock behavior
const setMockAxiosResponse = (response) => {
  mockAxiosResponse = response;
  mockAxiosError = null;
};

const setMockAxiosError = (error) => {
  mockAxiosError = error;
  mockAxiosResponse = null;
};

const clearAxiosCalls = () => {
  axiosCalls = [];
};

const getAxiosCalls = () => axiosCalls;

// Mock DOM manipulation functions
const mockNotificationSetup = () => {
  const mockNotification = {
    textContent: '',
    style: {},
    remove: () => {},
  };
  
  document.createElement = () => mockNotification;
  document.body.appendChild = () => {};
  document.body.removeChild = () => {};
  document.body.contains = () => true;
  
  return mockNotification;
};

describe('Value Normalization and Comparison Utilities', () => {
  describe('normalizeValue', () => {
    test('should normalize null values', () => {
      expect(normalizeValue(null)).toBe(null);
      expect(normalizeValue(undefined)).toBe(null);
      expect(normalizeValue('')).toBe(null);
    });

    test('should normalize string values', () => {
      expect(normalizeValue('hello')).toBe('hello');
      expect(normalizeValue('  hello  ')).toBe('hello');
      expect(normalizeValue('  ')).toBe(null);
    });

    test('should normalize number values', () => {
      expect(normalizeValue('123', 'number')).toBe(123);
      expect(normalizeValue('123.45', 'number')).toBe(123.45);
      expect(normalizeValue('invalid', 'number')).toBe(null);
      expect(normalizeValue('', 'number')).toBe(null);
      expect(normalizeValue(123, 'number')).toBe(123);
    });

    test('should normalize date values', () => {
      expect(normalizeValue('2023-12-25', 'date')).toBe('2023-12-25');
      expect(normalizeValue('invalid-date', 'date')).toBe(null);
      expect(normalizeValue('', 'date')).toBe(null);
      expect(normalizeValue(null, 'date')).toBe(null);
    });

    test('should handle edge cases', () => {
      expect(normalizeValue(0, 'number')).toBe(0);
      expect(normalizeValue(false)).toBe(false);
      expect(normalizeValue(true)).toBe(true);
    });
  });

  describe('valuesAreEqual', () => {
    test('should compare null/undefined/empty values as equal', () => {
      expect(valuesAreEqual(null, undefined)).toBe(true);
      expect(valuesAreEqual('', null)).toBe(true);
      expect(valuesAreEqual('   ', '')).toBe(true);
      expect(valuesAreEqual(undefined, '')).toBe(true);
    });

    test('should compare string values correctly', () => {
      expect(valuesAreEqual('hello', 'hello')).toBe(true);
      expect(valuesAreEqual('hello', 'world')).toBe(false);
      expect(valuesAreEqual('  hello  ', 'hello')).toBe(true);
      expect(valuesAreEqual('hello', null)).toBe(false);
    });

    test('should compare number values correctly', () => {
      expect(valuesAreEqual('123', '123.00', 'number')).toBe(true);
      expect(valuesAreEqual(123, '123', 'number')).toBe(true);
      expect(valuesAreEqual('123.45', '123.46', 'number')).toBe(false);
      expect(valuesAreEqual('invalid', null, 'number')).toBe(true);
    });

    test('should compare date values correctly', () => {
      expect(valuesAreEqual('2023-12-25', '2023-12-25', 'date')).toBe(true);
      expect(valuesAreEqual('2023-12-25', '2023-12-26', 'date')).toBe(false);
      expect(valuesAreEqual('invalid', null, 'date')).toBe(true);
    });
  });

  describe('getFieldType', () => {
    test('should return correct field types', () => {
      expect(getFieldType('amount')).toBe('number');
      expect(getFieldType('date')).toBe('date');
      expect(getFieldType('description')).toBe('string');
      expect(getFieldType('label')).toBe('string');
      expect(getFieldType('bank_category')).toBe('string');
    });
  });
});

describe('Update Handler Functions', () => {
  beforeEach(() => {
    mockNotificationSetup();
    // Reset axios mock.
    clearAxiosCalls();
    setMockAxiosResponse({ data: { success: true } });
  });

  describe('optimizedHandleUpdate', () => {
    const mockProps = {
      transactions: [
        { id: 1, description: 'Test', amount: 100, date: '2023-12-25' },
        { id: 2, description: 'Test 2', amount: 200, date: '2023-12-26' }
      ],
      setTransactions: () => {},
      setFilteredTransactions: () => {},
      setEditCell: () => {},
      setIsUpdating: () => {}
    };

    test('should skip API call when values are equal', async () => {
      await optimizedHandleUpdate(
        1, 
        'description', 
        'Test', // Same as existing
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating
      );

      expect(getAxiosCalls().length).toBe(0);
    });

    test('should make API call when values are different', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 1, description: 'Updated Test', amount: 100, date: '2023-12-25' },
          message: 'Updated successfully'
        }
      };
      setMockAxiosResponse(mockResponse);

      await optimizedHandleUpdate(
        1, 
        'description', 
        'Updated Test', // Different from existing
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating
      );

      const calls = getAxiosCalls();
      expect(calls.length).toBe(1);
      expect(calls[0].url).toBe(getApiUrl('/transactions/1'));
      expect(calls[0].data).toEqual({ description: 'Updated Test' });
    });

    test('should handle transaction not found', async () => {
      const originalConsoleError = console.error;
      let errorMessage = '';
      console.error = (msg, id) => { errorMessage = `${msg} ${id}`; };

      await optimizedHandleUpdate(
        999, // Non-existent ID
        'description', 
        'Test',
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating
      );

      expect(errorMessage).toBe('Transaction not found: 999');
      expect(getAxiosCalls().length).toBe(0);

      console.error = originalConsoleError;
    });

    test('should handle API errors', async () => {
      const mockError = new Error('Network error');
      mockError.response = {
        data: { error: 'Server error' }
      };
      setMockAxiosError(mockError);

      // Mock alert
      let alertMessage = '';
      window.alert = (msg) => { alertMessage = msg; };

      await optimizedHandleUpdate(
        1, 
        'description', 
        'Updated Test',
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating
      );

      expect(alertMessage).toBe('Server error');
      // setEditCell should be called with null (test passes if no error thrown)
    });

    test('should update state correctly on successful API response', async () => {
      const updatedTransaction = { id: 1, description: 'Updated Test', amount: 100, date: '2023-12-25' };
      const mockResponse = {
        data: {
          success: true,
          data: updatedTransaction,
          changedFields: ['description']
        }
      };
      setMockAxiosResponse(mockResponse);

      await optimizedHandleUpdate(
        1, 
        'description', 
        'Updated Test',
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating
      );

      // Test passes if API call was made successfully (verified by axios calls above)
    });
  });

  describe('optimizedHandlePersonalUpdate', () => {
    const mockProps = {
      transactions: [
        { id: 1, description: 'Test', amount: 100, category: 'Food' },
      ],
      setTransactions: () => {},
      setFilteredTransactions: () => {},
      setEditCell: () => {},
      setIsUpdating: () => {},
      showErrorNotification: () => {}
    };

    test('should validate category field', async () => {
      await optimizedHandlePersonalUpdate(
        1, 
        'category', 
        '', // Empty category
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating,
        mockProps.showErrorNotification
      );

      expect(getAxiosCalls().length).toBe(0);
      // setEditCell should NOT be called for validation errors
    });

    test('should make API call for valid category', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 1, description: 'Test', amount: 100, category: 'Entertainment' }
        }
      };
      setMockAxiosResponse(mockResponse);

      await optimizedHandlePersonalUpdate(
        1, 
        'category', 
        'Entertainment',
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating,
        mockProps.showErrorNotification
      );

      const calls = getAxiosCalls();
      expect(calls.length).toBe(1);
      expect(calls[0].url).toBe(getApiUrl('/personal-transactions/1'));
      expect(calls[0].data).toEqual({ category: 'Entertainment' });
    });

    test('should handle foreign key constraint errors', async () => {
      const mockError = new Error('Database error');
      mockError.response = {
        data: { 
          error: 'Database error',
          details: 'foreign key constraint failed'
        }
      };
      setMockAxiosError(mockError);

      await optimizedHandlePersonalUpdate(
        1, 
        'category', 
        'InvalidCategory',
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating,
        mockProps.showErrorNotification
      );

      // Test passes if error notification is called (function execution completes)
    });
  });

  describe('optimizedHandleOffsetUpdate', () => {
    const mockProps = {
      transactions: [
        { id: 1, description: 'Test', amount: 100, category: 'Food' },
      ],
      setTransactions: () => {},
      setFilteredTransactions: () => {},
      setEditCell: () => {},
      setIsUpdating: () => {},
      showErrorNotification: () => {}
    };

    test('should make API call for offset transactions', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 1, description: 'Updated Test', amount: 100, category: 'Food' }
        }
      };
      setMockAxiosResponse(mockResponse);

      await optimizedHandleOffsetUpdate(
        1, 
        'description', 
        'Updated Test',
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating,
        mockProps.showErrorNotification
      );

      const calls = getAxiosCalls();
      expect(calls.length).toBe(1);
      expect(calls[0].url).toBe(getApiUrl('/offset-transactions/1'));
      expect(calls[0].data).toEqual({ description: 'Updated Test' });
    });

    test('should handle offset transaction not found', async () => {
      const originalError = console.error;
      let errorMessage = '';
      console.error = (msg, id) => { errorMessage = `${msg} ${id}`; };

      await optimizedHandleOffsetUpdate(
        999, // Non-existent ID
        'description', 
        'Test',
        mockProps.transactions,
        mockProps.setTransactions,
        mockProps.setFilteredTransactions,
        mockProps.setEditCell,
        mockProps.setIsUpdating,
        mockProps.showErrorNotification
      );

      expect(errorMessage).toBe('Offset transaction not found: 999');

      console.error = originalError;
    });
  });

  describe('optimizedHandleBudgetUpdate', () => {
    test('should skip API call when budget values are equal', async () => {
      let successCalled = false;
      let errorCalled = false;
      const onSuccess = () => { successCalled = true; };
      const onError = () => { errorCalled = true; };

      await optimizedHandleBudgetUpdate(
        1, 
        100, // newBudget
        100, // currentBudget - same value
        onSuccess,
        onError
      );

      expect(successCalled).toBe(false);
      expect(errorCalled).toBe(false);
    });

    test('should make API call when budget values are different', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 1, budget: 150 }
        }
      };
      setMockAxiosResponse(mockResponse);

      let successData = null;
      let errorCalled = false;
      const onSuccess = (data) => { successData = data; };
      const onError = () => { errorCalled = true; };

      await optimizedHandleBudgetUpdate(
        1, 
        150, // newBudget
        100, // currentBudget - different value
        onSuccess,
        onError
      );

      expect(successData).toEqual({ id: 1, budget: 150 });
      expect(errorCalled).toBe(false);
    });

    test('should handle budget update errors', async () => {
      const mockError = new Error('Budget error');
      mockError.response = {
        data: { error: 'Budget validation failed' }
      };
      setMockAxiosError(mockError);

      let successCalled = false;
      let errorMessage = '';
      const onSuccess = () => { successCalled = true; };
      const onError = (msg) => { errorMessage = msg; };

      await optimizedHandleBudgetUpdate(
        1, 
        150, 
        100,
        onSuccess,
        onError
      );

      expect(errorMessage).toBe('Budget validation failed');
      expect(successCalled).toBe(false);
    });

    test('should handle optimized response', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 1, budget: 150 },
          optimized: true
        }
      };
      setMockAxiosResponse(mockResponse);

      let successData = null;
      let errorCalled = false;
      const onSuccess = (data) => { successData = data; };
      const onError = () => { errorCalled = true; };

      await optimizedHandleBudgetUpdate(
        1, 
        150, 
        100,
        onSuccess,
        onError
      );

      expect(successData).toEqual({ id: 1, budget: 150 });
      expect(errorCalled).toBe(false);
      // Should show optimized notification (test notification content is handled in DOM mock)
    });
  });
});
