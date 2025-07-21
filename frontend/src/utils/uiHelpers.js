// UI Helper utility functions

/**
 * Create and display a notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Display duration in milliseconds
 * @returns {HTMLElement} Notification element
 */
export const createNotification = (message, type = 'info', duration = 3000) => {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.className = `notification notification-${type}`;
  
  const styles = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '10px 20px',
    borderRadius: '4px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    zIndex: '1000',
    fontSize: '14px'
  };

  const typeStyles = {
    'success': { backgroundColor: '#d4edda', color: '#155724' },
    'error': { backgroundColor: '#f8d7da', color: '#721c24' },
    'warning': { backgroundColor: '#fff3cd', color: '#856404' },
    'info': { backgroundColor: '#e3f2fd', color: '#1976d2' }
  };

  Object.assign(notification.style, styles, typeStyles[type] || typeStyles.info);

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, duration);

  return notification;
};

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
