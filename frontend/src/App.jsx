import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import Budgets from './Budgets';
import PersonalTransactions from './PersonalTransactions';
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
import './ModernTables.css';

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

const App = () => {
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [allFilteredTransactions, setAllFilteredTransactions] = useState([]); // New state for all months but filtered
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

  // Function to generate a random color
  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };
  
  // Fetch category mappings from the backend
  useEffect(() => {
    setIsCategoryMappingsLoading(true);
    
    axios.get('http://localhost:5000/category-mappings')
      .then(response => {
        setCategoryMappings(response.data);
        setIsCategoryMappingsLoading(false);
      })
      .catch(err => {
        console.error('Error fetching category mappings:', err);
        setIsCategoryMappingsLoading(false);
      });
  }, []);
  
  // Function to get category from bank_category using mappings
  const getCategoryFromMapping = (bankCategory) => {
    if (!bankCategory) return null;
    // Only return a value if it exists in the mappings
    return categoryMappings[bankCategory] || null;
  };
  
  useEffect(() => {
    // Set loading state to true before fetching data
    setIsTransactionsLoading(true);
    
    axios.get('http://localhost:5000/transactions')
      .then(response => {
        setTransactions(response.data);
        setFilteredTransactions(response.data);
        setAllFilteredTransactions(response.data);
        setIsTransactionsLoading(false);
      })
      .catch(err => {
        console.error(err);
        // Set loading state to false even if there's an error
        setIsTransactionsLoading(false);
      });
  }, []);

  // Extract available categories when transactions and mappings are loaded
  useEffect(() => {
    if (transactions.length && Object.keys(categoryMappings).length) {
      // Get unique categories from transactions using the mapping
      const categories = [...new Set(
        transactions
          .map(t => getCategoryFromMapping(t.bank_category))
          .filter(category => category !== null && category !== undefined && category !== '')
      )].sort();
      
      // Add null/empty as the last option if they exist in the data
      if (transactions.some(t => !getCategoryFromMapping(t.bank_category))) {
        categories.push(null);
      }
      
      setAvailableCategories(categories);
    }
  }, [transactions, categoryMappings]);

  // Fetch labels from the backend
  useEffect(() => {
    // Set loading state to true before fetching labels
    setIsLabelsLoading(true);
    
    axios.get('http://localhost:5000/labels')
      .then(response => {
        setLabels(response.data);
        // Set loading state to false after successfully fetching labels
        setIsLabelsLoading(false);
      })
      .catch(err => {
        console.error(err);
        // Set loading state to false even if there's an error
        setIsLabelsLoading(false);
      });
  }, []);

  // Fetch bank categories for filters and editing from the backend
  useEffect(() => {
    axios.get('http://localhost:5000/bank-categories')
      .then(response => {
        setAvailableBankCategories(response.data);
      })
      .catch(err => {
        console.error('Error fetching bank categories:', err);
      });
  }, []);

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
            const category = getCategoryFromMapping(transaction.bank_category);
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
        const category = getCategoryFromMapping(transaction.bank_category);
        
        // Check if we're filtering for null and the transaction category is null
        if (categoryFilter.includes(null) && category === null) {
          return true;
        }
        
        // Check if the transaction category is in the filter
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
  }, [
    transactions, 
    filters.sortBy, 
    dateFilter, 
    bankCategoryFilter, 
    labelFilter, 
    categoryFilter, 
    labels, 
    categoryMappings,
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
      .map(transaction => getCategoryFromMapping(transaction.bank_category))
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
  
  // Then simplify the loop where you process the transactions:
  uniqueCategories.forEach(category => {
    const categoryData = Array(12).fill(0); // Initialize an array for each month
    
    chartFilteredTransactions.forEach(transaction => {
      const month = new Date(transaction.date).getMonth();
      const transactionCategory = getCategoryFromMapping(transaction.bank_category);
      
      if (transactionCategory === category) {
        let amount = parseFloat(transaction.amount) || 0;
        
        // If it's a "Both" transaction and we're filtering by a specific label, divide by 2
        if (transaction.label === labels[2] && chartLabelFilter !== 'All') {
          amount = amount / 2;
        }
        
        categoryData[month] += amount;
      }
    });
  
    data.datasets.push({
      label: category,
      data: categoryData,
      backgroundColor: categoryColors.current[category],
    });
  });

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartLabelFilter === 'All' 
          ? 'All-Time Transactions by Month and Category' 
          : `${chartLabelFilter}'s All-Time Transactions by Month and Category`,
        font: {
          size: 24,
          weight: 'bold'
        },
        padding: {
          top: 20,
          bottom: 30
        }
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
    try {
      // Show update indicator
      setIsUpdating(true);
      
      // Send update to backend first
      const response = await axios.put(`http://localhost:5000/transactions/${transactionId}`, { 
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
        
        // Add temporary success notification
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
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          document.body.removeChild(notification);
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
            const category = getCategoryFromMapping(addedTransaction.bank_category);
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
    
    // Find all bank categories that map to this category
    const matchingBankCategories = Object.entries(categoryMappings)
      .filter(([bankCat, cat]) => cat === category)
      .map(([bankCat, _]) => bankCat);
    
    // Set the bank category filter to include all matching categories
    setBankCategoryFilter(matchingBankCategories);
    
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

  // Transactions table modernized render
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
                  <span>Bank Category</span>
                  <FilterButton
                    isActive={activeFilterColumn === 'bankCategory'}
                    onClick={() => toggleColumnFilter('bankCategory')}
                  />
                </div>
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
                <tr key={transaction.id} className={getRowLabelClass(transaction.label)}>
                  <td>{renderCell(transaction, 'date')}</td>
                  <td>{renderCell(transaction, 'description')}</td>
                  <td>{renderCell(transaction, 'amount')}</td>
                  <td>{renderCell(transaction, 'bank_category')}</td>
                  <td>{renderCell(transaction, 'label')}</td>
                </tr>
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

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 className="dashboard-title">Finance Dashboard</h1>
      
      {/* Global CSS styles */}
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
        
        /* Add striping for unlabeled rows */
        .modern-table tbody tr:not(.row-ruby):not(.row-jack):not(.row-both) {
          background-color: #f7f7f7;
          border-left: 4px solid #d1d1d1;
        }
        
        .modern-table tbody tr:not(.row-ruby):not(.row-jack):not(.row-both):nth-child(odd) {
          background-color: #eaeaea;
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
                <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'flex-end', width: '100%', gap: '15px', alignItems: 'center' }}>
                  <div>
                    <select
                      value={chartLabelFilter}
                      onChange={(e) => setChartLabelFilter(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        outline: 'none'
                      }}
                    >
                      <option value="All">All Transactions</option>
                      {labels.length > 0 && (
                        <>
                          <option value={labels[0]}>{labels[0]}'s Transactions</option>
                          <option value={labels[1]}>{labels[1]}'s Transactions</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <button 
                      data-filter="category"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFilterColumn(activeFilterColumn === 'categoryFilter' ? null : 'categoryFilter');
                      }}
                      style={{ 
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        backgroundColor: categoryFilter.length > 0 ? '#e6f7ff' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        position: 'relative'
                      }}
                    >
                      <span>Filter by Category</span>
                      {categoryFilter.length > 0 && (
                        <span style={{ 
                          backgroundColor: '#4a90e2', 
                          color: 'white', 
                          borderRadius: '50%', 
                          width: '18px', 
                          height: '18px', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '12px'
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
                <div style={{ width: '90%', maxWidth: '1200px', height: '400px', margin: '30px auto' }}>
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
    </div>
  );
};

export default App;