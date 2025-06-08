import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

// Import utility functions
import { calculateTotals } from './utils/calculateTotals';
import { applyFilters } from './utils/filterTransactions';
import { optimizedHandleOffsetUpdate } from './utils/updateHandlers';
import './ModernTables.css';

// Help Text Component for consistent styling
const HelpText = ({ children, isVisible }) => {
  if (!isVisible) return null;
  
  return (
    <div className="help-text">
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

// Modern filter button component
const FilterButton = ({ isActive, onClick, children }) => (
  <button 
    className={`filter-button ${isActive ? 'active' : ''}`}
    onClick={onClick}
    title="Filter"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
    {children}
  </button>
);

const OffsetTransactions = ({ helpTextVisible }) => {
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

  // Add label-related states
  const [labels, setLabels] = useState([]);
  const [labelFilter, setLabelFilter] = useState([]);
  const [isLabelsLoading, setIsLabelsLoading] = useState(false);

  // Add refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add state for category order
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Split transaction states
  const [isSplitting, setIsSplitting] = useState(false);
  const [transactionToSplit, setTransactionToSplit] = useState(null);
  const [splitTransactions, setSplitTransactions] = useState([{
    description: '',
    amount: '',
    category: '',
    label: ''
  }]);
  const [isSavingSplit, setIsSavingSplit] = useState(false);

  // Add state for expanded row
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Add settings states
  const [showSettings, setShowSettings] = useState(false);
  const [hideZeroBalanceBuckets, setHideZeroBalanceBuckets] = useState(false);
  // Add state for negative bucket offset setting
  const [selectedNegativeOffsetBucket, setSelectedNegativeOffsetBucket] = useState('');

  // Add date filter and active filter column states
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);

  // Add state for showing all transactions (bypass month filtering)
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Key for localStorage
  const CATEGORY_ORDER_KEY = 'offset_categories_order';
  const SETTINGS_KEY = 'offset_transactions_settings';
  
  // Load saved order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem(CATEGORY_ORDER_KEY);
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        setCategoryOrder(parsedOrder);
      } catch (error) {
        console.error('Error parsing saved category order:', error);
        localStorage.removeItem(CATEGORY_ORDER_KEY);
      }
    }
  }, []);
  
  // Load saved settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setHideZeroBalanceBuckets(parsedSettings.hideZeroBalanceBuckets || false);
        setSelectedNegativeOffsetBucket(parsedSettings.selectedNegativeOffsetBucket || '');
      } catch (error) {
        console.error('Error parsing saved settings:', error);
        localStorage.removeItem(SETTINGS_KEY);
      }
    }
  }, []);
  
  // Initialize or update category order when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      // Calculate category data
      const categoryData = transactions.reduce((acc, transaction) => {
        const category = transaction.category || 'Uncategorized';
        if (!acc[category]) {
          acc[category] = {
            total: 0,
            count: 0
          };
        }
        const amount = typeof transaction.amount === 'number' ? 
          transaction.amount : parseFloat(transaction.amount) || 0;
        acc[category].total += amount;
        acc[category].count += 1;
        return acc;
      }, {});
      
      const currentCategories = Object.keys(categoryData);
      
      // Get the current saved order
      const savedOrder = localStorage.getItem(CATEGORY_ORDER_KEY);
      let existingOrder = [];
      
      if (savedOrder) {
        try {
          existingOrder = JSON.parse(savedOrder);
        } catch (error) {
          console.error('Error parsing saved category order:', error);
          localStorage.removeItem(CATEGORY_ORDER_KEY);
        }
      }
      
      // Check for new categories or removed categories
      const newCategories = currentCategories.filter(cat => !existingOrder.includes(cat));
      const removedCategories = existingOrder.filter(cat => !currentCategories.includes(cat));
      
      if (newCategories.length > 0 || removedCategories.length > 0) {
        // Update the order: keep existing order but add new categories and remove old ones  
        const updatedOrder = [
          ...existingOrder.filter(cat => currentCategories.includes(cat)), // Keep existing categories in order
          ...newCategories // Add new categories at the end
        ];
        
        setCategoryOrder(updatedOrder);
        localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(updatedOrder));
      } else if (existingOrder.length > 0 && categoryOrder.length === 0) {
        // Set the category order if it's empty but we have a saved order
        setCategoryOrder(existingOrder);
      } else if (existingOrder.length === 0 && categoryOrder.length === 0) {
        // No saved order and no current order, create initial order
        setCategoryOrder(currentCategories);
      }
    }
  }, [transactions]); // Remove categoryOrder from dependencies

  const filterPopupRef = useRef(null);
  
  // Add new transaction state
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category: null,
    label: ''
  });
  
  // Combined useEffect to fetch all initial data sequentially to avoid overwhelming database connections
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsTransactionsLoading(true);
      setIsLabelsLoading(true);
      
      try {
        console.log('Fetching offset transactions data using optimized endpoint...');
        
        // Single API call to get all offset initial data
        const response = await axios.get('http://localhost:5000/offset-initial-data');
        
        if (response.data.success) {
          const { offsetTransactions, offsetCategories, labels } = response.data.data;
          
          // Check for transactions with split properties (for debugging)
          const hasSplitTransactions = offsetTransactions.filter(t => t.has_split);
          const splitFromTransactions = offsetTransactions.filter(t => t.split_from_id);
          
          console.log('Transactions with has_split:', hasSplitTransactions.length);
          if (hasSplitTransactions.length > 0) {
            console.log('Sample has_split transaction:', hasSplitTransactions[0]);
          }
          
          console.log('Transactions with split_from_id:', splitFromTransactions.length);
          if (splitFromTransactions.length > 0) {
            console.log('Sample split_from_id transaction:', splitFromTransactions[0]);
          }
          
          // Set all data from the combined response
          setTransactions(offsetTransactions);
          setFilteredTransactions(offsetTransactions);
          setAllFilteredTransactions(offsetTransactions);
          setIsTransactionsLoading(false);
          
          setAvailableCategories(offsetCategories);
          
          setLabels(labels);
          setIsLabelsLoading(false);
          
          console.log('All offset transactions data loaded successfully using optimized endpoint');
        } else {
          throw new Error(response.data.error || 'Failed to fetch offset initial data');
        }
      } catch (error) {
        console.error('Error fetching offset initial data:', error);
        setIsTransactionsLoading(false);
        setIsLabelsLoading(false);
      }
    };
    
    fetchInitialData();
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

  // Handle category double click to filter by that category
  const handleCategoryDoubleClick = (category) => {
    // Clear date filter so we see all transactions for this category
    setDateFilter({ startDate: '', endDate: '' });
    
    // Set category filter to only show this category
    setCategoryFilter([category]);
    
    // Clear other filters
    setLabelFilter([]);
    
    // Set flag to show all transactions (bypass month filtering)
    setShowAllTransactions(true);
    
    // Scroll to transactions table
    const transactionsSection = document.querySelector('h2');
    if (transactionsSection) {
      transactionsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle label filter change
  const handleLabelFilterChange = (label, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    setLabelFilter(prev => {
      const isAlreadyIncluded = prev.some(item => 
        (item === null && label === null) || item === label
      );

      if (isAlreadyIncluded) {
        return prev.filter(item => 
          !((item === null && label === null) || item === label)
        );
      } else {
        return [...prev, label];
      }
    });
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonth(prev => (prev === 0 ? 11 : prev - 1));
    setCurrentYear(prev => (currentMonth === 0 ? prev - 1 : prev));
    setShowAllTransactions(false); // Reset to month view when navigating
  };

  const handleNextMonth = () => {
    const now = new Date();
    const currentMonthDate = new Date(currentYear, currentMonth);
    const nextMonthDate = new Date(currentYear, currentMonth + 1);
    
    if (nextMonthDate <= now) {
      setCurrentMonth(prev => (prev === 11 ? 0 : prev + 1));
      setCurrentYear(prev => (currentMonth === 11 ? prev + 1 : prev));
      setShowAllTransactions(false); // Reset to month view when navigating
    }
  };

  const isCurrentMonthCurrent = () => {
    const now = new Date();
    const currentMonthDate = new Date(currentYear, currentMonth);
    const nextMonthDate = new Date(currentYear, currentMonth + 1);
    
    return nextMonthDate > now;
  };

  // Function to refresh offset bank feeds
  const refreshOffsetBankFeeds = async () => {
    try {
      setIsRefreshing(true);
      
      const response = await axios.post('http://localhost:5000/refresh-offset-bank-feeds');
      
      if (response.data.success) {
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = 'Offset bank feeds refreshed successfully!';
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
        const transactionsResponse = await axios.get('http://localhost:5000/offset-transactions');
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

        if (labelFilter.length > 0) {
          filtered = filtered.filter(transaction => {
            return labelFilter.includes(transaction.label);
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
        notification.textContent = 'Failed to refresh offset bank feeds: ' + response.data.message;
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
      console.error('Error refreshing offset bank feeds:', error);
      
      const notification = document.createElement('div');
      notification.textContent = 'Error refreshing offset bank feeds. Check console for details.';
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

    if (labelFilter.length > 0) {
      filtered = filtered.filter(transaction => {
        if (labelFilter.includes(null) && !transaction.label) {
          return true;
        }
        return labelFilter.includes(transaction.label);
      });
    }
    
    setAllFilteredTransactions(filtered);
    
    let tableFiltered = filtered;
    // Only apply month filter if there's no date range filter AND showAllTransactions is false
    if (!dateFilter.startDate && !dateFilter.endDate && !showAllTransactions) {
      tableFiltered = filtered.filter(transaction => {
        const date = new Date(transaction.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
    }
    
    setFilteredTransactions(tableFiltered);
  }, [transactions, filters.sortBy, dateFilter, categoryFilter, labelFilter, currentMonth, currentYear, showAllTransactions]);

  const toggleColumnFilter = (column) => {
    setActiveFilterColumn(activeFilterColumn === column ? null : column);
  };
  
  const handleDateFilterChange = (e) => {
    const { name, value } = e.target;
    setDateFilter(prev => ({ ...prev, [name]: value }));
    setShowAllTransactions(false); // Reset to date-filtered view when applying date filters
  };
  
  const clearFilters = () => {
    setDateFilter({ startDate: '', endDate: '' });
    setCategoryFilter([]);
    setLabelFilter([]);
    setActiveFilterColumn(null);
    setShowAllTransactions(false);
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
    await optimizedHandleOffsetUpdate(
      transactionId, 
      field, 
      editValue, 
      transactions, 
      setTransactions, 
      filteredTransactions.length ? setFilteredTransactions : null, 
      setEditCell, 
      setIsUpdating,
      showErrorNotification
    );
  };

  const renderCell = (transaction, field) => {
    if (editCell && editCell.transactionId === transaction.id && editCell.field === field) {
      switch (field) {
        case 'date':
          return (
            <input
              type="date"
              className="modern-input"
              value={editValue || ''}
              onChange={handleInputChange}
              onBlur={() => handleUpdate(transaction.id, field)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUpdate(transaction.id, field);
                }
              }}
              style={{ textAlign: 'center' }}
              autoFocus
            />
          );
        case 'amount':
          return (
            <input
              type="number"
              step="0.01"
              className="modern-input"
              value={editValue || ''}
              onChange={handleInputChange}
              onBlur={() => handleUpdate(transaction.id, field)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUpdate(transaction.id, field);
                }
              }}
              style={{ textAlign: 'center' }}
              autoFocus
            />
          );
        case 'category':
          return (
            <select 
              className="modern-select"
              value={editValue || ''} 
              onChange={handleInputChange} 
              onBlur={() => handleUpdate(transaction.id, field)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUpdate(transaction.id, field);
                }
              }}
              style={{ textAlign: 'center' }}
              autoFocus
            >
              <option value="">Select a category</option>
              {availableCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          );
        case 'label':
          return (
            <select 
              className="modern-select"
              value={editValue || ''} 
              onChange={handleInputChange} 
              onBlur={() => handleUpdate(transaction.id, field)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUpdate(transaction.id, field);
                }
              }}
              style={{ textAlign: 'center' }}
              autoFocus
            >
              <option value="">Select a label</option>
              {labels.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          );
        default:
          return (
            <input
              type="text"
              className="modern-input"
              value={editValue || ''}
              onChange={handleInputChange}
              onBlur={() => handleUpdate(transaction.id, field)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUpdate(transaction.id, field);
                }
              }}
              style={{ width: field === 'description' ? '400px' : '200px', textAlign: 'center' }}
              autoFocus
            />
          );
      }
    }

    // Display cell content
    const isEmpty = 
      transaction[field] === null || 
      transaction[field] === undefined || 
      transaction[field] === '';
    
    return (
      <div 
        className="cell-content editable-cell"
        onDoubleClick={() => handleDoubleClick(transaction.id, field, transaction[field] || '')}
      >
        {isEmpty ? (
          <span className="empty-value"></span>
        ) : field === 'date' ? (
          new Date(transaction[field]).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        ) : field === 'amount' && transaction[field] != null && !isNaN(transaction[field]) ? (
          <span className={transaction[field] < 0 ? 'amount-negative' : 'amount-positive'}>
            {transaction[field] < 0 ? `-$${Math.abs(transaction[field])}` : `$${transaction[field]}`}
          </span>
        ) : (
          transaction[field]
        )}
      </div>
    );
  };

  // Add helper functions for split transactions
  const getRelatedTransactions = (transaction) => {
    // If this is an original transaction that's been split
    if (transaction.has_split) {
      return transactions.filter(t => t.split_from_id === transaction.id);
    }
    // If this is a split transaction
    else if (transaction.split_from_id) {
      const originalTransaction = transactions.find(t => t.id === transaction.split_from_id);
      const allSplits = transactions.filter(t => t.split_from_id === transaction.split_from_id);
      return [originalTransaction, ...allSplits.filter(t => t.id !== transaction.id)];
    }
    return [];
  };

  const renderRelatedTransactionIndicator = (transaction) => {
    const relatedTransactions = getRelatedTransactions(transaction);
    
    if (relatedTransactions.length === 0) return null;
    
    if (transaction.has_split) {
      return (
        <span style={{
          backgroundColor: '#e0f2fe',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#0369a1',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: '1px solid #bae6fd',
          marginLeft: '8px',
          whiteSpace: 'nowrap'
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 17l5-5-5-5M6 17l5-5-5-5"/>
          </svg>
          <span>Split ({relatedTransactions.length})</span>
        </span>
      );
    } else if (transaction.split_from_id) {
      const originalTransaction = relatedTransactions[0];
      return (
        <span style={{
          backgroundColor: '#f0f9ff',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#0284c7',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: '1px dashed #7dd3fc',
          marginLeft: '8px',
          whiteSpace: 'nowrap'
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" transform="rotate(180 12 12)"/>
          </svg>
          <span>Split from</span>
        </span>
      );
    }
    return null;
  };

  // Loading spinner component
  const LoadingSpinner = () => (
    <div className="loading-spinner" />
  );

  // Get row color class based on label
  const getRowLabelClass = (label) => {
    if (label === labels[0]) return 'row-ruby';
    if (label === labels[1]) return 'row-jack';
    if (label === labels[2]) return 'row-both';
    return '';
  };

  // Modern table render function
  const renderTransactionsTable = () => (
    <div className="modern-table-container fade-in">
      {isTransactionsLoading || isLabelsLoading ? (
        <div className="loading-spinner" />
      ) : (
        <table className="modern-table">
          <thead>
            <tr>
              <th>
                <div className="modern-filter-header">
                  <span>Date</span>
                  <FilterButton
                    isActive={activeFilterColumn === 'date'}
                    onClick={() => toggleColumnFilter('date')}
                  />
                </div>
                {activeFilterColumn === 'date' && (
                  <div ref={filterPopupRef} className="filter-dropdown">
                    <div className="filter-group">
                      <label>From:</label>
                      <input 
                        type="date" 
                        name="startDate"
                        className="modern-input"
                        value={dateFilter.startDate}
                        onChange={handleDateFilterChange}
                        min={dateRange.min}
                        max={dateRange.max}
                      />
                    </div>
                    <div className="filter-group">
                      <label>To:</label>
                      <input 
                        type="date" 
                        name="endDate"
                        className="modern-input"
                        value={dateFilter.endDate}
                        onChange={handleDateFilterChange}
                        min={dateRange.min}
                        max={dateRange.max}
                      />
                    </div>
                    <div className="filter-actions">
                      <button 
                        className="btn-secondary"
                        onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                      >
                        Clear
                      </button>
                      <button 
                        className="btn-primary"
                        onClick={() => setActiveFilterColumn(null)}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </th>
              <th>
                <div className="modern-filter-header">
                  <span>Description</span>
                </div>
              </th>
              <th>
                <div className="modern-filter-header">
                  <span>Amount</span>
                </div>
              </th>
              <th>
                <div className="modern-filter-header">
                  <span>Category</span>
                  <FilterButton
                    isActive={activeFilterColumn === 'category'}
                    onClick={() => toggleColumnFilter('category')}
                  />
                </div>
                {activeFilterColumn === 'category' && (
                  <div ref={filterPopupRef} className="filter-dropdown">
                    <div className="filter-options">
                      {availableCategories.map(category => (
                        <label key={category} className="filter-option">
                          <input 
                            type="checkbox"
                            className="modern-checkbox"
                            checked={categoryFilter.includes(category)}
                            onChange={(e) => handleCategoryFilterChange(category, e)}
                          />
                          <span>{category}</span>
                        </label>
                      ))}
                      {transactions.some(t => !t.category) && (
                        <label className="filter-option">
                          <input 
                            type="checkbox"
                            className="modern-checkbox"
                            checked={categoryFilter.includes(null)}
                            onChange={(e) => handleCategoryFilterChange(null, e)}
                          />
                          <span>(Empty/Null)</span>
                        </label>
                      )}
                    </div>
                    <div className="filter-actions">
                      <button 
                        className="btn-secondary"
                        onClick={() => setCategoryFilter([])}
                      >
                        Clear
                      </button>
                      <button 
                        className="btn-primary"
                        onClick={() => setActiveFilterColumn(null)}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </th>
              <th>
                <div className="modern-filter-header">
                  <span>Label</span>
                  <FilterButton
                    isActive={activeFilterColumn === 'label'}
                    onClick={() => toggleColumnFilter('label')}
                  />
                </div>
                {activeFilterColumn === 'label' && (
                  <div ref={filterPopupRef} className="filter-dropdown">
                    <div className="filter-options">
                      {labels.map(label => (
                        <label key={label} className="filter-option">
                          <input 
                            type="checkbox"
                            className="modern-checkbox"
                            checked={labelFilter.includes(label)}
                            onChange={(e) => handleLabelFilterChange(label, e)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="filter-actions">
                      <button 
                        className="btn-secondary"
                        onClick={() => setLabelFilter([])}
                      >
                        Clear
                      </button>
                      <button 
                        className="btn-primary"
                        onClick={() => setActiveFilterColumn(null)}
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
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h3>No transactions found</h3>
                  <p>Try adjusting your filters or add a new transaction</p>
                </td>
              </tr>
            ) : (
              filteredTransactions.map(transaction => (
                <React.Fragment key={transaction.id}>
                  <tr 
                    className={getRowLabelClass(transaction.label)} 
                    style={{ 
                      backgroundColor: expandedRow === transaction.id ? '#f8fafc' : 
                                     transaction.split_from_id ? '#f7fbff' : undefined,
                      transition: 'background-color 0.2s',
                      borderLeft: transaction.split_from_id ? '4px solid #93c5fd' : undefined
                    }}
                  >
                    <td>{renderCell(transaction, 'date')}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', maxWidth: 'calc(100% - 30px)' }}>
                          {transaction.split_from_id && (
                            <span style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              marginRight: '6px',
                              color: '#3b82f6',
                              flexShrink: 0
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M7 17l-5-5 5-5"/>
                              </svg>
                            </span>
                          )}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {renderCell(transaction, 'description')}
                            {renderRelatedTransactionIndicator(transaction)}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRow(expandedRow === transaction.id ? null : transaction.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s',
                            flexShrink: 0
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Click to expand transaction options"
                        >
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2"
                            style={{ 
                              transform: expandedRow === transaction.id ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s',
                              opacity: 0.7
                            }}
                          >
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td>{renderCell(transaction, 'amount')}</td>
                    <td>{renderCell(transaction, 'category')}</td>
                    <td>{renderCell(transaction, 'label')}</td>
                  </tr>
                  {expandedRow === transaction.id && (
                    <tr>
                      <td colSpan="5" style={{ 
                        padding: '0',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ 
                          padding: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}>
                          <div style={{ display: 'flex', gap: '20px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSplitTransaction(transaction);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'background-color 0.2s'
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M8 7v8a2 2 0 002 2h6M16 17l-2-2v4l2-2z"/>
                              </svg>
                              Split Transaction
                            </button>
                          </div>
                          
                          {/* Show related transactions when expanded */}
                          {getRelatedTransactions(transaction).length > 0 && (
                            <div style={{ 
                              marginTop: '12px', 
                              borderTop: '1px dashed #cbd5e1',
                              paddingTop: '12px'
                            }}>
                              <div style={{ 
                                fontSize: '14px', 
                                fontWeight: '500', 
                                marginBottom: '8px',
                                color: '#475569'
                              }}>
                                {transaction.has_split ? 'Split Transactions:' : 'Related Transactions:'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {getRelatedTransactions(transaction).map(related => (
                                  <div key={related.id} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    padding: '8px',
                                    backgroundColor: 'white',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      gap: '12px', 
                                      alignItems: 'center',
                                      fontSize: '13px',
                                      flex: 1,
                                      marginRight: '16px'
                                    }}>
                                      <div>{new Date(related.date).toLocaleDateString()}</div>
                                      <div style={{ fontWeight: '500' }}>{related.description}</div>
                                    </div>
                                    <div style={{ 
                                      fontWeight: '500',
                                      fontSize: '13px',
                                      color: parseFloat(related.amount) < 0 ? '#dc2626' : '#16a34a'
                                    }}>
                                      {parseFloat(related.amount) < 0 ? 
                                        `-$${Math.abs(parseFloat(related.amount)).toFixed(2)}` : 
                                        `$${parseFloat(related.amount).toFixed(2)}`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      )}
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
      category: null,
      label: ''
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
      
      const response = await axios.post('http://localhost:5000/offset-transactions', transactionData);
      
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
          
          if (labelFilter.length > 0) {
            if (!labelFilter.includes(addedTransaction.label)) {
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

  // Drag and Drop handlers
  const handleDragStart = (e, category) => {
    setDraggedCategory(category);
    setIsDragging(true);
    
    // Set drag image and effect
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', category);
    
    // For better UX, we can set a custom drag image
    // This is optional but makes the dragging experience better
    const dragImage = e.target.cloneNode(true);
    dragImage.style.opacity = '0.8';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 20, 20);
    
    // Remove the cloned element after the drag operation
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };
  
  const handleDragOver = (e, category) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (category !== draggedCategory) {
      // Reorder the categories on dragover for a live preview
      const newOrder = [...categoryOrder];
      const fromIndex = newOrder.indexOf(draggedCategory);
      const toIndex = newOrder.indexOf(category);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedCategory);
        setCategoryOrder(newOrder);
      }
    }
  };
  
  const handleDragEnd = () => {
    setDraggedCategory(null);
    setIsDragging(false);
    
    // Persist the new order to localStorage
    localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(categoryOrder));
    
    // Optional: Show a subtle notification that order was saved
    const notification = document.createElement('div');
    notification.textContent = 'Category order saved!';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#d4edda';
    notification.style.color = '#155724';
    notification.style.padding = '8px 16px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    notification.style.zIndex = '1000';
    notification.style.fontSize = '13px';
    notification.style.background = 'linear-gradient(90deg, #d4edda 0%, #d1ecf1 100%)';
    notification.style.border = '1px solid #bee5eb';
    
    document.body.appendChild(notification);
    
    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 1500);
  };
  
  // Add a reset order function
  const resetCategoryOrder = () => {
    if (window.confirm('Are you sure you want to reset the category order to default?')) {
      // Clear saved order
      localStorage.removeItem(CATEGORY_ORDER_KEY);
      
      // Reset to alphabetical order or original order
      const categoryData = transactions.reduce((acc, transaction) => {
        const category = transaction.category || 'Uncategorized';
        if (!acc[category]) acc[category] = true;
        return acc;
      }, {});
      
      const defaultOrder = Object.keys(categoryData).sort();
      setCategoryOrder(defaultOrder);
      
      // Show notification
      const notification = document.createElement('div');
      notification.textContent = 'Category order reset to default!';
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#fff3cd';
      notification.style.color = '#856404';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      notification.style.zIndex = '1000';
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    }
  };

  // Split Transaction Handlers
  const handleSplitTransaction = (transaction) => {
    setTransactionToSplit(transaction);
    setSplitTransactions([{
      description: '',
      amount: '',
      category: '',
      label: ''
    }]);
    setIsSplitting(true);
  };

  const handleSplitChange = (index, field, value) => {
    setSplitTransactions(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const addSplitTransaction = () => {
    setSplitTransactions(prev => [...prev, {
      description: '',
      amount: '',
      category: '',
      label: ''
    }]);
  };

  const removeSplitTransaction = (index) => {
    if (splitTransactions.length > 1) {
      setSplitTransactions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const calculateRemainingAmount = () => {
    if (!transactionToSplit) return 0;
    
    const originalAmount = parseFloat(transactionToSplit.amount) || 0;
    const splitTotal = splitTransactions.reduce((sum, split) => {
      return sum + (parseFloat(split.amount) || 0);
    }, 0);
    
    return originalAmount - splitTotal;
  };

  const handleSaveSplit = async () => {
    // Validate split transactions
    const hasEmptyFields = splitTransactions.some(split => 
      !split.description || !split.amount || !split.category || split.amount === ''
    );
    
    if (hasEmptyFields) {
      showErrorNotification('Please fill out all fields for each split transaction');
      return;
    }
    
    const totalSplitAmount = splitTransactions.reduce((sum, split) => 
      sum + parseFloat(split.amount || 0), 0
    );
    
    const originalAmount = parseFloat(transactionToSplit.amount) || 0;
    
    // For negative transactions (expenses), ensure splits are also negative
    if (originalAmount < 0) {
      const hasPositiveSplit = splitTransactions.some(split => parseFloat(split.amount) > 0);
      if (hasPositiveSplit) {
        showErrorNotification('For expense transactions, all split amounts must be negative');
        return;
      }
    }
    
    // For positive transactions (income), ensure splits are also positive
    if (originalAmount > 0) {
      const hasNegativeSplit = splitTransactions.some(split => parseFloat(split.amount) < 0);
      if (hasNegativeSplit) {
        showErrorNotification('For income transactions, all split amounts must be positive');
        return;
      }
    }
    
    // Check if the total split amount exceeds the original (considering sign)
    if (originalAmount < 0) {
      // For expenses: total splits should not be less than original (more negative)
      if (totalSplitAmount < originalAmount) {
        showErrorNotification('Split amounts exceed the original transaction amount');
        return;
      }
    } else {
      // For income: total splits should not exceed original
      if (totalSplitAmount > originalAmount) {
        showErrorNotification('Split amounts exceed the original transaction amount');
        return;
      }
    }
    
    try {
      setIsSavingSplit(true);
      
      // Prepare the data for the API
      const splitData = {
        originalTransactionId: transactionToSplit.id,
        remainingAmount: calculateRemainingAmount(),
        splitTransactions: splitTransactions.map(split => ({
          date: transactionToSplit.date, // Use the same date as original
          description: split.description,
          amount: parseFloat(split.amount),
          category: split.category,
          label: split.label
        }))
      };
      
      const response = await axios.post('http://localhost:5000/offset-transactions/split', splitData);
      
      if (response.data.success) {
        // Refresh the transactions
        const transactionsResponse = await axios.get('http://localhost:5000/offset-transactions');
        setTransactions(transactionsResponse.data);
        
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = 'Transaction split successfully!';
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
        
        // Close the modal
        setIsSplitting(false);
        setTransactionToSplit(null);
        setSplitTransactions([{
          description: '',
          amount: '',
          category: '',
          label: ''
        }]);
      } else {
        showErrorNotification(response.data.error || 'Failed to split transaction');
      }
    } catch (error) {
      console.error('Error splitting transaction:', error);
      showErrorNotification('Failed to split transaction. Please try again.');
    } finally {
      setIsSavingSplit(false);
    }
  };

  const cancelSplit = () => {
    setIsSplitting(false);
    setTransactionToSplit(null);
    setSplitTransactions([{
      description: '',
      amount: '',
      category: '',
      label: ''
    }]);
  };

  // Function to save settings to localStorage
  const saveSettings = (newSettings) => {
    const settings = {
      hideZeroBalanceBuckets: newSettings.hideZeroBalanceBuckets,
      selectedNegativeOffsetBucket: newSettings.selectedNegativeOffsetBucket
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  };

  // Handle settings change
  const handleHideZeroBalanceBucketsChange = (checked) => {
    setHideZeroBalanceBuckets(checked);
    saveSettings({ 
      hideZeroBalanceBuckets: checked, 
      selectedNegativeOffsetBucket: selectedNegativeOffsetBucket 
    });
  };

  // Handle negative offset bucket selection change
  const handleNegativeOffsetBucketChange = (bucketName) => {
    setSelectedNegativeOffsetBucket(bucketName);
    saveSettings({ 
      hideZeroBalanceBuckets: hideZeroBalanceBuckets, 
      selectedNegativeOffsetBucket: bucketName 
    });
  };
  
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
      {(dateFilter.startDate || dateFilter.endDate || categoryFilter.length > 0 || labelFilter.length > 0) && (
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
                  {categoryFilter.length === 1 ? 'Category' : 'Categories'}: {categoryFilter.map(cat => cat === null ? 'null' : cat).join(', ')}
                </span>
              )}
              {labelFilter.length > 0 && (
                <span style={{ margin: '0 10px' }}>
                  {labelFilter.length === 1 ? 'Label' : 'Labels'}: {labelFilter.map(label => label === null ? 'null' : label).join(', ')}
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

      {/* Category Savings Summary */}
      <div style={{ 
        marginBottom: '60px', 
        background: 'transparent',
        padding: '24px', // Reduced from 32px
        position: 'relative',
      }}>
        {isTransactionsLoading ? (
          <LoadingSpinner />
        ) : (
          <div>
            <div style={{ 
              marginBottom: '20px', // Reduced from 28px
              textAlign: 'center',
              position: 'relative',
            }}>
              <h2 className="section-title">Savings Buckets</h2>
              
              {/* Replace inline help text with HelpText component */}
              <div style={{ marginBottom: '6px', marginRight: '140px' }}>
                <HelpText isVisible={helpTextVisible}>
                  Drag category cards to reorder them. Your arrangement will be saved automatically. 
                </HelpText>
              </div>

              <div style={{ marginBottom: '6px', marginRight: '140px' }}>
                <HelpText isVisible={helpTextVisible}>
                  Double-click on any category to show all transactions for that category across all months.
                </HelpText>
              </div>

              <div style={{ marginBottom: '6px', marginRight: '140px' }}>
                <HelpText isVisible={helpTextVisible}>
                  When buckets go negative, they're excluded from Categories Sum calculation and their negative amounts are deducted from your selected offset bucket.
                </HelpText>
              </div>
              
              {/* Settings and Reset Button Container */}
              <div style={{
                position: 'absolute',
                right: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                {/* Settings Button */}
                <button
                  onClick={() => setShowSettings(true)}
                  style={{
                    fontSize: '13px',
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.color = '#475569';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }}
                  title="Settings"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                  </svg>
                  Settings
                </button>
                
                {/* Modern Reset Button */}
                <button
                  onClick={resetCategoryOrder}
                  style={{
                    fontSize: '13px',
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.color = '#475569';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }}
                  title="Reset to default order"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Reset Order
                </button>
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', // Reduced from 240px
              gap: '16px', // Reduced from 24px
              marginBottom: '30px' // Reduced from 40px
            }}>
              {(() => {
                try {
                  // Calculate raw category totals first
                  const rawCategoryData = transactions.reduce((acc, transaction) => {
                    const category = transaction.category || 'Uncategorized';
                    const amount = typeof transaction.amount === 'number' ? 
                      transaction.amount : parseFloat(transaction.amount) || 0;
                    
                    if (!acc[category]) {
                      acc[category] = {
                        total: 0,
                        count: 0
                      };
                    }
                    acc[category].total += amount;
                    acc[category].count += 1;
                    
                    return acc;
                  }, {});

                  // New offsetting logic - keep negatives but adjust offset bucket
                  const categoryData = { ...rawCategoryData };
                  
                  if (selectedNegativeOffsetBucket && categoryData[selectedNegativeOffsetBucket]) {
                    // Find all negative buckets (excluding the offset bucket itself)
                    const negativeBuckets = Object.entries(rawCategoryData).filter(([category, data]) => {
                      const numTotal = typeof data.total === 'number' ? data.total : parseFloat(data.total) || 0;
                      return numTotal < 0 && category !== selectedNegativeOffsetBucket;
                    });

                    // Calculate total negative amount
                    const totalNegativeAmount = negativeBuckets.reduce((sum, [_, data]) => {
                      const numTotal = typeof data.total === 'number' ? data.total : parseFloat(data.total) || 0;
                      return sum + numTotal; // This will be negative
                    }, 0);

                    // Deduct the negative amounts from the selected bucket (subtract the negative = add positive, but we want to subtract)
                    if (totalNegativeAmount < 0) {
                      categoryData[selectedNegativeOffsetBucket] = {
                        ...categoryData[selectedNegativeOffsetBucket],
                        total: categoryData[selectedNegativeOffsetBucket].total + totalNegativeAmount // Adding negative = subtracting
                      };
                    }
                  }

                  // Calculate grand total excluding negative buckets from calculation
                  const grandTotal = Object.entries(categoryData)
                    .filter(([category, data]) => {
                      // Exclude negative buckets that are not the offset bucket
                      const numTotal = typeof data.total === 'number' ? data.total : parseFloat(data.total) || 0;
                      const isNegative = numTotal < 0;
                      const isOffsetBucket = category === selectedNegativeOffsetBucket;
                      
                      // Include the bucket if it's not negative OR if it's the offset bucket
                      return !isNegative || isOffsetBucket;
                    })
                    .reduce((sum, [category, data]) => {
                      const numTotal = typeof data.total === 'number' ? 
                        data.total : parseFloat(data.total) || 0;
                      return sum + numTotal;
                    }, 0);

                  // Get latest closing balance with type safety
                  const latestTransaction = transactions.length > 0 
                    ? transactions.reduce((latest, transaction) => {
                        return (latest.id > transaction.id) ? latest : transaction;
                      }, transactions[0])
                    : null;
                  
                  const latestClosingBalance = latestTransaction 
                    ? (typeof latestTransaction.closing_balance === 'number' ?
                      latestTransaction.closing_balance : 
                      parseFloat(latestTransaction.closing_balance) || 0) 
                    : 0;

                  // Format number with commas
                  const formatNumber = (number) => {
                    try {
                      return number.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      });
                    } catch (error) {
                      // Fallback for non-numeric values
                      console.error("Error formatting number:", error);
                      return "0.00";
                    }
                  };

                  // Generate consistent colors for categories
                  const getCategoryColor = (category, index) => {
                    const colors = [
                      { bg: '#3b82f6', light: '#dbeafe' },
                      { bg: '#10b981', light: '#d1fae5' },
                      { bg: '#8b5cf6', light: '#ede9fe' },
                      { bg: '#f59e0b', light: '#fef3c7' },
                      { bg: '#ef4444', light: '#fee2e2' },
                      { bg: '#ec4899', light: '#fce7f3' },
                      { bg: '#14b8a6', light: '#ccfbf1' },
                      { bg: '#6366f1', light: '#e0e7ff' },
                    ];
                    return colors[index % colors.length];
                  };

                  // Sort the categories based on categoryOrder state
                  const sortedCategories = [...Object.keys(categoryData)].sort((a, b) => {
                    const indexA = categoryOrder.indexOf(a);
                    const indexB = categoryOrder.indexOf(b);
                    
                    // If a category is not in the order array, place it at the end
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    
                    return indexA - indexB;
                  });

                  // Filter out zero balance categories if setting is enabled
                  const displayCategories = hideZeroBalanceBuckets 
                    ? sortedCategories.filter(category => {
                        const data = categoryData[category];
                        const numTotal = typeof data.total === 'number' ? 
                          data.total : parseFloat(data.total) || 0;
                        return Math.abs(numTotal) >= 0.01; // Consider anything less than 1 cent as zero
                      })
                    : sortedCategories;

                  // Check if reconciled
                  const isReconciled = Math.abs(grandTotal - latestClosingBalance) < 0.01;

                  return (
                    <>
                      {/* Display each category's total */}
                      {displayCategories.map((category, index) => {
                        const data = categoryData[category];
                        const rawData = rawCategoryData[category];
                        const numTotal = typeof data.total === 'number' ? 
                          data.total : parseFloat(data.total) || 0;
                        const rawTotal = typeof rawData?.total === 'number' ? 
                          rawData.total : parseFloat(rawData?.total) || 0;
                        
                        // Calculate percentage based on categories that are included in sum
                        const totalForPercentage = Object.entries(categoryData)
                          .filter(([cat, catData]) => {
                            const catTotal = typeof catData.total === 'number' ? catData.total : parseFloat(catData.total) || 0;
                            const isNegative = catTotal < 0;
                            const isOffsetBucket = cat === selectedNegativeOffsetBucket;
                            return !isNegative || isOffsetBucket;
                          })
                          .reduce((sum, [cat, catData]) => {
                            const catTotal = typeof catData.total === 'number' ? catData.total : parseFloat(catData.total) || 0;
                            return sum + catTotal;
                          }, 0);

                        // Check if this bucket is included in the sum calculation
                        const isIncludedInSum = numTotal >= 0 || category === selectedNegativeOffsetBucket;
                        const percentage = isIncludedInSum && totalForPercentage !== 0 ? 
                          (numTotal / totalForPercentage) * 100 : 0;
                        
                        const color = getCategoryColor(category, index);
                        
                        // Check if this category has been affected by offsetting
                        const isOffsetBucket = category === selectedNegativeOffsetBucket && selectedNegativeOffsetBucket && rawTotal !== numTotal;
                        const isExcludedNegative = rawTotal < 0 && category !== selectedNegativeOffsetBucket && selectedNegativeOffsetBucket;
                          
                        return (
                          <div 
                            key={category}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, category)}
                            onDragOver={(e) => handleDragOver(e, category)}
                            onDragEnd={handleDragEnd}
                            onDoubleClick={() => handleCategoryDoubleClick(category)}
                            style={{  
                              backgroundColor: 'white',
                              padding: '16px',
                              borderRadius: '12px',
                              border: draggedCategory === category 
                                ? `2px dashed ${color.bg}` 
                                : '1px solid rgba(0,0,0,0.06)',
                              boxShadow: draggedCategory === category
                                ? '0 15px 35px rgba(0,0,0,0.08)'
                                : '0 4px 24px rgba(0,0,0,0.02)',
                              opacity: isDragging && draggedCategory !== category ? 0.5 : 1,
                              cursor: 'move',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              transform: draggedCategory === category 
                                ? 'scale(1.02) rotate(1deg)' 
                                : 'scale(1)',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Background accent */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '4px',
                              background: `linear-gradient(90deg, ${color.bg}, ${color.bg}dd)`,
                              borderRadius: '12px 12px 0 0',
                            }}/>
                            
                            {/* UPDATED: "Was:" tag on the left */}
                            {isOffsetBucket && (
                              <div style={{
                                position: 'absolute',
                                top: '8px',
                                left: '8px',
                                fontSize: '9px', 
                                color: '#64748b', 
                                backgroundColor: '#f1f5f9',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                border: '1px solid #e2e8f0',
                                fontStyle: 'italic',
                                zIndex: 1
                              }}>
                                Was: {rawTotal >= 0 ? `$${formatNumber(rawTotal)}` : `-$${formatNumber(Math.abs(rawTotal))}`}
                              </div>
                            )}
                            
                            {/* UPDATED: Right-side indicators without "Was:" tag */}
                            {(isOffsetBucket || isExcludedNegative) && (
                              <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                padding: '2px 6px',
                                backgroundColor: isOffsetBucket ? '#f0f9ff' : '#fef3c7',
                                color: isOffsetBucket ? '#0369a1' : '#d97706',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '600',
                                border: `1px solid ${isOffsetBucket ? '#93c5fd' : '#fcd34d'}`,
                                zIndex: 1
                              }}>
                                {isOffsetBucket ? 'Offset Bucket' : 'Excluded'}
                              </div>
                            )}
                            
                            {/* UPDATED: Category name without left margin */}
                            <div style={{ 
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#475569',
                              marginBottom: '8px',
                              marginTop: '12px'  // Removed marginLeft
                            }}>
                              {category}
                            </div>
                            
                            {/* UPDATED: Amount without left margin */}
                            <div style={{ 
                              fontSize: '26px',
                              fontWeight: '700',
                              color: numTotal >= 0 ? '#059669' : '#dc2626',
                              lineHeight: '1',
                              marginBottom: '12px'  // Removed marginLeft
                            }}>
                              {numTotal >= 0 
                                ? `$${formatNumber(numTotal)}` 
                                : `-$${formatNumber(Math.abs(numTotal))}`}
                            </div>
                            
                            {/* UPDATED: Bottom section without left margin */}
                            <div style={{ 
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              color: '#64748b'  // Removed marginLeft
                            }}>
                              <span style={{ fontWeight: '500' }}>
                                {isIncludedInSum 
                                  ? `${percentage.toFixed(1)}% of total`
                                  : 'Excluded from total'
                                }
                              </span>
                              <span>
                                {data.count} item{data.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                } catch (error) {
                  console.error("Error rendering category data:", error);
                  return (
                    <div style={{ 
                      padding: '24px', // Reduced from 32px
                      textAlign: 'center', 
                      color: '#dc2626',
                      backgroundColor: '#fef2f2',
                      borderRadius: '12px',
                      border: '1px solid #fecaca'
                    }}>
                      <p style={{ margin: 0, fontWeight: '500' }}>
                        Unable to display category data. Please try refreshing the page.
                      </p>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Modern Balance Summary Section - Reduced sizing */}
            <div style={{
              marginTop: '20px', // Reduced from 24px
              padding: '16px', // Reduced from 20px
              background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: '10px', // Reduced from 12px
              border: '1px solid rgba(0,0,0,0.06)',
              maxWidth: '560px', // Reduced from 600px
              margin: '20px auto', // Reduced from 24px
              boxShadow: '0 6px 28px rgba(0,0,0,0.05)', // Reduced shadow
            }}>
              {(() => {
                try {
                  // Calculate category total with new offsetting approach
                  const rawCategoryTotals = transactions.reduce((acc, transaction) => {
                    const category = transaction.category || 'Uncategorized';
                    const amount = typeof transaction.amount === 'number' ? 
                      transaction.amount : parseFloat(transaction.amount) || 0;
                    
                    if (!acc[category]) {
                      acc[category] = 0;
                    }
                    acc[category] += amount;
                    
                    return acc;
                  }, {});

                  // Apply the new offsetting logic for balance summary
                  let adjustedTotals = { ...rawCategoryTotals };
                  
                  if (selectedNegativeOffsetBucket && adjustedTotals[selectedNegativeOffsetBucket] !== undefined) {
                    // Find negative buckets and sum them
                    const negativeBuckets = Object.entries(rawCategoryTotals).filter(([category, total]) => {
                      return total < 0 && category !== selectedNegativeOffsetBucket;
                    });

                    const totalNegativeAmount = negativeBuckets.reduce((sum, [_, total]) => sum + total, 0);
                    
                    // Deduct negative amounts from offset bucket
                    if (totalNegativeAmount < 0) {
                      adjustedTotals[selectedNegativeOffsetBucket] = adjustedTotals[selectedNegativeOffsetBucket] + totalNegativeAmount;
                    }
                  }

                  // Calculate total excluding negative buckets (except offset bucket)
                  const categoryTotal = Object.entries(adjustedTotals).reduce((sum, [category, total]) => {
                    const numAmount = typeof total === 'number' ? total : parseFloat(total) || 0;
                    
                    // Include bucket if it's not negative OR if it's the offset bucket
                    const isNegative = numAmount < 0;
                    const isOffsetBucket = category === selectedNegativeOffsetBucket;
                    
                    if (!isNegative || isOffsetBucket) {
                      return sum + numAmount;
                    }
                    return sum;
                  }, 0);
                
                  // Get latest closing balance with type safety - FIXING THE BUG
                  const latestTransaction = transactions.length > 0 
                    ? transactions.reduce((latest, transaction) => {
                        return (latest.id > transaction.id) ? latest : transaction;
                      }, transactions[0])
                    : null;
                
                  const latestClosingBalance = latestTransaction 
                    ? (typeof latestTransaction.closing_balance === 'number' ?
                      latestTransaction.closing_balance : 
                      parseFloat(latestTransaction.closing_balance) || 0) 
                    : 0;
                
                  // Format number with commas
                  const formatNumber = (number) => {
                    try {
                      return number.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      });
                    } catch (error) {
                      console.error("Error formatting number:", error);
                      return "0.00";
                    }
                  };
                
                  // Check if reconciled
                  const isReconciled = Math.abs(categoryTotal - latestClosingBalance) < 0.01;
                  const difference = categoryTotal - latestClosingBalance;
                  const hasDifference = Math.abs(difference) >= 0.01;
                  
                  return (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '20px', // Further reduced for more compact layout
                      }}>
                        {/* Balance information - Compact layout */}
                        <div style={{
                          display: 'flex',
                          gap: '20px', // Further reduced
                          alignItems: 'center',
                        }}>
                          <div style={{ 
                            textAlign: 'center',
                            padding: '10px 16px', // Further reduced
                            backgroundColor: '#f0fdf4',
                            borderRadius: '8px', 
                            border: '1px solid #bbf7d0',
                          }}>
                            <div style={{ 
                              fontSize: '11px',
                              color: '#059669',
                              marginBottom: '4px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              Current Balance
                            </div>
                            <div style={{ 
                              fontSize: '20px',
                              fontWeight: '700',
                              color: '#047857',
                            }}>
                              ${formatNumber(latestClosingBalance)}
                            </div>
                          </div>
                          
                          <div style={{
                            width: '2px',
                            height: '40px', // Further reduced
                            background: 'linear-gradient(180deg, transparent, #e5e7eb, transparent)',
                          }}/>
                          
                          <div style={{ 
                            textAlign: 'center',
                            padding: '10px 16px', // Further reduced
                            backgroundColor: '#f0f9ff',
                            borderRadius: '8px',
                            border: '1px solid #bae6fd',
                            position: 'relative', // Added for tooltip positioning
                          }}>
                            <div style={{ 
                              fontSize: '11px',
                              color: '#0369a1',
                              marginBottom: '4px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              Categories Sum
                            </div>
                            <div style={{ 
                              fontSize: '20px',
                              fontWeight: '700',
                              color: '#0c4a6e',
                            }}>
                              ${formatNumber(categoryTotal)}
                            </div>
                            {/* Show diff as a badge if not reconciled */}
                            {hasDifference && (
                              <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                backgroundColor: difference > 0 ? '#fecaca' : '#fee2e2',
                                padding: '2px 6px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#b91c1c',
                                border: '1px solid #fca5a5',
                                whiteSpace: 'nowrap',
                              }} title={`Difference: ${difference > 0 ? '+' : ''}${formatNumber(difference)}`}>
                                {difference > 0 ? '+$' : '-$'}{formatNumber(Math.abs(difference))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Compact Reconciliation Status */}
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: isReconciled 
                            ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                            : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: isReconciled ? '#15803d' : '#b45309',
                          border: `1px solid ${isReconciled ? '#86efac' : '#fcd34d'}`,
                          boxShadow: isReconciled 
                            ? '0 2px 4px rgba(34, 197, 94, 0.2)'
                            : '0 2px 4px rgba(245, 158, 11, 0.2)',
                          whiteSpace: 'nowrap',
                        }}>
                          {isReconciled ? (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Reconciled
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 9v4M12 17h.01M5.07 19a10 10 0 1 1 13.86 0" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Not Reconciled
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  );
                } catch (error) {
                  console.error("Error rendering balance summary:", error);
                  return (
                    <div style={{ 
                      padding: '24px', 
                      textAlign: 'center', 
                      color: '#dc2626',
                      backgroundColor: '#fef2f2',
                      borderRadius: '12px',
                      border: '1px solid #fecaca'
                    }}>
                      <p style={{ margin: 0, fontWeight: '500' }}>
                        Unable to display balance summary. Please try refreshing the page.
                      </p>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        )}
      </div>

      <h2 className="section-title">
        Offset Transactions
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
        marginBottom: '8px',
        padding: '5px',
        backgroundColor: 'transparent',
        borderRadius: '8px',
        flexDirection: 'column'
      }}>
        <div style={{ 
          display: 'flex', 
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '5px'
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
              onClick={refreshOffsetBankFeeds}
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
              {isRefreshing ? 'Refreshing...' : 'Refresh Bank Feeds'}
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
        
        <HelpText isVisible={helpTextVisible}>
          Use the month navigation to browse your personal transaction history. Only transactions from the selected month are shown unless a date filter is active.
        </HelpText>
      </div>
      
      {/* Settings Modal */}
      {showSettings && (
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
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            width: '500px',
            maxWidth: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '16px'
            }}>
              <h2 style={{ 
                margin: 0, 
                color: '#1f2937',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  color: '#6b7280',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                color: '#374151',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Display Options
              </h3>
              
              <div style={{
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                marginBottom: '16px'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  gap: '12px'
                }}>
                  <input 
                    type="checkbox" 
                    checked={hideZeroBalanceBuckets}
                    onChange={(e) => handleHideZeroBalanceBucketsChange(e.target.checked)}
                    style={{ 
                      marginTop: '2px',
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <div>
                    <div style={{ 
                      fontSize: '14px',
                      color: '#374151',
                      fontWeight: '500',
                      marginBottom: '4px'
                    }}>
                      Hide buckets with zero balance
                    </div>
                    <div style={{ 
                      fontSize: '13px',
                      color: '#6b7280',
                      lineHeight: '1.4'
                    }}>
                      When enabled, savings buckets with a balance of zero (or less than 1 cent) will be hidden from the display.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            {/* Negative Bucket Offsetting Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                color: '#374151',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Negative Bucket Offsetting
              </h3>
              
              <div style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
                marginBottom: '12px'
              }}>
                <div style={{ 
                  fontSize: '14px',
                  color: '#0369a1',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Selected Offset Bucket
                </div>
                <div style={{ 
                  fontSize: '13px',
                  color: '#0284c7',
                  lineHeight: '1.4',
                  marginBottom: '12px'
                }}>
                  When buckets go negative, they remain visible but are excluded from the Categories Sum calculation. Their negative amounts are deducted from your selected offset bucket to keep totals balanced.
                </div>
                
                <select
                  value={selectedNegativeOffsetBucket}
                  onChange={(e) => handleNegativeOffsetBucketChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="">No offset bucket selected</option>
                  {availableCategories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                
                {selectedNegativeOffsetBucket && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#dcfce7',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#15803d'
                  }}>
                    ✓ Negative amounts will be deducted from <strong>{selectedNegativeOffsetBucket}</strong>
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = '#4338ca';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = '#4f46e5';
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
            <h2 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Add Transaction</h2>
            
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
      
      {/* Split Transaction Modal */}
      {isSplitting && transactionToSplit && (
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
            width: '600px',
            maxWidth: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              Split Transaction
            </h2>
            
            {/* Original Transaction Info */}
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: '#f7f7f7', 
              borderRadius: '6px' 
            }}>
              <h3 style={{ marginTop: 0 }}>Original Transaction</h3>
              <div><strong>Date:</strong> {new Date(transactionToSplit.date).toLocaleDateString()}</div>
              <div><strong>Description:</strong> {transactionToSplit.description}</div>
              <div><strong>Amount:</strong> {transactionToSplit.amount < 0 ? `-$${Math.abs(transactionToSplit.amount)}` : `$${transactionToSplit.amount}`}</div>
              <div><strong>Category:</strong> {transactionToSplit.category || 'None'}</div>
            </div>
            
            {/* Split Transactions */}
            <h3>Split Transactions</h3>
            {splitTransactions.map((split, index) => (
              <div key={index} style={{ 
                marginBottom: '15px', 
                padding: '15px', 
                border: '1px solid #e0e0e0', 
                borderRadius: '6px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0 }}>Split #{index + 1}</h4>
                  {splitTransactions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSplitTransaction(index)}
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                    Description *
                  </label>
                  <input
                    type="text"
                    value={split.description}
                    onChange={(e) => handleSplitChange(index, 'description', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                    Amount * {transactionToSplit.amount < 0 ? '(negative for expenses)' : '(positive for income)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={split.amount}
                    onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder={transactionToSplit.amount < 0 ? 'e.g., -25.00' : 'e.g., 25.00'}
                    required
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                    Category *
                  </label>
                  <select
                    value={split.category}
                    onChange={(e) => handleSplitChange(index, 'category', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      boxSizing: 'border-box'
                    }}
                    required
                  >
                    <option value="">Select a category</option>
                    {availableCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addSplitTransaction}
              style={{
                marginBottom: '20px',
                padding: '10px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Add Another Split
            </button>
            
            {/* Remaining Amount Display */}
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: calculateRemainingAmount() === 0 ? '#e8f5e9' : '#fff3cd', 
              borderRadius: '6px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Original Amount:</strong>
                <span style={{ 
                  color: transactionToSplit.amount < 0 ? '#dc2626' : '#059669' 
                }}>
                  {transactionToSplit.amount < 0 
                    ? `-$${Math.abs(transactionToSplit.amount || 0).toFixed(2)}` 
                    : `$${Math.abs(transactionToSplit.amount || 0).toFixed(2)}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Total Split Amount:</strong>
                <span style={{ 
                  color: splitTransactions.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0) < 0 ? '#dc2626' : '#059669' 
                }}>
                  {(() => {
                    const total = splitTransactions.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0);
                    return total < 0 ? `-$${Math.abs(total).toFixed(2)}` : `$${total.toFixed(2)}`;
                  })()}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginTop: '10px', 
                paddingTop: '10px', 
                borderTop: '1px solid #ddd' 
              }}>
                <strong>Remaining Amount:</strong>
                <span style={{ 
                  color: calculateRemainingAmount() === 0 
                    ? '#059669' 
                    : calculateRemainingAmount() < 0 
                      ? '#dc2626' 
                      : '#f59e0b',
                  fontWeight: 'bold'
                }}>
                  {(() => {
                    const remaining = calculateRemainingAmount();
                    return remaining < 0 ? `-$${Math.abs(remaining).toFixed(2)}` : `$${remaining.toFixed(2)}`;
                  })()}
                </span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={cancelSplit}
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
                type="button"
                onClick={handleSaveSplit}
                disabled={isSavingSplit}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSavingSplit ? 'not-allowed' : 'pointer',
                  opacity: isSavingSplit ? 0.7 : 1
                }}
              >
                {isSavingSplit ? 'Saving...' : 'Save Split'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Transactions table with modern styling */}
      {renderTransactionsTable()}
    </div>
  );
};

export default OffsetTransactions;