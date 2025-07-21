// Date helper utility functions

/**
 * Check if a date string is in the current month
 * @param {string} dateString - Date string to check
 * @param {number} currentMonth - Current month (0-indexed)
 * @param {number} currentYear - Current year
 * @returns {boolean} True if date is in current month
 */
export const isDateInCurrentMonth = (dateString, currentMonth, currentYear) => {
  const date = new Date(dateString);
  return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
};

/**
 * Get formatted date string
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString();
};

/**
 * Get month name from month number
 * @param {number} month - Month number (0-indexed)
 * @returns {string} Month name
 */
export const getMonthName = (month) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month];
};
