import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

// Import utility functions
import { calculateTotals } from './utils/calculateTotals';
import { applyFilters } from './utils/filterTransactions';

// Help Text Component for consistent styling
const HelpText = ({ children, isVisible, style = {} }) => {
  if (!isVisible) return null;
  
  return (
    <div className="help-text" style={style}>
      <div className="help-text-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="help-text-content">{children}</div>
    </div>
  );
};

const PersonalTransactions = ({ helpTextVisible }) => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [allFilteredTransactions, setAllFilteredTransactions] = useState([]);
  const [filters, setFilters] = useState({ sortBy: 'date-desc' });
  const [editCell, setEditCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Column filtering states
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const filterPopupRef = useRef(null);
  
  // Add new transaction state
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category: null
  });
  
  // Add refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch personal transactions from the backend
  useEffect(() => {
    setIsTransactionsLoading(true);
    
    axios.get('http://localhost:5000/personal-transactions')
      .then(response => {
        setTransactions(response.data);
        setFilteredTransactions(response.data);
        setAllFilteredTransactions(response.data);
        setIsTransactionsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsTransactionsLoading(false);
      });
  }, []);

  // Update the useEffect that fetches categories
  useEffect(() => {
    axios.get('http://localhost:5000/personal-categories')
      .then(response => {
        // Map the data to extract just the category names
        const categories = response.data.map(item => item.category);
        setAvailableCategories(categories);
      })
      .catch(err => {
        console.error('Error fetching personal categories:', err);
      });
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterPopupRef.current && !filterPopupRef.current.contains(event.target) && 
          !event.target.closest('button[data-filter="category"]')) {
        setActiveFilterColumn(null);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle category filter change
  const handleCategoryFilterChange = (category, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    setCategoryFilter(prev => {
      const isAlreadyIncluded = prev.some(item => 
        (item === null && category === null) || item === category
      );

      if (isAlreadyIncluded) {
        return prev.filter(item => 
          !((item === null && category === null) || item === category)
        );
      } else {
        return [...prev, category];
      }
    });
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonth(prev => (prev === 0 ? 11 : prev - 1));
    setCurrentYear(prev => (currentMonth === 0 ? prev - 1 : prev));
  };

  const handleNextMonth = () => {
    const now = new Date();
    const currentMonthDate = new Date(currentYear, currentMonth);
    const nextMonthDate = new Date(currentYear, currentMonth + 1);
    
    if (nextMonthDate <= now) {
      setCurrentMonth(prev => (prev === 11 ? 0 : prev + 1));
      setCurrentYear(prev => (currentMonth === 11 ? prev + 1 : prev));
    }
  };

  const isCurrentMonthCurrent = () => {
    const now = new Date();
    const currentMonthDate = new Date(currentYear, currentMonth);
    const nextMonthDate = new Date(currentYear, currentMonth + 1);
    
    return nextMonthDate > now;
  };

  // Function to refresh personal bank feeds
  const refreshPersonalBankFeeds = async () => {
    try {
      setIsRefreshing(true);
      
      const response = await axios.post('http://localhost:5000/refresh-personal-bank-feeds');
      
      if (response.data.success) {
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = 'Personal bank feeds refreshed successfully!';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = '#d4edda';
        notification.style.color = '#155724';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        notification.style.zIndex = '1000';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
        
        // Refresh the transactions data
        const transactionsResponse = await axios.get('http://localhost:5000/personal-transactions');
        setTransactions(transactionsResponse.data);
        
        // Reapply filters to new data
        let filtered = applyFilters(transactionsResponse.data, {
          dateFilter,
          sortBy: filters.sortBy
        });
        
        if (categoryFilter.length > 0) {
          filtered = filtered.filter(transaction => {
            if (categoryFilter.includes(null) && transaction.category === null) {
              return true;
            }
            return categoryFilter.includes(transaction.category);
          });
        }
        
        setAllFilteredTransactions(filtered);
        
        // Apply month filtering for table view
        let tableFiltered = filtered;
        if (!dateFilter.startDate && !dateFilter.endDate) {
          tableFiltered = filtered.filter(transaction => {
            const date = new Date(transaction.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
          });
        }
        
        setFilteredTransactions(tableFiltered);
        
      } else {
        // Show error notification
        const notification = document.createElement('div');
        notification.textContent = 'Failed to refresh personal bank feeds: ' + response.data.message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = '#f8d7da';
        notification.style.color = '#721c24';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        notification.style.zIndex = '1000';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 5000);
      }
    } catch (error) {
      console.error('Error refreshing personal bank feeds:', error);
      
      const notification = document.createElement('div');
      notification.textContent = 'Error refreshing personal bank feeds. Check console for details.';
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#f8d7da';
      notification.style.color = '#721c24';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Update the filter logic in useEffect
  useEffect(() => {
    let filtered = applyFilters(transactions, {
      dateFilter,
      sortBy: filters.sortBy
    });

    if (categoryFilter.length > 0) {
      filtered = filtered.filter(transaction => {
        if (categoryFilter.includes(null) && !transaction.category) {
          return true;
        }
        return categoryFilter.includes(transaction.category);
      });
    }
    
    setAllFilteredTransactions(filtered);
    
    let tableFiltered = filtered;
    if (!dateFilter.startDate && !dateFilter.endDate) {
      tableFiltered = filtered.filter(transaction => {
        const date = new Date(transaction.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
    }
    
    setFilteredTransactions(tableFiltered);
  }, [transactions, filters.sortBy, dateFilter, categoryFilter, currentMonth, currentYear]);

  const toggleColumnFilter = (column) => {
    setActiveFilterColumn(activeFilterColumn === column ? null : column);
  };
  
  const handleDateFilterChange = (e) => {
    const { name, value } = e.target;
    setDateFilter(prev => ({ ...prev, [name]: value }));
  };
  
  const clearFilters = () => {
    setDateFilter({ startDate: '', endDate: '' });
    setCategoryFilter([]);
    setActiveFilterColumn(null);
  };
  
  const getMinMaxDates = () => {
    if (transactions.length === 0) return { min: '', max: '' };
    
    let minDate = new Date(transactions[0].date);
    let maxDate = new Date(transactions[0].date);
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      if (date < minDate) minDate = date;
      if (date > maxDate) maxDate = date;
    });
    
    return {
      min: minDate.toISOString().split('T')[0],
      max: maxDate.toISOString().split('T')[0]
    };
  };
  
  const dateRange = getMinMaxDates();

  const handleDoubleClick = (transactionId, field, value) => {
    setEditCell({ transactionId, field });
    setEditValue(value);
  };

  const handleInputChange = (e) => {
    setEditValue(e.target.value);
  };

  // Helper function to show error notifications
  const showErrorNotification = (message) => {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#f8d7da';
    notification.style.color = '#721c24';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    notification.style.zIndex = '1000';
    notification.style.border = '1px solid #f5c6cb';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 5000);
  };

  const handleUpdate = async (transactionId, field) => {
    try {
      // Validate category field before submission
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
          document.body.removeChild(notification);
        }, 4000);
        
        // Don't reset edit state so user can continue editing
        return;
      }
      
      setIsUpdating(true);
      
      const response = await axios.put(`http://localhost:5000/personal-transactions/${transactionId}`, { 
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
        notification.textContent = response.data.message || 'Transaction updated successfully!';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = '#d4edda';
        notification.style.color = '#155724';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        notification.style.zIndex = '1000';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
        
        setEditCell(null);
      } else {
        const errorMessage = response.data.error || response.data.errors?.join(', ') || 'Update failed';
        showErrorNotification(errorMessage);
      }
    } catch (err) {
      console.error('Error updating transaction:', err);
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
      // Only reset edit cell if update was successful or a critical error occurred
      if (field !== 'category' || editValue) {
        setEditCell(null);
      }
    }
  };

  const renderCell = (transaction, field) => {
    if (editCell && editCell.transactionId === transaction.id && editCell.field === field) {
      switch (field) {
        case 'date':
          return (
            <input
              type="date"
              value={editValue || ''}
              onChange={handleInputChange}
              onBlur={() => handleUpdate(transaction.id, field)}
              style={{ 
                width: '200px',
                maxWidth: '100%',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '6px 12px',
                position: 'relative',
                zIndex: 1000,
                backgroundColor: 'white',
                color: '#2d3748',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4299e1';
                e.target.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.15)';
              }}
              autoFocus
            />
          );
        case 'amount':
          return (
            <input
              type="number"
              step="0.01"
              value={editValue || ''}
              onChange={handleInputChange}
              onBlur={() => handleUpdate(transaction.id, field)}
              style={{ 
                width: '200px',
                maxWidth: '100%',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '6px 12px',
                position: 'relative',
                zIndex: 1000,
                backgroundColor: 'white',
                color: '#2d3748',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4299e1';
                e.target.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.15)';
              }}
              autoFocus
            />
          );
        case 'category':
          return (
            <select 
              value={editValue || ''}
              onChange={handleInputChange} 
              onBlur={(e) => {
                e.target.style.borderColor = editValue === '' ? '#ffc107' : '#e2e8f0';
                e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                handleUpdate(transaction.id, field);
              }}
              style={{ 
                width: '200px',
                maxWidth: '100%',
                border: editValue === '' ? '2px solid #ffc107' : '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '6px 12px',
                position: 'relative',
                zIndex: 1000,
                backgroundColor: 'white',
                color: '#2d3748',
                fontSize: '14px',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '16px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4299e1';
                e.target.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.15)';
              }}
              autoFocus
            >
              <option value="" style={{ color: '#a0aec0' }}>Select a category (required)</option>
              {availableCategories.map(category => (
                <option key={category} value={category} style={{ color: '#2d3748' }}>
                  {category}
                </option>
              ))}
            </select>
          );
        default:
          return (
            <input
              type="text"
              value={editValue || ''}
              onChange={handleInputChange}
              onBlur={() => handleUpdate(transaction.id, field)}
              style={{ 
                width: field === 'description' ? '400px' : '200px',
                maxWidth: '100%',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '6px 12px',
                position: 'relative',
                zIndex: 1000,
                backgroundColor: 'white',
                color: '#2d3748',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4299e1';
                e.target.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.15)';
              }}
              autoFocus
            />
          );
      }
    }

    // For non-edit mode, just display the value directly
    const isEmpty = 
      transaction[field] === null || 
      transaction[field] === undefined || 
      transaction[field] === '';
    
    return (
      <div 
        onDoubleClick={() => handleDoubleClick(transaction.id, field, transaction[field] || '')}
        style={{ cursor: 'pointer', minHeight: '1.2em' }}
      >
        {isEmpty ? (
          ''
        ) : field === 'date' ? (
          new Date(transaction[field]).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        ) : field === 'amount' && transaction[field] != null && !isNaN(transaction[field]) ? (
          transaction[field] < 0 ? `-$${Math.abs(transaction[field])}` : `$${transaction[field]}`
        ) : (
          transaction[field]
        )}
      </div>
    );
  };

  // Loading spinner component
  const LoadingSpinner = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: '20px',
      height: '100px'
    }}>
      <div style={{ 
        width: '40px', 
        height: '40px', 
        border: '4px solid rgba(0, 0, 0, 0.1)', 
        borderLeft: '4px solid #3498db', 
        borderRadius: '50%', 
        animation: 'spin 1s linear infinite' 
      }}></div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // Handlers for new transaction form
  const handleNewTransactionChange = (e) => {
    const { name, value } = e.target;
    setNewTransaction(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetNewTransactionForm = () => {
    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      category: null
    });
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    
    if (!newTransaction.date || !newTransaction.description || !newTransaction.amount) {
      alert('Please fill out all required fields: Date, Description, and Amount');
      return;
    }
    
    try {
      setIsUpdating(true);
      
      const transactionData = {
        ...newTransaction,
        amount: parseFloat(newTransaction.amount)
      };
      
      if (isNaN(transactionData.amount)) {
        alert('Please enter a valid number for the amount');
        setIsUpdating(false);
        return;
      }
      
      const response = await axios.post('http://localhost:5000/personal-transactions', transactionData);
      
      if (response.data.success) {
        const addedTransaction = response.data.data;
        
        setTransactions(prev => [addedTransaction, ...prev]);
        
        const transactionDate = new Date(addedTransaction.date);
        const isInCurrentMonth = transactionDate.getMonth() === currentMonth && 
                                transactionDate.getFullYear() === currentYear;
        
        if (isInCurrentMonth) {
          let shouldAdd = true;
          
          if (dateFilter.startDate || dateFilter.endDate) {
            if (dateFilter.startDate && new Date(addedTransaction.date) < new Date(dateFilter.startDate)) {
              shouldAdd = false;
            }
            if (dateFilter.endDate && new Date(addedTransaction.date) > new Date(dateFilter.endDate)) {
              shouldAdd = false;
            }
          }
          
          if (categoryFilter.length > 0) {
            if (!categoryFilter.includes(addedTransaction.category) && 
                !(categoryFilter.includes(null) && !addedTransaction.category)) {
              shouldAdd = false;
            }
          }
          
          if (shouldAdd) {
            setFilteredTransactions(prev => [addedTransaction, ...prev]);
          }
        }
        
        const notification = document.createElement('div');
        notification.textContent = 'Transaction added successfully!';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = '#d4edda';
        notification.style.color = '#155724';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        notification.style.zIndex = '1000';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
        
        resetNewTransactionForm();
        setIsAddingTransaction(false);
      } else {
        const errorMessage = response.data.error || response.data.errors?.join(', ') || 'Failed to add transaction';
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Error adding transaction:', err);
      
      let errorMessage = 'Failed to add transaction. Please try again.';
      
      if (err.response && err.response.data) {
        errorMessage = err.response.data.error || 
                      (err.response.data.errors && err.response.data.errors.join(', ')) || 
                      errorMessage;
      }
      
      alert(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleAddTransactionForm = () => {
    if (!isAddingTransaction) {
      resetNewTransactionForm();
    }
    setIsAddingTransaction(!isAddingTransaction);
  };

  const cancelAddTransaction = () => {
    setIsAddingTransaction(false);
    resetNewTransactionForm();
  };

  // Calculate total spend
  const totalSpend = filteredTransactions.reduce((sum, tx) => {
    return sum + (tx.amount || 0);
  }, 0);

  return (
    <div style={{ position: 'relative' }}>
      {isUpdating && (
        <div style={{ 
          position: 'absolute', 
          top: '0', 
          left: '0', 
          width: '100%', 
          height: '100%', 
          backgroundColor: 'rgba(255, 255, 255, 0.8)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 10,
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #4a90e2',
              animation: 'spin 1s linear infinite'
            }}></div>
            <div style={{ fontWeight: 'bold', color: '#333' }}>Updating transaction...</div>
          </div>
        </div>
      )}

      {/* Active filters display */}
      {(dateFilter.startDate || dateFilter.endDate || categoryFilter.length > 0) && (
        <div style={{ 
          margin: '10px 0', 
          padding: '10px', 
          backgroundColor: '#e8f4fd', 
          borderRadius: '6px',
          border: '1px solid #d0e8f9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong>Active Filters:</strong>
              {(dateFilter.startDate || dateFilter.endDate) && (
                <span style={{ margin: '0 10px' }}>
                  Date: {dateFilter.startDate || 'Start'} to {dateFilter.endDate || 'End'}
                </span>
              )}
              {categoryFilter.length > 0 && (
                <span style={{ margin: '0 10px' }}>
                  Categories: {categoryFilter.map(cat => cat === null ? 'null' : cat).join(', ')}
                </span>
              )}
            </div>
            <button 
              onClick={clearFilters}
              style={{ 
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'normal',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Placeholder for future chart section */}
      <div style={{ 
        height: '300px', 
        marginBottom: '60px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        border: '2px dashed #dee2e6',
        borderRadius: '8px',
        justifyContent: 'center',
        color: '#6c757d'
      }}>
        {isTransactionsLoading ? (
          <LoadingSpinner />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <rect x="7" y="14" width="2" height="4" rx="0.5" fill="currentColor"/>
              <rect x="12" y="12" width="2" height="6" rx="0.5" fill="currentColor"/>
              <rect x="17" y="10" width="2" height="8" rx="0.5" fill="currentColor"/>
            </svg>
            <h3>Category Spending Charts</h3>
            <p>Charts for grouped categories will be added here</p>
          </div>
        )}
      </div>

      <h2 className="section-title">
        Personal Transactions 
        <span className="date-label">
          {dateFilter.startDate || dateFilter.endDate ? (
            `(${dateFilter.startDate ? new Date(dateFilter.startDate).toLocaleDateString() : 'Start'} - ${dateFilter.endDate ? new Date(dateFilter.endDate).toLocaleDateString() : 'Today'})`
          ) : (
            `(${new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })} ${currentYear})`
          )}
        </span>
      </h2>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: 'transparent',
        borderRadius: '8px',
        flexDirection: 'column'
      }}>
        <div style={{ 
          display: 'flex', 
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={handlePrevMonth}
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 15px',
                backgroundColor: 'transparent',
                color: '#2c3e50',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '5px' }}>
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Previous Month
            </button>
            <div style={{ padding: '0 10px', fontWeight: '500' }}>
              {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <button 
              onClick={handleNextMonth}
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 15px',
                backgroundColor: 'transparent',
                color: '#2c3e50',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                cursor: isCurrentMonthCurrent() ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                boxShadow: isCurrentMonthCurrent() ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                opacity: isCurrentMonthCurrent() ? 0.7 : 1
              }}
              disabled={isCurrentMonthCurrent()}
            >
              Next Month
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '5px' }}>
                <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <label htmlFor="sort-select" style={{ marginRight: '8px', fontSize: '14px', color: '#555' }}>Sort by:</label>
              <select
                id="sort-select"
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  fontSize: '14px'
                }}
              >
                <option value="date-desc">Date (Newest First)</option>
                <option value="date-asc">Date (Oldest First)</option>
                <option value="amount-desc">Amount (Highest First)</option>
                <option value="amount-asc">Amount (Lowest First)</option>
                <option value="description-asc">Description (A-Z)</option>
                <option value="description-desc">Description (Z-A)</option>
              </select>
            </div>
            
            <button 
              onClick={refreshPersonalBankFeeds}
              disabled={isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 15px',
                backgroundColor: isRefreshing ? '#95a5a6' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'background-color 0.2s ease',
                opacity: isRefreshing ? 0.7 : 1
              }}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                style={{
                  animation: isRefreshing ? 'spin 2s linear infinite' : 'none'
                }}
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              {isRefreshing ? 'Refreshing...' : 'Refresh Personal Bank Feeds'}
            </button>
            
            <button 
              onClick={toggleAddTransactionForm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 15px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Transaction
            </button>
          </div>
        </div>
        
        <HelpText isVisible={helpTextVisible} style={{marginBottom: '0px'}}>
          Use the month navigation to browse your personal transaction history. Only transactions from the selected month are shown unless a date filter is active.
        </HelpText>
      </div>
      
      {/* Add Transaction Form Modal */}
      {isAddingTransaction && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            width: '400px',
            maxWidth: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Add Personal Transaction</h2>
            
            <form onSubmit={handleAddTransaction}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  value={newTransaction.date}
                  onChange={handleNewTransactionChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Description *
                </label>
                <input
                  type="text"
                  name="description"
                  value={newTransaction.description}
                  onChange={handleNewTransactionChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter transaction description"
                  required
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Amount *
                </label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  value={newTransaction.amount}
                  onChange={handleNewTransactionChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter amount (negative for expenses)"
                  required
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Category
                </label>
                <select
                  name="category"
                  value={newTransaction.category || ''}
                  onChange={handleNewTransactionChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select a category</option>
                  {availableCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={cancelAddTransaction}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#f0f0f0',
                    color: '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Transactions table */}
      {isTransactionsLoading ? (
        <LoadingSpinner />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', position: 'relative' }}>
                <div 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => toggleColumnFilter('date')}
                >
                  Date {activeFilterColumn === 'date' ? '▲' : '▼'}
                </div>
                {activeFilterColumn === 'date' && (
                  <div 
                    ref={filterPopupRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 100,
                      background: 'white',
                      border: '1px solid #ccc',
                      padding: '10px',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      width: '250px'
                    }}
                  >
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', marginBottom: '4px' }}>From:</label>
                      <input 
                        type="date" 
                        name="startDate"
                        value={dateFilter.startDate}
                        onChange={handleDateFilterChange}
                        min={dateRange.min}
                        max={dateRange.max}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', marginBottom: '4px' }}>To:</label>
                      <input 
                        type="date" 
                        name="endDate"
                        value={dateFilter.endDate}
                        onChange={handleDateFilterChange}
                        min={dateRange.min}
                        max={dateRange.max}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                      <button 
                        onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                        style={{ 
                          padding: '6px 12px',
                          backgroundColor: '#f0f0f0',
                          color: '#333',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => setActiveFilterColumn(null)}
                        style={{ 
                          padding: '6px 12px',
                          backgroundColor: '#4a90e2',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>Description</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>Amount</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', position: 'relative' }}>
                <div 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => toggleColumnFilter('category')}
                >
                  Category {activeFilterColumn === 'category' ? '▲' : '▼'}
                </div>
                {activeFilterColumn === 'category' && (
                  <div 
                    ref={filterPopupRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 100,
                      background: 'white',
                      border: '1px solid #ccc',
                      padding: '10px',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      width: '200px',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}
                  >
                    {availableCategories.map(category => (
                      <div key={category} style={{ marginBottom: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={categoryFilter.includes(category)}
                            onChange={(e) => handleCategoryFilterChange(category, e)}
                            style={{ marginRight: '8px' }}
                          />
                          {category}
                        </label>
                      </div>
                    ))}
                    
                    <div style={{ marginBottom: '6px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={categoryFilter.includes(null)}
                          onChange={(e) => handleCategoryFilterChange(null, e)}
                          style={{ marginRight: '8px' }}
                        />
                        (Empty/Null)
                      </label>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                      <button 
                        onClick={() => setCategoryFilter([])}
                        style={{ 
                          padding: '6px 12px',
                          backgroundColor: '#f0f0f0',
                          color: '#333',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => setActiveFilterColumn(null)}
                        style={{ 
                          padding: '6px 12px',
                          backgroundColor: '#4a90e2',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(transaction => (
              <tr key={transaction.id}>
                <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                  {renderCell(transaction, 'date')}
                </td>
                <td style={{ border: '1px solid black', padding: '8px' }}>
                  {renderCell(transaction, 'description')}
                </td>
                <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                  {renderCell(transaction, 'amount')}
                </td>
                <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                  {renderCell(transaction, 'category')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PersonalTransactions;