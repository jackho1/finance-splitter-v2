import axios from 'axios';
import { getApiUrl } from './apiUtils';

// ==========================================================
// SHARED UTILITY FUNCTIONS FOR VALUE COMPARISON
// ==========================================================

/**
 * Helper function to normalize values for comparison
 * Handles null, undefined, empty string normalization
 */
export const normalizeValue = (value, fieldType = 'string') => {
  // Handle null/undefined cases
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty string cases
  if (value === '') {
    return null;
  }
  
  // Handle specific field types
  switch (fieldType) {
    case 'number':
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    case 'date':
      if (!value) return null;
      try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      } catch (e) {
        return null;
      }
    default:
      return typeof value === 'string' ? value.trim() || null : value;
  }
};

/**
 * Helper function to check if values are effectively equal
 * Takes into account null/undefined/empty string equivalence
 */
export const valuesAreEqual = (oldValue, newValue, fieldType = 'string') => {
  const normalizedOld = normalizeValue(oldValue, fieldType);
  const normalizedNew = normalizeValue(newValue, fieldType);
  
  // Both are null/undefined/empty - considered equal
  if (normalizedOld === null && normalizedNew === null) {
    return true;
  }
  
  // One is null, other is not - not equal
  if ((normalizedOld === null) !== (normalizedNew === null)) {
    return false;
  }
  
  // Both have values - compare them
  return normalizedOld === normalizedNew;
};

/**
 * Helper function to get field type for proper comparison
 */
export const getFieldType = (fieldName) => {
  switch (fieldName) {
    case 'amount':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'string';
  }
};

// ==========================================================
// OPTIMIZED UPDATE HANDLER FOR SHARED TRANSACTIONS (App.jsx)
// ==========================================================

export const optimizedHandleUpdate = async (transactionId, field, editValue, transactions, setTransactions, setFilteredTransactions, setEditCell, setIsUpdating) => {
  try {
    // Find the current transaction to compare values
    const currentTransaction = transactions.find(t => t.id === transactionId);
    if (!currentTransaction) {
      console.error('Transaction not found:', transactionId);
      return;
    }

    const fieldType = getFieldType(field);
    const originalValue = currentTransaction[field];

    // OPTIMIZATION: Check if the value has actually changed before sending request
    if (valuesAreEqual(originalValue, editValue, fieldType)) {
      console.log(`🔍 No changes detected for transaction ${transactionId}, field '${field}': '${originalValue}' === '${editValue}' (skipping API call)`);
      
      // Show a subtle notification that no changes were made
      const notification = document.createElement('div');
      notification.textContent = 'No changes detected - value already matches current data';
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#e3f2fd';
      notification.style.color = '#1976d2';
      notification.style.padding = '8px 16px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      notification.style.fontSize = '14px';
      notification.style.opacity = '0.9';
      
      document.body.appendChild(notification);
      
      // Remove notification after 2 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 2000);

      // Reset edit state without making API call
      setEditCell(null);
      return;
    }

    console.log(`📝 Value changed for transaction ${transactionId}, field '${field}': '${originalValue}' -> '${editValue}' (making API call)`);

    // Show update indicator
    setIsUpdating(true);
    
    // Send update to backend
    const response = await axios.put(`${getApiUrl()}/transactions/${transactionId}`, { 
      [field]: editValue 
    });
    
    // Check if the update was successful
    if (response.data.success) {
      // Get the successfully updated transaction from server response
      const updatedTransaction = response.data.data;
      
      // Update both transactions and filteredTransactions states
      setTransactions(prevTransactions => 
        prevTransactions.map(t => t.id === transactionId ? updatedTransaction : t)
      );
      
      setFilteredTransactions(prevFiltered => 
        prevFiltered.map(t => t.id === transactionId ? updatedTransaction : t)
      );
      
      // Show appropriate notification based on whether this was an optimized response
      const notification = document.createElement('div');
      if (response.data.optimized) {
        notification.textContent = 'No database update required - values already match in database';
        notification.style.backgroundColor = '#fff3e0';
        notification.style.color = '#f57c00';
      } else {
        notification.textContent = response.data.message || 'Transaction updated successfully!';
        notification.style.backgroundColor = '#d4edda';
        notification.style.color = '#155724';
        
        // Show which fields were changed
        if (response.data.changedFields && response.data.changedFields.length > 0) {
          notification.textContent += ` (Updated: ${response.data.changedFields.join(', ')})`;
        }
      }
      
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      
      document.body.appendChild(notification);
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
    } else {
      // Handle case where server returned error in a structured way
      const errorMessage = response.data.error || response.data.errors?.join(', ') || 'Update failed';
      alert(errorMessage);
    }
  } catch (err) {
    console.error('Error updating transaction:', err);
    let errorMessage = 'Failed to update transaction. Please try again.';
    
    // Try to extract more specific error from response if available
    if (err.response && err.response.data) {
      errorMessage = err.response.data.error || 
                     (err.response.data.errors && err.response.data.errors.join(', ')) || 
                     errorMessage;
    }
    
    alert(errorMessage);
  } finally {
    // Hide update indicator regardless of outcome
    setIsUpdating(false);
    // Reset edit state
    setEditCell(null);
  }
};

// ==========================================================
// OPTIMIZED UPDATE HANDLER FOR PERSONAL TRANSACTIONS
// ==========================================================

export const optimizedHandlePersonalUpdate = async (transactionId, field, editValue, transactions, setTransactions, setFilteredTransactions, setEditCell, setIsUpdating, showErrorNotification) => {
  try {
    // Find the current transaction to compare values
    const currentTransaction = transactions.find(t => t.id === transactionId);
    if (!currentTransaction) {
      console.error('Personal transaction not found:', transactionId);
      return;
    }

    // Validate category field before checking for changes
    if (field === 'category' && (!editValue || editValue === '')) {
      // Show friendly notification for missing category
      const notification = document.createElement('div');
      notification.textContent = 'Please select a category before saving. Category is required.';
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#fff3cd';
      notification.style.color = '#856404';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      notification.style.border = '1px solid #ffeaa7';
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 4000);
      
      // Don't reset edit state so user can continue editing
      return;
    }

    const fieldType = getFieldType(field);
    const originalValue = currentTransaction[field];

    // OPTIMIZATION: Check if the value has actually changed before sending request
    if (valuesAreEqual(originalValue, editValue, fieldType)) {
      console.log(`🔍 No changes detected for personal transaction ${transactionId}, field '${field}': '${originalValue}' === '${editValue}' (skipping API call)`);
      
      // Show a subtle notification that no changes were made
      const notification = document.createElement('div');
      notification.textContent = 'No changes detected - value already matches current data';
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#e3f2fd';
      notification.style.color = '#1976d2';
      notification.style.padding = '8px 16px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      notification.style.fontSize = '14px';
      notification.style.opacity = '0.9';
      
      document.body.appendChild(notification);
      
      // Remove notification after 2 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 2000);

      // Reset edit state without making API call
      setEditCell(null);
      return;
    }

    console.log(`📝 Value changed for personal transaction ${transactionId}, field '${field}': '${originalValue}' -> '${editValue}' (making API call)`);
    
    setIsUpdating(true);
    
    const response = await axios.put(`${getApiUrl()}/personal-transactions/${transactionId}`, { 
      [field]: editValue 
    });
    
    if (response.data.success) {
      const updatedTransaction = response.data.data;
      
      setTransactions(prevTransactions => 
        prevTransactions.map(t => t.id === transactionId ? updatedTransaction : t)
      );
      
      setFilteredTransactions(prevFiltered => 
        prevFiltered.map(t => t.id === transactionId ? updatedTransaction : t)
      );
      
      const notification = document.createElement('div');
      if (response.data.optimized) {
        notification.textContent = 'No database update required - values already match in database';
        notification.style.backgroundColor = '#fff3e0';
        notification.style.color = '#f57c00';
      } else {
        notification.textContent = response.data.message || 'Transaction updated successfully!';
        notification.style.backgroundColor = '#d4edda';
        notification.style.color = '#155724';
        
        // Show which fields were changed
        if (response.data.changedFields && response.data.changedFields.length > 0) {
          notification.textContent += ` (Updated: ${response.data.changedFields.join(', ')})`;
        }
      }
      
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
      setEditCell(null);
    } else {
      const errorMessage = response.data.error || response.data.errors?.join(', ') || 'Update failed';
      showErrorNotification(errorMessage);
    }
  } catch (err) {
    console.error('Error updating personal transaction:', err);
    let errorMessage = 'Failed to update transaction. Please try again.';
    
    if (err.response && err.response.data) {
      // Check for foreign key constraint error specifically
      if (err.response.data.details && err.response.data.details.includes('foreign key constraint')) {
        errorMessage = 'Category is required. Please select a valid category from the list.';
      } else {
        errorMessage = err.response.data.error || 
                       (err.response.data.errors && err.response.data.errors.join(', ')) || 
                       errorMessage;
      }
    }
    
    showErrorNotification(errorMessage);
  } finally {
    setIsUpdating(false);
    if (!editValue || (field === 'category' && editValue === '')) {
      // Don't reset edit state for validation errors
      return;
    }
    setEditCell(null);
  }
};

// ==========================================================
// OPTIMIZED UPDATE HANDLER FOR OFFSET TRANSACTIONS
// ==========================================================

export const optimizedHandleOffsetUpdate = async (transactionId, field, editValue, transactions, setTransactions, setFilteredTransactions, setEditCell, setIsUpdating, showErrorNotification) => {
  try {
    // Find the current transaction to compare values
    const currentTransaction = transactions.find(t => t.id === transactionId);
    if (!currentTransaction) {
      console.error('Offset transaction not found:', transactionId);
      return;
    }

    const fieldType = getFieldType(field);
    const originalValue = currentTransaction[field];

    // OPTIMIZATION: Check if the value has actually changed before sending request
    if (valuesAreEqual(originalValue, editValue, fieldType)) {
      console.log(`🔍 No changes detected for offset transaction ${transactionId}, field '${field}': '${originalValue}' === '${editValue}' (skipping API call)`);
      
      // Show a subtle notification that no changes were made
      const notification = document.createElement('div');
      notification.textContent = 'No changes detected - value already matches current data';
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#e3f2fd';
      notification.style.color = '#1976d2';
      notification.style.padding = '8px 16px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      notification.style.fontSize = '14px';
      notification.style.opacity = '0.9';
      
      document.body.appendChild(notification);
      
      // Remove notification after 2 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 2000);

      // Reset edit state without making API call
      setEditCell(null);
      return;
    }

    console.log(`📝 Value changed for offset transaction ${transactionId}, field '${field}': '${originalValue}' -> '${editValue}' (making API call)`);
    
    setIsUpdating(true);
    
    const response = await axios.put(`${getApiUrl()}/offset-transactions/${transactionId}`, { 
      [field]: editValue 
    });
    
    if (response.data.success) {
      const updatedTransaction = response.data.data;
      
      setTransactions(prevTransactions => 
        prevTransactions.map(t => t.id === transactionId ? updatedTransaction : t)
      );
      
      setFilteredTransactions(prevFiltered => 
        prevFiltered.map(t => t.id === transactionId ? updatedTransaction : t)
      );
      
      const notification = document.createElement('div');
      if (response.data.optimized) {
        notification.textContent = 'No database update required - values already match in database';
        notification.style.backgroundColor = '#fff3e0';
        notification.style.color = '#f57c00';
      } else {
        notification.textContent = response.data.message || 'Transaction updated successfully!';
        notification.style.backgroundColor = '#d4edda';
        notification.style.color = '#155724';
        
        // Show which fields were changed
        if (response.data.changedFields && response.data.changedFields.length > 0) {
          notification.textContent += ` (Updated: ${response.data.changedFields.join(', ')})`;
        }
      }
      
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
      setEditCell(null);
    } else {
      const errorMessage = response.data.error || response.data.errors?.join(', ') || 'Update failed';
      showErrorNotification(errorMessage);
    }
  } catch (err) {
    console.error('Error updating offset transaction:', err);
    let errorMessage = 'Failed to update transaction. Please try again.';
    
    if (err.response && err.response.data) {
      errorMessage = err.response.data.error || 
                     (err.response.data.errors && err.response.data.errors.join(', ')) || 
                     errorMessage;
    }
    
    showErrorNotification(errorMessage);
  } finally {
    setIsUpdating(false);
    setEditCell(null);
  }
};

// ==========================================================
// OPTIMIZED UPDATE HANDLER FOR BUDGET CATEGORIES
// ==========================================================

export const optimizedHandleBudgetUpdate = async (categoryId, newBudget, currentBudget, onSuccess, onError) => {
  try {
    const fieldType = 'number';

    // OPTIMIZATION: Check if the budget value has actually changed before sending request
    if (valuesAreEqual(currentBudget, newBudget, fieldType)) {
      console.log(`🔍 No changes detected for budget category ${categoryId}: ${currentBudget} === ${newBudget} (skipping API call)`);
      
      // Show a subtle notification that no changes were made
      const notification = document.createElement('div');
      notification.textContent = 'No changes detected - budget value already matches current data';
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#e3f2fd';
      notification.style.color = '#1976d2';
      notification.style.padding = '8px 16px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      notification.style.fontSize = '14px';
      notification.style.opacity = '0.9';
      
      document.body.appendChild(notification);
      
      // Remove notification after 2 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 2000);

      return; // Don't make API call
    }

    console.log(`💰 Budget value changed for category ${categoryId}: ${currentBudget} -> ${newBudget} (making API call)`);
    
    const response = await axios.put(`${getApiUrl()}/budget-categories/${categoryId}`, { 
      budget: newBudget 
    });
    
    if (response.data.success) {
      // Show appropriate notification based on whether this was an optimized response
      const notification = document.createElement('div');
      if (response.data.optimized) {
        notification.textContent = 'No database update required - budget already matches in database';
        notification.style.backgroundColor = '#fff3e0';
        notification.style.color = '#f57c00';
      } else {
        notification.textContent = 'Budget updated successfully!';
        notification.style.backgroundColor = '#d4edda';
        notification.style.color = '#155724';
      }
      
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
      if (onSuccess) {
        onSuccess(response.data.data);
      }
    } else {
      const errorMessage = response.data.error || 'Update failed';
      if (onError) {
        onError(errorMessage);
      }
    }
  } catch (err) {
    console.error('Error updating budget:', err);
    const errorMessage = err.response?.data?.error || 'Failed to update budget. Please try again.';
    if (onError) {
      onError(errorMessage);
    }
  }
}; 