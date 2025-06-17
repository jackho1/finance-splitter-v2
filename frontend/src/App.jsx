import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import Budgets from './Budgets';
import PersonalTransactions from './PersonalTransactions';
import OffsetTransactions from './OffsetTransactions';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Import utility functions
import { calculateTotals } from './utils/calculateTotals';
import { applyFilters } from './utils/filterTransactions';
import { groupSplitTransactions } from './utils/transactionGrouping';
import { 
  optimizedHandleUpdate, 
  normalizeValue, 
  valuesAreEqual, 
  getFieldType 
} from './utils/updateHandlers';
import './ModernTables.css';
import './SortableTableHeaders.css';

// Add CSS styles for buttons and help text
const buttonStyles = `
  .modern-button {
    background-color: #ffffff;
    color: #2c3e50;
    border: 1px solid #e0e0e0;
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0,0,0,0.08);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    outline: none;
  }

  .modern-button:hover {
    background-color: #f8f9fa;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }

  .modern-button:active {
    background-color: #e9ecef;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transform: translateY(0);
  }

  .modern-button.navigation {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
  }

  .modern-button.navigation.prev {
    padding-left: 2px;
  }

  .modern-button.navigation.next {
    padding-right: 2px;
  }

  .modern-button.navigation svg {
    margin: 0 5px;
  }

  .month-navigation {
    display: flex;
    margin-bottom: 15px;
    align-items: center;
  }

  .month-display {
    font-family: 'Inter', sans-serif;
    font-size: 16px;
    font-weight: 500;
    padding: 0 8px;
    color: #2c3e50;
  }

  .help-text {
    display: flex;
    align-items: flex-start;
    background-color: #f8f9fa;
    padding: 10px 12px;
    border-radius: 6px;
    border-left: 3px solid #4a90e2;
    margin-bottom: 12px;
    font-size: 12px;
    color: #505050;
    line-height: 1.4;
    font-family: 'Inter', sans-serif;
  }
  
  .help-text-icon {
    color: #4a90e2;
    margin-right: 10px;
    flex-shrink: 0;
  }
  
  .help-text-content {
    flex: 1;
    margin: 0;
    padding: 0;
  }
`;

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Help Text Component for consistent styling
const HelpText = ({ children, isVisible }) => {
  if (!isVisible) return null;
  
  return (
    <div className="help-text">
      <div className="help-text-icon" style={{ lineHeight: 0, marginBottom: 0 }}>
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

// Sortable header component
const SortableHeader = ({ column, sortBy, onSort, children, hasFilter = false, onFilterToggle, isFilterActive }) => {
  const isActive = sortBy.startsWith(column);
  const isDesc = sortBy === `${column}-desc`;
  
  return (
    <div className={`modern-filter-header ${hasFilter ? 'sortable' : ''}`}>
      <div className="sortable-column-content" onClick={() => onSort(column)}>
        <span className="sortable-header">
          {children}
          <span className={`sort-indicator ${isActive ? 'active' : ''}`}>
            <span className={`sort-arrow up ${isActive && !isDesc ? 'active' : ''}`}></span>
            <span className={`sort-arrow down ${isActive && isDesc ? 'active' : ''}`}></span>
          </span>
        </span>
      </div>
      {hasFilter && (
        <FilterButton
          isActive={isFilterActive}
          onClick={onFilterToggle}
        />
      )}
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [allFilteredTransactions, setAllFilteredTransactions] = useState([]);
  const [filters, setFilters] = useState({ sortBy: 'date-desc' });
  const [totals, setTotals] = useState({});
  const [labels, setLabels] = useState([]);
  const [editCell, setEditCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  // Add loading state variables
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [isLabelsLoading, setIsLabelsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  // Add category mapping state
  const [categoryMappings, setCategoryMappings] = useState({});
  const [isCategoryMappingsLoading, setIsCategoryMappingsLoading] = useState(false);
  // Add state for available categories
  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState([]);
  // Add label filter for chart
  const [chartLabelFilter, setChartLabelFilter] = useState('All');
  // Add state for transaction month filtering
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Column filtering states
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [bankCategoryFilter, setBankCategoryFilter] = useState([]);
  const [labelFilter, setLabelFilter] = useState([]);
  const [availableBankCategories, setAvailableBankCategories] = useState([]);
  const filterPopupRef = useRef(null);
  
  // Add new transaction state
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    bank_category: '',
    label: labels[0] || ''
  });
  
  // Add help text visibility state
  const [helpTextVisible, setHelpTextVisible] = useState(false);

  // Add refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add screen grab state
  const [isScreenGrabOpen, setIsScreenGrabOpen] = useState(false);
  const screenGrabRef = useRef(null);
  
  // Add split transaction states
  const [isSplitting, setIsSplitting] = useState(false);
  const [transactionToSplit, setTransactionToSplit] = useState(null);
  const [splitTransactions, setSplitTransactions] = useState([{
    description: '',
    amount: '',
    bank_category: '',
    label: ''
  }]);
  const [isSavingSplit, setIsSavingSplit] = useState(false);
  
  // Add expanded row state
  const [expandedRow, setExpandedRow] = useState(null);

  // Function to generate a random color
  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };
  
  // Combined useEffect to fetch all initial data sequentially to avoid overwhelming database connections
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsTransactionsLoading(true);
      setIsLabelsLoading(true);
      setIsCategoryMappingsLoading(true);
      
      try {
        console.log('Fetching initial data using optimized endpoint...');
        
        // Single API call to get all initial data
        const response = await axios.get('http://localhost:5000/initial-data');
        
        if (response.data.success) {
          const { transactions, categoryMappings, labels, bankCategories } = response.data.data;
          
          // Set all data from the combined response
          setCategoryMappings(categoryMappings);
          setTransactions(transactions || []);
          setFilteredTransactions(transactions);
          setAllFilteredTransactions(transactions);
          setLabels(labels);
          setAvailableBankCategories(bankCategories);
          
          // Update loading states
          setIsCategoryMappingsLoading(false);
          setIsTransactionsLoading(false);
          setIsLabelsLoading(false);
          
          console.log('All initial data loaded successfully using optimized endpoint');
        } else {
          throw new Error(response.data.error || 'Failed to fetch initial data');
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setIsTransactionsLoading(false);
        setIsLabelsLoading(false);
        setIsCategoryMappingsLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);
  
  // Function to get category from bank_category using mappings
  const getCategoryFromMapping = (bankCategory) => {
    if (!bankCategory) return null;
    // Only return a value if it exists in the mappings
    return categoryMappings[bankCategory] || null;
  };

  // Extract available categories when transactions and mappings are loaded
  useEffect(() => {
    if (transactions.length) {
      // Get unique categories directly from transactions' category field
      const categories = [...new Set(
        transactions
          .map(t => t.category)  // Use direct category field instead of mapping from bank_category
          .filter(category => category !== null && category !== undefined && category !== '')
      )].sort();
      
      // Add null/empty as the last option if they exist in the data
      if (transactions.some(t => !t.category)) {
        categories.push(null);
      }
      
      setAvailableCategories(categories);
    }
  }, [transactions]); // Remove categoryMappings dependency since we're not using it

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterPopupRef.current && !filterPopupRef.current.contains(event.target) && 
          // Make sure we're not clicking on the filter button itself (which has its own handler)
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
    // Stop event propagation to prevent closing the dropdown
    if (e) {
      e.stopPropagation();
    }
    
    setCategoryFilter(prev => {
      // Check if the category is already in the filter
      const isAlreadyIncluded = prev.some(item => 
        // Handle null equality properly
        (item === null && category === null) || item === category
      );

      if (isAlreadyIncluded) {
        // Remove the category if it's already included
        return prev.filter(item => 
          !((item === null && category === null) || item === category)
        );
      } else {
        // Add the category if it's not already included
        return [...prev, category];
      }
    });
  };

  // Add month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonth(prev => (prev === 0 ? 11 : prev - 1));
    setCurrentYear(prev => (currentMonth === 0 ? prev - 1 : prev));
  };

  const handleNextMonth = () => {
    const now = new Date();
    const currentMonthDate = new Date(currentYear, currentMonth);
    const nextMonthDate = new Date(currentYear, currentMonth + 1);
    
    // Only allow navigating up to the current month
    if (nextMonthDate <= now) {
      setCurrentMonth(prev => (prev === 11 ? 0 : prev + 1));
      setCurrentYear(prev => (currentMonth === 11 ? prev + 1 : prev));
    }
  };

  // Add isCurrentMonthCurrent function to check if we're at the current month
  const isCurrentMonthCurrent = () => {
    const now = new Date();
    const currentMonthDate = new Date(currentYear, currentMonth);
    const nextMonthDate = new Date(currentYear, currentMonth + 1);
    
    return nextMonthDate > now;
  };

  // Function to refresh bank feeds
  const refreshBankFeeds = async () => {
    try {
      setIsRefreshing(true);
      
      const response = await axios.post('http://localhost:5000/refresh-shared-bank-feeds');
      
      if (response.data.success) {
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = 'Bank feeds refreshed successfully!';
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
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
        
        // Refresh the transactions data
        const transactionsResponse = await axios.get('http://localhost:5000/transactions');
        setTransactions(transactionsResponse.data);
        
        // Reapply filters to new data
        let filtered = applyFilters(transactionsResponse.data, {
          dateFilter,
          bankCategoryFilter,
          labelFilter,
          sortBy: filters.sortBy
        });
        
        if (categoryFilter.length > 0) {
          filtered = filtered.filter(transaction => {
            const category = transaction.category;  // Use direct category field
            if (categoryFilter.includes(null) && category === null) {
              return true;
            }
            return categoryFilter.includes(category);
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
        
        // Recalculate totals
        const newTotals = calculateTotals(tableFiltered, labels);
        setTotals(newTotals);
        
      } else {
        // Show error notification
        const notification = document.createElement('div');
        notification.textContent = 'Failed to refresh bank feeds: ' + response.data.message;
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
        
        // Remove notification after 5 seconds
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 5000);
      }
    } catch (error) {
      console.error('Error refreshing bank feeds:', error);
      
      // Show error notification
      const notification = document.createElement('div');
      notification.textContent = 'Error refreshing bank feeds. Check console for details.';
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
      
      // Remove notification after 5 seconds
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Now update the useEffect that filters transactions to also filter by month
  useEffect(() => {
    // Use the applyFilters utility function instead of inline logic
    let filtered = applyFilters(transactions, {
      dateFilter,
      bankCategoryFilter,
      labelFilter,
      sortBy: filters.sortBy
    });

    // Apply additional category filtering if needed
    if (categoryFilter.length > 0) {
      filtered = filtered.filter(transaction => {
        const category = transaction.category;  // Use direct category field
        
        // Check if we're filtering for null and the transaction category is null
        if (categoryFilter.includes(null) && category === null) {
          return true;
        }
        
        // Check if the transaction category is in the filter
        return categoryFilter.includes(category);
      });
    }
    
    // Group split transactions together after filtering and sorting
    filtered = groupSplitTransactions(filtered);
    
    // Store the filtered transactions without month filter for the chart
    setAllFilteredTransactions(filtered);
    
    // Apply month filtering for the table view ONLY if no date filter is active
    let tableFiltered = filtered;
    
    // Only apply month filter if there's no date range filter
    if (!dateFilter.startDate && !dateFilter.endDate) {
      tableFiltered = filtered.filter(transaction => {
        const date = new Date(transaction.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
      
      // Re-group after month filtering to maintain split transaction grouping
      tableFiltered = groupSplitTransactions(tableFiltered);
    }

    setFilteredTransactions(tableFiltered);

    // Calculate totals using the utility function
    const newTotals = calculateTotals(tableFiltered, labels);
    setTotals(newTotals);
  }, [
    transactions, 
    filters.sortBy, 
    dateFilter, 
    bankCategoryFilter, 
    labelFilter, 
    categoryFilter, 
    labels, 
    currentMonth,
    currentYear
  ]);

  const data = {
    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    datasets: []
  };

  // Create datasets for each category (instead of bank category)
  const uniqueCategories = [...new Set(
    allFilteredTransactions
      .map(transaction => transaction.category)  // Use direct category field
      .filter(category => category !== null && category !== undefined && category !== '')
  )].sort();

  // Store colors for consistency
  const categoryColors = useRef({});
  
  // Initialize colors for any new categories
  uniqueCategories.forEach(category => {
    if (!categoryColors.current[category]) {
      categoryColors.current[category] = getRandomColor();
    }
  });

  // Filter transactions based on chart label filter
  const getChartFilteredTransactions = () => {
    return allFilteredTransactions.filter(transaction => {
      // 1. Filter out unlabelled transactions
      if (!transaction.label) {
        return false;
      }
      
      // 2. Apply chart label filter using configuration instead of hardcoded names
      if (chartLabelFilter !== 'All') {
        if (chartLabelFilter === labels[0]) { // Currently set to Ruby for development purposes
          return transaction.label === labels[0] || transaction.label === labels[2]; 
        } else if (chartLabelFilter === labels[1]) { // Currently set to Jack for development purposes
          return transaction.label === labels[1] || transaction.label === labels[2];
        }
      }
      
      // 3. Skip positive transfer transactions if needed
      if (transaction.bank_category === "Transfer" && parseFloat(transaction.amount) > 0) {
        return false;
      }
      
      // Include transaction if it passed all filters
      return true;
    });
  };
  
  // Use the filtering function to get filtered transactions
  const chartFilteredTransactions = getChartFilteredTransactions();
  
  // Process the transactions and only include categories with data
  uniqueCategories.forEach(category => {
    const categoryData = Array(12).fill(0); // Initialize an array for each month
    let hasData = false; // Track if this category has any data points
    
    chartFilteredTransactions.forEach(transaction => {
      const month = new Date(transaction.date).getMonth();
      const transactionCategory = transaction.category;  // Use direct category field
      
      if (transactionCategory === category) {
        let amount = parseFloat(transaction.amount) || 0;
        
        // If it's a "Both" transaction and we're filtering by a specific label, divide by 2
        if (transaction.label === labels[2] && chartLabelFilter !== 'All') {
          amount = amount / 2;
        }
        
        if (amount !== 0) {
          categoryData[month] += amount;
          hasData = true; // Mark that we found data for this category
        }
      }
    });
  
    // Only add to datasets if this category has data
    if (hasData) {
      data.datasets.push({
        label: category,
        data: categoryData,
        backgroundColor: categoryColors.current[category],
      });
    }
  });

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false, // Removed built-in title since we have custom title
      },
    },
    scales: {
      x: {
        stacked: true, // Enable stacking on the x-axis
      },
      y: {
        stacked: true, // Enable stacking on the y-axis
      },
    },
    maintainAspectRatio: false,
  };

  // Updated getRowColor function using modern classes
  const getRowLabelClass = (label) => {
    if (label === labels[0]) return 'row-ruby';
    if (label === labels[1]) return 'row-jack';
    if (label === labels[2]) return 'row-both';
    return '';
  };
  
  const toggleColumnFilter = (column) => {
    setActiveFilterColumn(activeFilterColumn === column ? null : column);
  };
  
  // Handle sorting when clicking on table headers
  const handleHeaderSort = (column) => {
    const currentSort = filters.sortBy;
    let newSort;
    
    // Determine new sort direction
    if (currentSort === `${column}-desc`) {
      newSort = `${column}-asc`;
    } else if (currentSort === `${column}-asc`) {
      newSort = `${column}-desc`;
    } else {
      // Default to descending for the clicked column
      newSort = `${column}-desc`;
    }
    
    setFilters(prev => ({ ...prev, sortBy: newSort }));
  };
  
  const handleDateFilterChange = (e) => {
    const { name, value } = e.target;
    setDateFilter(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBankCategoryFilterChange = (category) => {
    setBankCategoryFilter(prev => {
      if (prev.includes(category)) {
        return prev.filter(cat => cat !== category);
      } else {
        return [...prev, category];
      }
    });
  };
  
  const handleLabelFilterChange = (label) => {
    setLabelFilter(prev => {
      if (prev.includes(label)) {
        return prev.filter(l => l !== label);
      } else {
        return [...prev, label];
      }
    });
  };
  
  const clearFilters = () => {
    setDateFilter({ startDate: '', endDate: '' });
    setBankCategoryFilter([]);
    setLabelFilter([]);
    setCategoryFilter([]);
    setActiveFilterColumn(null);
  };
  
  // Get min and max dates for the date filter
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
    // Handle special case for "null" string value in bank_category field
    if (editCell && editCell.field === 'bank_category' && e.target.value === 'null') {
      setEditValue(null);
    } else {
      setEditValue(e.target.value);
    }
  };

  const handleUpdate = async (transactionId, field) => {
    await optimizedHandleUpdate(
      transactionId, 
      field, 
      editValue, 
      transactions, 
      setTransactions, 
      setFilteredTransactions, 
      setEditCell, 
      setIsUpdating
    );
  };

  // Modernized renderCell function
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
        case 'bank_category':
          return (
            <select 
              className="modern-select"
              value={editValue === null ? 'null' : (editValue || '')}
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
              {availableBankCategories
                .filter(category => category !== null && category !== undefined && category !== '')
                .map(category => (
                  <option key={category} value={category}>{category}</option>
                ))
              }
              <option value="null">(Empty/Null)</option>
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
        ) : field === 'amount' ? (
          <span className={transaction[field] < 0 ? 'amount-negative' : 'amount-positive'}>
            {transaction[field] < 0 ? `-$${Math.abs(transaction[field])}` : `$${transaction[field]}`}
          </span>
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

  // Add handlers for new transaction form
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
      bank_category: '',
      label: labels[0] || ''
    });
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!newTransaction.date || !newTransaction.description || !newTransaction.amount) {
      alert('Please fill out all required fields: Date, Description, and Amount');
      return;
    }
    
    try {
      setIsUpdating(true);
      
      // Create a copy of the transaction data with amount converted to number
      const transactionData = {
        ...newTransaction,
        amount: parseFloat(newTransaction.amount)
      };
      
      // Check if amount is a valid number
      if (isNaN(transactionData.amount)) {
        alert('Please enter a valid number for the amount');
        setIsUpdating(false);
        return;
      }
      
      // Send data to backend
      const response = await axios.post('http://localhost:5000/transactions', transactionData);
      
      if (response.data.success) {
        // Add the new transaction to state
        const addedTransaction = response.data.data;
        
        // Update transactions list
        setTransactions(prev => [addedTransaction, ...prev]);
        
        // Filter logic for newly added transaction to match our filtering rules
        const transactionDate = new Date(addedTransaction.date);
        const isInCurrentMonth = transactionDate.getMonth() === currentMonth && 
                                transactionDate.getFullYear() === currentYear;
        
        // Only add to filtered transactions if it matches current month/year filter
        if (isInCurrentMonth) {
          // Check other filters
          let shouldAdd = true;
          
          // Check date filter
          if (dateFilter.startDate || dateFilter.endDate) {
            if (dateFilter.startDate && new Date(addedTransaction.date) < new Date(dateFilter.startDate)) {
              shouldAdd = false;
            }
            if (dateFilter.endDate && new Date(addedTransaction.date) > new Date(dateFilter.endDate)) {
              shouldAdd = false;
            }
          }
          
          // Check bank category filter
          if (bankCategoryFilter.length > 0) {
            if (!bankCategoryFilter.includes(addedTransaction.bank_category) && 
                !(bankCategoryFilter.includes(null) && !addedTransaction.bank_category)) {
              shouldAdd = false;
            }
          }
          
          // Check label filter
          if (labelFilter.length > 0) {
            if (!labelFilter.includes(addedTransaction.label)) {
              shouldAdd = false;
            }
          }
          
          // Check category filter
          if (categoryFilter.length > 0) {
            const category = addedTransaction.category;  // Use direct category field
            if (!categoryFilter.includes(category) && 
                !(categoryFilter.includes(null) && category === null)) {
              shouldAdd = false;
            }
          }
          
          // Add to filtered transactions if it passes all filters
          if (shouldAdd) {
            setFilteredTransactions(prev => [addedTransaction, ...prev]);
            
            // Update totals
            const newTotals = calculateTotals([...filteredTransactions, addedTransaction], labels);
            setTotals(newTotals);
          }
        }
        
        // Show success notification
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
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
        
        // Reset form and close it
        resetNewTransactionForm();
        setIsAddingTransaction(false);
      } else {
        // Handle case where server returned error
        const errorMessage = response.data.error || response.data.errors?.join(', ') || 'Failed to add transaction';
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Error adding transaction:', err);
      
      let errorMessage = 'Failed to add transaction. Please try again.';
      
      // Try to extract more specific error from response if available
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

  // Function to toggle add transaction form
  const toggleAddTransactionForm = () => {
    if (!isAddingTransaction) {
      // Initialize with current month/year when opening the form
      resetNewTransactionForm();
    }
    setIsAddingTransaction(!isAddingTransaction);
  };

  const cancelAddTransaction = () => {
    setIsAddingTransaction(false);
    resetNewTransactionForm();
  };

  // Add this function to handle navigation from budget chart
  const handleBudgetChartClick = (category, month, year) => {
    // Switch to transactions tab
    setActiveTab('transactions');
    
    // Set the month and year to match the budget view
    setCurrentMonth(month);
    setCurrentYear(year);
    
    // Clear date filter so month navigation works
    setDateFilter({ startDate: '', endDate: '' });
    
    // Clear all filters first
    setCategoryFilter([]);
    setBankCategoryFilter([]);
    setLabelFilter([]);
    
    // Set the category filter directly to the clicked category
    setCategoryFilter([category]);
    
    // Scroll to top to show the transactions table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add screen grab handler
  const handleScreenGrab = async () => {
    setIsScreenGrabOpen(true);
    // Wait for the modal to render
    setTimeout(async () => {
      if (screenGrabRef.current) {
        try {
          const canvas = await html2canvas(screenGrabRef.current, {
            scale: 2, // Higher quality
            useCORS: true,
            backgroundColor: '#ffffff'
          });
          
          // Get date range for filename
          const getDateRangeForFilename = () => {
            if (filteredTransactions.length === 0) return '';
            
            const dates = filteredTransactions.map(t => new Date(t.date));
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            
            // If all transactions are from the same month
            if (minDate.getMonth() === maxDate.getMonth() && 
                minDate.getFullYear() === maxDate.getFullYear()) {
              // If it's the same day
              if (minDate.getDate() === maxDate.getDate()) {
                return `${minDate.getDate()}-${minDate.toLocaleString('default', { month: 'short' })}-${minDate.getFullYear()}`;
              }
              // If it's different days in the same month
              return `${minDate.getDate()}-${maxDate.getDate()}-${minDate.toLocaleString('default', { month: 'short' })}-${minDate.getFullYear()}`;
            }
            
            // If transactions span multiple months
            return `${minDate.getDate()}-${minDate.toLocaleString('default', { month: 'short' })}-${maxDate.getDate()}-${maxDate.toLocaleString('default', { month: 'short' })}-${maxDate.getFullYear()}`;
          };
          
          // Create download link with date range in filename
          const link = document.createElement('a');
          link.download = `transactions-${getDateRangeForFilename()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        } catch (error) {
          console.error('Error generating screen grab:', error);
          alert('Failed to generate screen grab. Please try again.');
        }
      }
    }, 100);
  };

  // Add this function before the renderTransactionsTable function to group related split transactions
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

  // Modify the function to render the related transactions indicator as an inline element
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

  // Transactions table modernized render - update the renderCell for the description field
  const renderTransactionsTable = () => (
    <div className="modern-table-container fade-in" style={{ marginTop: '2px' }}>
      {isTransactionsLoading || isLabelsLoading ? (
        <div className="loading-spinner" />
      ) : (
        <table className="modern-table">
          <thead>
            <tr>
              <th>
                <SortableHeader
                  column="date"
                  sortBy={filters.sortBy}
                  onSort={handleHeaderSort}
                  hasFilter={true}
                  onFilterToggle={() => toggleColumnFilter('date')}
                  isFilterActive={activeFilterColumn === 'date'}
                >
                  Date
                </SortableHeader>
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
                <SortableHeader
                  column="description"
                  sortBy={filters.sortBy}
                  onSort={handleHeaderSort}
                >
                  Description
                </SortableHeader>
              </th>
              <th>
                <SortableHeader
                  column="amount"
                  sortBy={filters.sortBy}
                  onSort={handleHeaderSort}
                >
                  Amount
                </SortableHeader>
              </th>
              <th>
                <SortableHeader
                  column="bank_category"
                  sortBy={filters.sortBy}
                  onSort={handleHeaderSort}
                  hasFilter={true}
                  onFilterToggle={() => toggleColumnFilter('bankCategory')}
                  isFilterActive={activeFilterColumn === 'bankCategory'}
                >
                  Bank Category
                </SortableHeader>
                {activeFilterColumn === 'bankCategory' && (
                  <div ref={filterPopupRef} className="filter-dropdown">
                    <div className="filter-options">
                      {availableBankCategories
                        .filter(category => category !== null && category !== undefined && category !== '')
                        .map(category => (
                          <label key={category} className="filter-option">
                            <input 
                              type="checkbox"
                              className="modern-checkbox"
                              checked={bankCategoryFilter.includes(category)}
                              onChange={() => handleBankCategoryFilterChange(category)}
                            />
                            <span>{category}</span>
                          </label>
                        ))
                      }
                      <label className="filter-option">
                        <input 
                          type="checkbox"
                          className="modern-checkbox"
                          checked={bankCategoryFilter.includes(null)}
                          onChange={() => handleBankCategoryFilterChange(null)}
                        />
                        <span>(Empty/Null)</span>
                      </label>
                    </div>
                    <div className="filter-actions">
                      <button 
                        className="btn-secondary"
                        onClick={() => setBankCategoryFilter([])}
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
                <SortableHeader
                  column="label"
                  sortBy={filters.sortBy}
                  onSort={handleHeaderSort}
                  hasFilter={true}
                  onFilterToggle={() => toggleColumnFilter('label')}
                  isFilterActive={activeFilterColumn === 'label'}
                >
                  Label
                </SortableHeader>
                {activeFilterColumn === 'label' && (
                  <div ref={filterPopupRef} className="filter-dropdown">
                    <div className="filter-options">
                      {labels.map(label => (
                        <label key={label} className="filter-option">
                          <input 
                            type="checkbox"
                            className="modern-checkbox"
                            checked={labelFilter.includes(label)}
                            onChange={() => handleLabelFilterChange(label)}
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
                    <td>{renderCell(transaction, 'bank_category')}</td>
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
                          alignItems: 'center'
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
                            {/* Add other actions here if needed */}
                          </div>
                          
                          {/* Show related transaction details when expanded */}
                          <div>
                            
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

  // Add this before the return statement
  const renderMobileTransactions = () => {
    // Get date range from filtered transactions
    const getDateRange = () => {
      if (filteredTransactions.length === 0) return '';
      
      const dates = filteredTransactions.map(t => new Date(t.date));
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      
      // If all transactions are from the same month
      if (minDate.getMonth() === maxDate.getMonth() && 
          minDate.getFullYear() === maxDate.getFullYear()) {
        // If it's the same day
        if (minDate.getDate() === maxDate.getDate()) {
          return `${minDate.getDate()}${getOrdinalSuffix(minDate.getDate())} ${minDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
        }
        // If it's different days in the same month
        return `${minDate.getDate()}${getOrdinalSuffix(minDate.getDate())} - ${maxDate.getDate()}${getOrdinalSuffix(maxDate.getDate())} ${minDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
      }
      
      // If transactions span multiple months
      return `${minDate.getDate()}${getOrdinalSuffix(minDate.getDate())} ${minDate.toLocaleString('default', { month: 'short', year: 'numeric' })} - ${maxDate.getDate()}${getOrdinalSuffix(maxDate.getDate())} ${maxDate.toLocaleString('default', { month: 'short', year: 'numeric' })}`;
    };

    // Helper function to get ordinal suffix for dates
    const getOrdinalSuffix = (day) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    // Get transaction count
    const transactionCount = filteredTransactions.length;
    
    return (
      <div ref={screenGrabRef} style={{
        padding: '10px',
        backgroundColor: 'white',
        maxWidth: '500px',
        margin: '0 auto',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '10px',
          color: '#2c3e50',
          fontSize: '20px',
          borderBottom: '2px solid #4a90e2',
          paddingBottom: '5px'
        }}>
          {transactionCount} Transactions - {getDateRange()}
        </h2>
        
        {filteredTransactions.map(transaction => (
          <div key={transaction.id} style={{
            marginBottom: '8px',
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: transaction.label === labels[0] ? 'rgba(255, 99, 132, 0.1)' :
                           transaction.label === labels[1] ? 'rgba(54, 162, 235, 0.1)' :
                           transaction.label === labels[2] ? 'rgba(75, 192, 95, 0.1)' :
                           '#f8f9fa',
            borderLeft: `3px solid ${
              transaction.label === labels[0] ? 'rgba(255, 99, 132, 0.8)' :
              transaction.label === labels[1] ? 'rgba(54, 162, 235, 0.8)' :
              transaction.label === labels[2] ? 'rgba(75, 192, 95, 0.8)' :
              '#d1d1d1'
            }`,
            fontSize: '13px',
            lineHeight: '1.3'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '2px'
                }}>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: '#2c3e50',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    marginRight: '8px'
                  }}>
                    {new Date(transaction.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                  <span style={{
                    fontWeight: 'bold',
                    color: transaction.amount < 0 ? '#e53935' : '#43a047',
                    fontSize: '12px',
                    whiteSpace: 'nowrap'
                  }}>
                    {transaction.amount < 0 ? `-$${Math.abs(transaction.amount)}` : `$${transaction.amount}`}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#34495e',
                  fontSize: '12px'
                }}>
                  <span style={{ 
                    flex: 1, 
                    marginRight: '8px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {transaction.description}
                  </span>
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    fontSize: '11px',
                    color: '#7f8c8d'
                  }}>
                    <span>{transaction.bank_category || 'No Cat'}</span>
                    <span>{transaction.label || 'No Label'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        <div style={{ 
          marginTop: '10px', 
          padding: '8px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <h3 style={{ 
            marginBottom: '5px', 
            color: '#2c3e50',
            fontSize: '14px',
            borderBottom: '1px solid #dee2e6',
            paddingBottom: '3px'
          }}>Summary</h3>
          {labels[0] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span>{labels[0]}</span>
              <span style={{ fontWeight: 'bold', color: totals[labels[0]] < 0 ? '#e53935' : '#43a047' }}>
                {totals[labels[0]] < 0 ? `-$${Math.abs(totals[labels[0]]).toFixed(2)}` : `$${totals[labels[0]].toFixed(2)}`}
              </span>
            </div>
          )}
          {labels[1] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span>{labels[1]}</span>
              <span style={{ fontWeight: 'bold', color: totals[labels[1]] < 0 ? '#e53935' : '#43a047' }}>
                {totals[labels[1]] < 0 ? `-$${Math.abs(totals[labels[1]]).toFixed(2)}` : `$${totals[labels[1]].toFixed(2)}`}
              </span>
            </div>
          )}
          {labels[2] && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginTop: '5px', 
              paddingTop: '5px', 
              borderTop: '1px solid #dee2e6',
              fontWeight: 'bold'
            }}>
              <span>Total Spend</span>
              <span style={{ color: (totals[labels[0]] + totals[labels[1]]) < 0 ? '#e53935' : '#43a047' }}>
                {(totals[labels[0]] + totals[labels[1]]) < 0 ? 
                  `-$${Math.abs(totals[labels[0]] + totals[labels[1]]).toFixed(2)}` : 
                  `$${(totals[labels[0]] + totals[labels[1]]).toFixed(2)}`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Split Transaction Handlers
  const handleSplitTransaction = (transaction) => {
    setTransactionToSplit(transaction);
    setSplitTransactions([{
      description: '',
      amount: '',
      bank_category: transaction.bank_category || '',
      label: transaction.label || ''
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
      bank_category: transactionToSplit ? transactionToSplit.bank_category : '',
      label: transactionToSplit ? transactionToSplit.label : ''
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
      !split.description || !split.amount || split.amount === ''
    );
    
    if (hasEmptyFields) {
      // Show error notification
      const notification = document.createElement('div');
      notification.textContent = 'Please fill out all required fields for each split transaction';
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
        // Show error notification
        const notification = document.createElement('div');
        notification.textContent = 'For expense transactions, all split amounts must be negative';
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
        return;
      }
    }
    
    // For positive transactions (income), ensure splits are also positive
    if (originalAmount > 0) {
      const hasNegativeSplit = splitTransactions.some(split => parseFloat(split.amount) < 0);
      if (hasNegativeSplit) {
        // Show error notification
        const notification = document.createElement('div');
        notification.textContent = 'For income transactions, all split amounts must be positive';
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
        return;
      }
    }
    
    // Check if the total split amount exceeds the original (considering sign)
    if (originalAmount < 0) {
      // For expenses: total splits should not be less than original (more negative)
      if (totalSplitAmount < originalAmount) {
        // Show error notification
        const notification = document.createElement('div');
        notification.textContent = 'Split amounts exceed the original transaction amount';
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
        return;
      }
    } else {
      // For income: total splits should not exceed original
      if (totalSplitAmount > originalAmount) {
        // Show error notification
        const notification = document.createElement('div');
        notification.textContent = 'Split amounts exceed the original transaction amount';
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
          bank_category: split.bank_category,
          label: split.label
        }))
      };
      
      const response = await axios.post('http://localhost:5000/transactions/split', splitData);
      
      if (response.data.success) {
        // Refresh the transactions
        const transactionsResponse = await axios.get('http://localhost:5000/transactions');
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
        notification.style.border = '1px solid #c3e6cb';
        
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
          bank_category: '',
          label: ''
        }]);
        
        // Reapply filters to new data
        let filtered = applyFilters(transactionsResponse.data, {
          dateFilter,
          bankCategoryFilter,
          labelFilter,
          sortBy: filters.sortBy
        });

        // Apply additional category filtering if needed
        if (categoryFilter.length > 0) {
          filtered = filtered.filter(transaction => {
            const category = transaction.category;  // Use direct category field
            if (categoryFilter.includes(null) && category === null) {
              return true;
            }
            return categoryFilter.includes(category);
          });
        }
        
        // Store the filtered transactions without month filter for the chart
        setAllFilteredTransactions(filtered);
        
        // Apply month filtering for the table view ONLY if no date filter is active
        let tableFiltered = filtered;
        
        // Only apply month filter if there's no date range filter
        if (!dateFilter.startDate && !dateFilter.endDate) {
          tableFiltered = filtered.filter(transaction => {
            const date = new Date(transaction.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
          });
        }

        setFilteredTransactions(tableFiltered);

        // Calculate totals using the utility function
        const newTotals = calculateTotals(tableFiltered, labels);
        setTotals(newTotals);
      } else {
        // Show error notification
        const notification = document.createElement('div');
        notification.textContent = response.data.error || 'Failed to split transaction';
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
      }
    } catch (error) {
      console.error('Error splitting transaction:', error);
      
      // Show error notification
      const notification = document.createElement('div');
      notification.textContent = 'Failed to split transaction. Please try again.';
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
      bank_category: '',
      label: ''
    }]);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 className="dashboard-title">Finance Dashboard</h1>
      
      {/* Global CSS styles */}
      <style>{buttonStyles}</style>
      <style>
      {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
        }
        
        /* Center-aligned headings */
        .dashboard-title {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 28px;
          color: #2c3e50;
          margin-bottom: 24px;
          position: relative;
          display: block;
          padding-bottom: 8px;
          text-align: center;
        }
        
        .dashboard-title:after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: 0;
          height: 3px;
          width: 40px;
          background-color: #4a90e2;
          border-radius: 2px;
          transform: translateX(-50%);
        }
        
        .section-title {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 22px;
          color: #2c3e50;
          margin: 20px 0 10px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-align: center;
        }
        
        /* Styles for the enhanced edit inputs */
        .modern-input, 
        .modern-select {
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          padding: 8px 16px;
          font-size: 14px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
          outline: none;
          transition: all 0.2s ease;
          background-color: white;
          min-width: 180px;
        }
        
        .modern-input:focus, 
        .modern-select:focus {
          border-color: #4a90e2;
          box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.15);
        }
        
        .modern-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          padding-right: 36px;
        }
        
        /* Special styling for description field */
        input[type="text"].modern-input {
          width: 300px;
        }
        
        /* Compact table styling */
        .modern-table {
          border-collapse: collapse;
          width: 100%;
          font-size: 14px;
        }
        
        .modern-table td {
          padding: 2px 8px;
          vertical-align: middle;
          transition: all 0.15s ease;
          height: 20px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
          line-height: 1;
        }
        
        .modern-table th {
          padding: 2px 8px;
          font-weight: 600;
          background-color: #f8fafc;
          text-align: center;
          position: sticky;
          top: 0;
          z-index: 10;
          height: 20px;
          border-bottom: 1px solid #eaecef;
          line-height: 1;
        }
        
        .modern-table tr {
          line-height: 1;
          border-bottom: 1px solid #f1f1f1;
        }
        
        .modern-table tbody tr:hover {
          background-color: rgba(0,0,0,0.02);
        }
        
        /* Cell content styling */
        .cell-content {
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          justify-content: center;
          align-items: center;
          line-height: 1;
        }
        
        /* Description column specific width */
        .modern-table td:nth-child(2) .cell-content {
          max-width: 400px;
          padding-right: 0;
          min-width: 150px;
          justify-content: center;
          text-align: center;
        }
        
        /* Amount column specific width */
        .modern-table td:nth-child(3) {
          min-width: 80px;
          text-align: right;
        }
        
        /* Category and label columns */
        .modern-table td:nth-child(4),
        .modern-table td:nth-child(5) {
          min-width: 100px;
          max-width: 120px;
        }
        
        /* Modern inputs when editing */
        .modern-table td input.modern-input,
        .modern-table td select.modern-select {
          padding: 0px 8px;
          font-size: 14px;
          height: 20px;
          line-height: 1;
        }
        
        /* Filter header */
        .modern-filter-header {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 0 16px;
          line-height: 1;
        }
        
        /* Filter button */
        .filter-button {
          position: absolute;
          right: 2px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .modern-table {
            font-size: 13px;
          }
          
          .modern-table td {
            padding: 2px 6px;
            height: 18px;
          }
          
          .modern-table th {
            padding: 2px 6px;
            height: 18px;
          }
          
          .modern-table td:nth-child(2) .cell-content {
            max-width: 200px;
            min-width: 120px;
          }
          
          .modern-table td:nth-child(4),
          .modern-table td:nth-child(5) {
            min-width: 80px;
            max-width: 100px;
          }
          
          .modern-table td input.modern-input,
          .modern-table td select.modern-select {
            padding: 0px 6px;
            font-size: 13px;
            height: 18px;
          }
        }
        
        .nav-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          font-family: 'Inter', sans-serif;
        }
        
        .nav-button.active {
          background-color: #4a90e2;
          color: white;
        }
        
        .nav-button:not(.active) {
          background-color: #f0f0f0;
          color: #333;
        }
        
        .nav-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .help-toggle {
          background-color: #f8f9fa;
          background-image: linear-gradient(to bottom, #ffffff, #f5f5f5);
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 13px;
          color: #4a6785;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .help-toggle:hover {
          background-image: linear-gradient(to bottom, #f8f9fa, #f0f0f0);
          box-shadow: 0 2px 5px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }
        
        .help-toggle svg {
          transition: all 0.2s ease;
        }
        
        .help-toggle:hover svg {
          transform: scale(1.1);
        }
        
        /* Enhanced row styling for better discernibility */
        .row-ruby {
          background-color: rgba(255, 99, 132, 0.25) !important;
          border-left: 4px solid rgba(255, 99, 132, 0.8);
        }
        
        .row-jack {
          background-color: rgba(54, 162, 235, 0.25) !important;
          border-left: 4px solid rgba(54, 162, 235, 0.8);
        }
        
        .row-both {
          background-color: rgba(75, 192, 95, 0.25) !important;
          border-left: 4px solid rgba(75, 192, 95, 0.8);
        }
        
        /* Styling for unlabeled rows */
        .modern-table tbody tr:not(.row-ruby):not(.row-jack):not(.row-both) {
          background-color: white;
          border-left: 4px solid #d1d1d1;
        }
        
        .empty-value {
          font-style: italic;
          color: transparent;
        }
        
        .amount-negative {
          color: #e53935;
          font-weight: 500;
        }
        
        .amount-positive {
          color: #43a047;
          font-weight: 500;
        }
        
        .editable-cell {
          position: relative;
          cursor: pointer;
        }
        
        .editable-cell:hover::after {
          content: '✎';
          position: absolute;
          top: 2px;
          right: 5px;
          font-size: 12px;
          color: #aaa;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Description column specific width and alignment */
        .modern-table td:nth-child(2) {
          text-align: left; /* Left align description cells */
        }
        
        .modern-table td:nth-child(2) .cell-content {
          max-width: 600px;
          padding-right: 0;
          min-width: 180px;
          justify-content: flex-start; /* Left align description content */
          text-align: left;
        }
        
        /* When editing description, make input left-aligned */
        .modern-table td:nth-child(2) input[type="text"].modern-input {
          text-align: left;
        }
        
        /* Keep description header centered */
        .modern-table th:nth-child(2) {
          text-align: center;
        }
        
        .modern-table th:nth-child(2) .modern-filter-header {
          justify-content: center;
        }
      `}
      </style>
      
      <div style={{ 
        marginBottom: '20px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
      }}>
        <button 
          onClick={() => setActiveTab('transactions')}
          className={`nav-button ${activeTab === 'transactions' ? 'active' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="6" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 3L8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 3L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <rect x="7" y="14" width="4" height="2" rx="0.5" fill="currentColor" />
            <rect x="13" y="14" width="4" height="2" rx="0.5" fill="currentColor" />
            <rect x="7" y="17" width="4" height="2" rx="0.5" fill="currentColor" />
            <rect x="13" y="17" width="4" height="2" rx="0.5" fill="currentColor" />
          </svg>
          Transactions
        </button>
        <button 
          onClick={() => setActiveTab('budgets')}
          className={`nav-button ${activeTab === 'budgets' ? 'active' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M5.5 13.5L7.5 10.5L10.5 11.5L13.5 6.5L16.5 9.5L19.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="7" y="14" width="2" height="4" rx="0.5" fill="currentColor"/>
            <rect x="12" y="12" width="2" height="6" rx="0.5" fill="currentColor"/>
            <rect x="17" y="10" width="2" height="8" rx="0.5" fill="currentColor"/>
          </svg>
          Budgets
        </button>
        
        <button 
          onClick={() => setActiveTab('personal')}
          className={`nav-button ${activeTab === 'personal' ? 'active' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Personal
        </button>
        
        <button 
          onClick={() => setActiveTab('offset')}
          className={`nav-button ${activeTab === 'offset' ? 'active' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Offset
        </button>
        
        <button 
          className="help-toggle"
          onClick={() => setHelpTextVisible(!helpTextVisible)}
          title={helpTextVisible ? "Hide help text" : "Show help text"}
        >
          {helpTextVisible ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 21L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Hide Help
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Show Help
            </>
          )}
        </button>
      </div>
      {activeTab === 'transactions' && (
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
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          <div>
            {/* Active filters display */}
            {(dateFilter.startDate || dateFilter.endDate ||bankCategoryFilter.length > 0 || labelFilter.length > 0 || categoryFilter.length > 0) && (
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
                    {bankCategoryFilter.length > 0 && (
                      <span style={{ margin: '0 10px' }}>
                        Bank Categories: {bankCategoryFilter.join(', ')}
                      </span>
                    )}
                    {categoryFilter.length > 0 && (
                      <span style={{ margin: '0 10px' }}>
                        Categories: {categoryFilter.map(cat => cat === null ? 'null' : cat).join(', ')}
                      </span>
                    )}
                    {labelFilter.length > 0 && (
                      <span style={{ margin: '0 10px' }}>
                        Labels: {labelFilter.join(', ')}
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
          </div>

          {/* Chart section with loading indicator */}
          <div style={{ height: '500px', marginBottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {isTransactionsLoading || isLabelsLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                {/* Custom title section with integrated controls */}
                <div style={{ 
                  width: '100%', 
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: '20px',
                  marginTop: '20px'
                }}>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    margin: 0,
                    fontFamily: 'Inter, sans-serif',
                    textAlign: 'center'
                  }}>
                    {chartLabelFilter === 'All' 
                      ? 'All-Time Transactions' 
                      : `${chartLabelFilter}'s All-Time Transactions`}
                  </h3>
                  
                  <div style={{ 
                    position: 'absolute',
                    right: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex', 
                    gap: '8px', 
                    alignItems: 'center',
                    zIndex: 100
                  }}>
                    <select
                      value={chartLabelFilter}
                      onChange={(e) => setChartLabelFilter(e.target.value)}
                      style={{
                        padding: '5px 10px',
                        margin: '0px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        outline: 'none',
                        fontSize: '13px'
                      }}
                    >
                      <option value="All">All Transactions</option>
                      {labels.length > 0 && (
                        <>
                          <option value={labels[0]}>{labels[0]}'s</option>
                          <option value={labels[1]}>{labels[1]}'s</option>
                        </>
                      )}
                    </select>
                    <button 
                      data-filter="category"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFilterColumn(activeFilterColumn === 'categoryFilter' ? null : 'categoryFilter');
                      }}
                      className="modern-button"
                      style={{ 
                        padding: '6px 12px',
                        backgroundColor: categoryFilter.length > 0 ? '#e6f7ff' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        position: 'relative'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                      </svg>
                      <span>Categories</span>
                      {categoryFilter.length > 0 && (
                        <span style={{ 
                          backgroundColor: '#4a90e2', 
                          color: 'white', 
                          borderRadius: '50%', 
                          width: '16px', 
                          height: '16px', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '11px'
                        }}>
                          {categoryFilter.length}
                        </span>
                      )}

                      {/* Category filter popup */}
                      {activeFilterColumn === 'categoryFilter' && (
                        <div 
                          ref={filterPopupRef}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: '0',
                            zIndex: 1000,
                            background: 'white',
                            border: '1px solid #ccc',
                            padding: '10px',
                            borderRadius: '4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            width: '250px',
                            maxHeight: '350px',
                            overflowY: 'auto',
                            marginTop: '5px'
                          }}
                        >
                          {/* Display non-null categories first */}
                          {availableCategories
                            .filter(category => category !== null && category !== undefined && category !== '')
                            .map(category => (
                              <div key={category} style={{ marginBottom: '6px' }}>
                                <label style={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    checked={categoryFilter.includes(category)}
                                    onChange={(e) => handleCategoryFilterChange(category, e)}
                                    style={{ marginRight: '8px' }}
                                  />
                                  {category}
                                </label>
                              </div>
                            ))
                          }
                          
                          {/* Display null/empty category at the bottom if it exists */}
                          {availableCategories.some(category => category === null || category === undefined || category === '') && (
                            <div style={{ marginBottom: '6px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                              <label style={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={categoryFilter.includes(null)}
                                  onChange={(e) => handleCategoryFilterChange(null, e)}
                                  style={{ marginRight: '8px' }}
                                />
                                null
                              </label>
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setCategoryFilter([]);
                              }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFilterColumn(null);
                              }}
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
                    </button>
                  </div>
                </div>
                
                <div style={{ width: '90%', maxWidth: '1200px', height: '400px', margin: '0 auto' }}>
                  <Bar data={data} options={options} />
                  <HelpText isVisible={helpTextVisible}>
                    Chart displays data for all months regardless of the month filter above and respects all other applied filters. Unlabelled transactions are excluded from the chart view.
                  </HelpText>
                </div>
              </>
            )}
          </div>

          <h2 className="section-title">
            Shared Transactions 
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
            padding: '5px',
            paddingBottom: '0px',
            marginBottom: '0px',
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
              <div style={{ 
                display: 'flex',
                alignItems: 'center'
              }}>
                <button 
                  onClick={handlePrevMonth}
                  className="modern-button navigation prev"
                  style={{ marginRight: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Prev
                </button>
                <div className="month-display" style={{
                  textAlign: 'center',
                  padding: '0 12px',
                  whiteSpace: 'nowrap'
                }}>
                  {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'short', year: 'numeric' })}
                </div>
                <button 
                  onClick={handleNextMonth}
                  className="modern-button navigation next"
                  disabled={isCurrentMonthCurrent()}
                  style={{
                    opacity: isCurrentMonthCurrent() ? 0.7 : 1,
                    cursor: isCurrentMonthCurrent() ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button 
                  onClick={refreshBankFeeds}
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
              Use the month navigation to browse your transaction history. Only transactions from the selected month are shown unless a date filter is active.
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
                <h2 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Add New Transaction</h2>
                
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
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Bank Category
                    </label>
                    <select
                      name="bank_category"
                      value={newTransaction.bank_category}
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
                      {availableBankCategories
                        .filter(category => category !== null && category !== undefined && category !== '')
                        .map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))
                      }
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Label
                    </label>
                    <select
                      name="label"
                      value={newTransaction.label}
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
                      <option value="">Select a label</option>
                      {labels.map(label => (
                        <option key={label} value={label}>{label}</option>
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
          
          {/* Transactions table with modern styling */}
          {renderTransactionsTable()}
          
          {isTransactionsLoading || isLabelsLoading ? (
            <LoadingSpinner />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              {labels[0] && (
                <div 
                  style={{ 
                    backgroundColor: 'rgba(255, 99, 132, 0.2)', 
                    padding: '15px', 
                    borderRadius: '8px',
                    borderRight: '5px solid rgba(255, 99, 132, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    maxWidth: 'fit-content',
                    marginLeft: 'auto'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginRight: '15px' }}>
                    {labels[0]}
                  </div>
                  <div style={{ minWidth: '100px', textAlign: 'right' }}>
                    {totals[labels[0]] != null ? 
                      (totals[labels[0]] < 0 ? 
                        `-$${Math.abs(totals[labels[0]]).toFixed(2)}` : 
                        `$${totals[labels[0]].toFixed(2)}`)
                      : '$0.00'}
                  </div>
                </div>
              )}
              {labels[1] && (
                <div 
                  style={{ 
                    backgroundColor: 'rgba(54, 162, 235, 0.2)', 
                    padding: '15px', 
                    borderRadius: '8px',
                    borderRight: '5px solid rgba(54, 162, 235, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    maxWidth: 'fit-content',
                    marginLeft: 'auto'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginRight: '15px' }}>
                    {labels[1]}
                  </div>
                  <div style={{ minWidth: '100px', textAlign: 'right' }}>
                    {totals[labels[1]] != null ? 
                      (totals[labels[1]] < 0 ? 
                        `-$${Math.abs(totals[labels[1]]).toFixed(2)}` : 
                        `$${totals[labels[1]].toFixed(2)}`)
                      : '$0.00'}
                  </div>
                </div>
              )}
              {labels[2] && (
                <div 
                  style={{ 
                    backgroundColor: 'rgba(75, 192, 95, 0.2)', 
                    padding: '15px', 
                    borderRadius: '8px',
                    borderRight: '5px solid rgba(75, 192, 95, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    maxWidth: 'fit-content',
                    marginLeft: 'auto'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginRight: '15px' }}>
                    Total Spend
                  </div>
                  <div style={{ minWidth: '100px', textAlign: 'right' }}>
                    {(totals[labels[0]] != null && totals[labels[1]] != null) ? 
                      ((totals[labels[0]] + totals[labels[1]]) < 0 ? 
                        `-$${Math.abs(totals[labels[0]] + totals[labels[1]]).toFixed(2)}` : 
                        `$${(totals[labels[0]] + totals[labels[1]]).toFixed(2)}`)
                      : '$0.00'}
                  </div>
                </div>
              )}

              {/* Screen Grab Button */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                marginTop: '20px',
                padding: '15px',
                borderTop: '1px solid #eee'
              }}>
                <button 
                  onClick={handleScreenGrab}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    backgroundColor: '#6c5ce7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  Download Mobile View
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'budgets' && <Budgets helpTextVisible={helpTextVisible} onChartClick={handleBudgetChartClick} />}
      {activeTab === 'personal' && <PersonalTransactions helpTextVisible={helpTextVisible} />}
      {activeTab === 'offset' && <OffsetTransactions helpTextVisible={helpTextVisible} />}

      {/* Add this at the end of the transactions view, before the closing div */}
      {isScreenGrabOpen && (
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
            maxWidth: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Mobile View</h2>
              <button
                onClick={() => setIsScreenGrabOpen(false)}
                style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            {renderMobileTransactions()}
          </div>
        </div>
      )}
      
      {/* Split Transaction Modal - REFACTORED VERSION */}
      {isSplitting && (
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
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            width: '600px',
            maxWidth: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
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
                Split Transaction
              </h2>
              <button
                onClick={cancelSplit}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {transactionToSplit && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Original Transaction Summary - Compact Version */}
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '12px', 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#6b7280', 
                        marginBottom: '4px',
                        fontWeight: '500'
                      }}>
                        Original Transaction
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#1f2937',
                        fontWeight: '500'
                      }}>
                        {transactionToSplit.description}
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        gap: '8px', 
                        marginTop: '12px'
                      }}>
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          border: '1px solid #bfdbfe'
                        }}>
                          📅 {new Date(transactionToSplit.date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        {transactionToSplit.bank_category && (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#f0fdf4',
                            color: '#166534',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            border: '1px solid #bbf7d0'
                          }}>
                            🏷️ {transactionToSplit.bank_category}
                          </span>
                        )}
                        {transactionToSplit.label && (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            border: '1px solid #fde68a'
                          }}>
                            👤 {transactionToSplit.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: parseFloat(transactionToSplit.amount) < 0 ? '#dc2626' : '#059669',
                      marginLeft: '16px'
                    }}>
                      {parseFloat(transactionToSplit.amount) < 0 
                        ? `-$${Math.abs(parseFloat(transactionToSplit.amount)).toFixed(2)}` 
                        : `$${parseFloat(transactionToSplit.amount).toFixed(2)}`}
                    </div>
                  </div>
                </div>
                
                {/* Remaining Amount - Compact Status Bar */}
                <div style={{ 
                  marginBottom: '16px',
                  padding: '10px 12px',
                  backgroundColor: calculateRemainingAmount() === 0 ? '#dcfce7' : '#fef3c7',
                  borderRadius: '8px',
                  border: `1px solid ${calculateRemainingAmount() === 0 ? '#bef264' : '#fde047'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ 
                    fontSize: '13px', 
                    color: '#374151',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>Remaining:</span>
                    <span style={{ 
                      color: calculateRemainingAmount() < 0 ? '#dc2626' : '#059669',
                      fontWeight: '600'
                    }}>
                      {calculateRemainingAmount() < 0 
                        ? `-$${Math.abs(calculateRemainingAmount()).toFixed(2)}` 
                        : `$${calculateRemainingAmount().toFixed(2)}`}
                    </span>
                  </span>
                  <span style={{ 
                    fontSize: '12px', 
                    color: calculateRemainingAmount() === 0 ? '#059669' : '#92400e'
                  }}>
                    {calculateRemainingAmount() === 0 
                      ? '✓ Fully allocated' 
                      : 'Will remain on original'}
                  </span>
                </div>
                
                {/* Split Transactions - More Compact */}
                <div style={{ 
                  flex: 1, 
                  overflowY: 'auto',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '12px'
                  }}>
                    Split Into {splitTransactions.length} Transaction{splitTransactions.length > 1 ? 's' : ''}
                  </h3>
                  
                  {splitTransactions.map((split, index) => (
                    <div key={index} style={{ 
                      marginBottom: '12px', 
                      padding: '12px', 
                      backgroundColor: '#ffffff', 
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      position: 'relative'
                    }}>
                      {splitTransactions.length > 1 && (
                        <button
                          onClick={() => removeSplitTransaction(index)}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            padding: '2px',
                            backgroundColor: '#fee2e2',
                            border: 'none',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            width: '20px',
                            height: '20px'
                          }}
                          title="Remove split"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      )}
                      
                      {/* Compact form layout */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input
                          type="text"
                          value={split.description}
                          onChange={(e) => handleSplitChange(index, 'description', e.target.value)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '14px',
                            width: '100%',
                            boxSizing: 'border-box',
                            transition: 'border-color 0.2s'
                          }}
                          placeholder="Description"
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={split.amount}
                            onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              transition: 'border-color 0.2s'
                            }}
                            placeholder="Amount"
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          />
                          
                          <select
                            value={split.bank_category}
                            onChange={(e) => handleSplitChange(index, 'bank_category', e.target.value)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '14px',
                              backgroundColor: 'white',
                              boxSizing: 'border-box',
                              cursor: 'pointer',
                              transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          >
                            <option value="">Category</option>
                            {availableBankCategories
                              .filter(category => category !== null && category !== undefined && category !== '')
                              .map(category => (
                                <option key={category} value={category}>{category}</option>
                              ))
                            }
                          </select>
                          
                          <select
                            value={split.label}
                            onChange={(e) => handleSplitChange(index, 'label', e.target.value)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '14px',
                              backgroundColor: 'white',
                              boxSizing: 'border-box',
                              cursor: 'pointer',
                              transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          >
                            <option value="">Label</option>
                            {labels.map(label => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add split button */}
                  <button
                    onClick={addSplitTransaction}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: 'transparent',
                      color: '#3b82f6',
                      border: '1px dashed #3b82f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#eff6ff';
                      e.target.style.borderColor = '#2563eb';
                      e.target.style.color = '#2563eb';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.color = '#3b82f6';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Another Split
                  </button>
                </div>
                
                {/* Action buttons - Sticky footer */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '8px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={cancelSplit}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#ffffff';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSplit}
                    disabled={isSavingSplit}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: isSavingSplit ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isSavingSplit ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSavingSplit) {
                        e.target.style.backgroundColor = '#2563eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSavingSplit) {
                        e.target.style.backgroundColor = '#3b82f6';
                      }
                    }}
                  >
                    {isSavingSplit ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
                          style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" strokeDasharray="30 60" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        Save Splits
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;