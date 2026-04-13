// Date helper utility functions and tests
// These functions could be extracted from components for better reusability

describe('Date Helper Functions', () => {
  describe('isDateInCurrentMonth', () => {
    const isDateInCurrentMonth = (dateString, currentMonth, currentYear) => {
      const date = new Date(dateString);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    };

    test('should return true for dates in the current month', () => {
      const result = isDateInCurrentMonth('2023-06-15', 5, 2023); // June is month 5 (0-indexed)
      expect(result).toBe(true);
    });

    test('should return false for dates in different month', () => {
      const result = isDateInCurrentMonth('2023-07-15', 5, 2023); // July vs June
      expect(result).toBe(false);
    });

    test('should return false for dates in different year', () => {
      const result = isDateInCurrentMonth('2024-06-15', 5, 2023); // 2024 vs 2023
      expect(result).toBe(false);
    });

    test('should handle edge cases with first/last day of month', () => {
      expect(isDateInCurrentMonth('2023-06-01', 5, 2023)).toBe(true);
      expect(isDateInCurrentMonth('2023-06-30', 5, 2023)).toBe(true);
      expect(isDateInCurrentMonth('2023-05-31', 5, 2023)).toBe(false);
      expect(isDateInCurrentMonth('2023-07-01', 5, 2023)).toBe(false);
    });
  });

  describe('formatDateForDisplay', () => {
    const formatDateForDisplay = (dateString, options = {}) => {
      const date = new Date(dateString);
      
      if (options.format === 'short') {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      if (options.format === 'long') {
        return date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
      
      // Default format
      return date.toLocaleDateString('en-GB');
    };

    test('should format dates in default format', () => {
      const result = formatDateForDisplay('2023-06-15');
      expect(result).toBe('15/06/2023');
    });

    test('should format dates in short format', () => {
      const result = formatDateForDisplay('2023-06-15', { format: 'short' });
      expect(result).toBe('Jun 15, 2023');
    });

    test('should format dates in long format', () => {
      const result = formatDateForDisplay('2023-06-15', { format: 'long' });
      expect(result).toBe('15 June 2023');
    });

    test('should handle invalid dates gracefully', () => {
      expect(() => formatDateForDisplay('invalid-date')).not.toThrow();
    });
  });

  describe('getDateRange', () => {
    const getDateRange = (startDate, endDate) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates = [];
      
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current).toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      
      return dates;
    };

    test('should return array of dates between start and end', () => {
      const dates = getDateRange('2023-06-01', '2023-06-03');
      expect(dates).toEqual(['2023-06-01', '2023-06-02', '2023-06-03']);
    });

    test('should return single date when start equals end', () => {
      const dates = getDateRange('2023-06-01', '2023-06-01');
      expect(dates).toEqual(['2023-06-01']);
    });

    test('should return empty array when start is after end', () => {
      const dates = getDateRange('2023-06-03', '2023-06-01');
      expect(dates).toEqual([]);
    });

    test('should handle month boundaries correctly', () => {
      const dates = getDateRange('2023-05-30', '2023-06-02');
      expect(dates).toEqual(['2023-05-30', '2023-05-31', '2023-06-01', '2023-06-02']);
    });
  });

  describe('isDateInRange', () => {
    const isDateInRange = (dateString, startDate, endDate) => {
      const date = new Date(dateString);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start && date < start) return false;
      if (end && date > end) return false;
      
      return true;
    };

    test('should return true for dates within range', () => {
      const result = isDateInRange('2023-06-15', '2023-06-01', '2023-06-30');
      expect(result).toBe(true);
    });

    test('should return false for dates before range', () => {
      const result = isDateInRange('2023-05-31', '2023-06-01', '2023-06-30');
      expect(result).toBe(false);
    });

    test('should return false for dates after range', () => {
      const result = isDateInRange('2023-07-01', '2023-06-01', '2023-06-30');
      expect(result).toBe(false);
    });

    test('should return true when only start date provided and date is after', () => {
      const result = isDateInRange('2023-06-15', '2023-06-01', null);
      expect(result).toBe(true);
    });

    test('should return false when only start date provided and date is before', () => {
      const result = isDateInRange('2023-05-15', '2023-06-01', null);
      expect(result).toBe(false);
    });

    test('should return true when only end date provided and date is before', () => {
      const result = isDateInRange('2023-06-15', null, '2023-06-30');
      expect(result).toBe(true);
    });

    test('should return false when only end date provided and date is after', () => {
      const result = isDateInRange('2023-07-15', null, '2023-06-30');
      expect(result).toBe(false);
    });

    test('should return true when no range provided', () => {
      const result = isDateInRange('2023-06-15', null, null);
      expect(result).toBe(true);
    });

    test('should handle boundary dates correctly', () => {
      expect(isDateInRange('2023-06-01', '2023-06-01', '2023-06-30')).toBe(true);
      expect(isDateInRange('2023-06-30', '2023-06-01', '2023-06-30')).toBe(true);
    });
  });

  describe('getMonthName', () => {
    const getMonthName = (monthIndex, format = 'long') => {
      const date = new Date(2023, monthIndex, 1);
      
      if (format === 'short') {
        return date.toLocaleDateString('default', { month: 'short' });
      }
      
      return date.toLocaleDateString('default', { month: 'long' });
    };

    test('should return full month names by default', () => {
      expect(getMonthName(0)).toBe('January');
      expect(getMonthName(5)).toBe('June');
      expect(getMonthName(11)).toBe('December');
    });

    test('should return short month names when specified', () => {
      expect(getMonthName(0, 'short')).toBe('Jan');
      expect(getMonthName(5, 'short')).toBe('Jun');
      expect(getMonthName(11, 'short')).toBe('Dec');
    });

    test('should handle edge cases', () => {
      // Testing boundary values
      expect(getMonthName(0)).toBe('January');
      expect(getMonthName(11)).toBe('December');
    });
  });

  describe('calculateMonthDifference', () => {
    const calculateMonthDifference = (date1, date2) => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      
      return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    };

    test('should calculate difference in same year', () => {
      const diff = calculateMonthDifference('2023-01-01', '2023-06-01');
      expect(diff).toBe(5); // June - January = 5 months
    });

    test('should calculate difference across years', () => {
      const diff = calculateMonthDifference('2022-10-01', '2023-02-01');
      expect(diff).toBe(4); // Oct to Feb across year boundary
    });

    test('should return negative for reverse order', () => {
      const diff = calculateMonthDifference('2023-06-01', '2023-01-01');
      expect(diff).toBe(-5);
    });

    test('should return zero for same month', () => {
      const diff = calculateMonthDifference('2023-06-15', '2023-06-20');
      expect(diff).toBe(0);
    });

    test('should handle year boundaries correctly', () => {
      const diff = calculateMonthDifference('2022-12-31', '2023-01-01');
      expect(diff).toBe(1);
    });
  });
});
