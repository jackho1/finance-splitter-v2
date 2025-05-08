import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import Budgets from './Budgets';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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

const App = () => {
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [allFilteredTransactions, setAllFilteredTransactions] = useState([]); // New state for all months but filtered
  const [filters, setFilters] = useState({ labels: [], sortBy: 'date-desc' });
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
      
      // 2. Apply chart label filter
      if (chartLabelFilter !== 'All') {
        if (chartLabelFilter === labels[0]) { // Ruby
          return transaction.label === labels[0] || transaction.label === labels[2]; 
        } else if (chartLabelFilter === labels[1]) { // Jack
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

  const getRowColor = (label) => {
    if (label === labels[0]) {
      return 'rgba(255, 99, 132, 0.5)';
    } else if (label === labels[1]) {
      return 'rgba(54, 162, 235, 0.5)';
    } else if (label === labels[2]) {
      return 'rgba(75, 192, 95, 0.5)';
    }
    return 'transparent'; // Default color
  };

  const handleLabelChange = (e) => {
    const value = e.target.value;
    setFilters(prevFilters => {
      const labels = [...prevFilters.labels];
      if (labels.includes(value)) {
        return { ...prevFilters, labels: labels.filter(label => label !== value) };
      } else {
        return { ...prevFilters, labels: [...labels, value] };
      }
    });
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
              style={{ width: '100%' }}
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
              style={{ width: '100%' }}
              autoFocus
            />
          );
        case 'bank_category':
          return (
            <select 
              value={editValue === null ? 'null' : (editValue || '')}
              onChange={handleInputChange} 
              onBlur={() => handleUpdate(transaction.id, field)}
              style={{ width: '100%' }}
              autoFocus
            >
              <option value="">Select a category</option>
              {availableBankCategories
                .filter(category => category !== null && category !== undefined && category !== '')
                .map(category => (
                  <option key={category} value={category}>{category}</option>
                ))
              }
              <option key="null-option" value="null">(null)</option>
            </select>
          );
        case 'label':
          return (
            <select 
              value={editValue || ''} 
              onChange={handleInputChange} 
              onBlur={() => handleUpdate(transaction.id, field)}
              style={{ width: '100%' }}
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
              value={editValue || ''}
              onChange={handleInputChange}
              onBlur={() => handleUpdate(transaction.id, field)}
              style={{ width: '100%' }}
              autoFocus
            />
          );
      }
    }

    // Special handling for empty cells
    const isEmpty = 
      transaction[field] === null || 
      transaction[field] === undefined || 
      transaction[field] === '';
    
    return (
      <div 
        onDoubleClick={() => handleDoubleClick(transaction.id, field, transaction[field] || '')}
        style={{ 
          cursor: 'pointer',
          minHeight: '1.2em'
        }}
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
        
        .dashboard-title {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 28px;
          color: #2c3e50;
          margin-bottom: 24px;
          position: relative;
          display: inline-block;
          padding-bottom: 8px;
        }
        
        .dashboard-title:after {
          content: '';
          position: absolute;
          left: 0;
          bottom: 0;
          height: 3px;
          width: 40px;
          background-color: #4a90e2;
          border-radius: 2px;
        }
        
        .section-title {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 22px;
          color: #2c3e50;
          margin: 20px 0 10px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .date-label {
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 16px;
          color: #64748b;
          margin-left: 8px;
        }
        
        .help-text {
          display: flex;
          align-items: flex-start;
          background-color: #f8f9fa;
          padding: 10px 15px;
          border-radius: 6px;
          border-left: 3px solid #4a90e2;
          margin-bottom: 15px;
          font-size: 13px;
          color: #505050;
          font-family: 'Inter', sans-serif;
        }
        
        .help-text-icon {
          color: #4a90e2;
          margin-right: 10px;
          margin-top: 2px;
        }
        
        .help-text-content {
          flex: 1;
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
                  <HelpText isVisible={helpTextVisible} style={{marginBottom: '8px'}}>
                    Chart displays data for all months regardless of the month filter above and respects all other applied filters. Unlabelled transactions are excluded from the chart view.
                  </HelpText>
                </div>
              </>
            )}
          </div>

          <h2 className="section-title">
            Filtered Transactions 
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
          
          {/* Transactions table with loading indicator */}
          {isTransactionsLoading || isLabelsLoading ? (
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
                      onClick={() => toggleColumnFilter('bankCategory')}
                    >
                      Bank Category {activeFilterColumn === 'bankCategory' ? '▲' : '▼'}
                    </div>
                    {activeFilterColumn === 'bankCategory' && (
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
                        {/* Display non-null categories first */}
                        {availableBankCategories
                          .filter(category => category !== null && category !== undefined && category !== '')
                          .map(category => (
                            <div key={category} style={{ marginBottom: '6px' }}>
                              <label style={{ display: 'flex', alignItems: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={bankCategoryFilter.includes(category)}
                                  onChange={() => handleBankCategoryFilterChange(category)}
                                  style={{ marginRight: '8px' }}
                                />
                                {category}
                              </label>
                            </div>
                          ))
                        }
                        
                        {/* Display null category option */}
                        <div style={{ marginBottom: '6px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={bankCategoryFilter.includes(null)}
                              onChange={() => handleBankCategoryFilterChange(null)}
                              style={{ marginRight: '8px' }}
                            />
                            (Empty/Null)
                          </label>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                          <button 
                            onClick={() => setBankCategoryFilter([])}
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
                  <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', position: 'relative' }}>
                    <div 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      onClick={() => toggleColumnFilter('label')}
                    >
                      Label {activeFilterColumn === 'label' ? '▲' : '▼'}
                    </div>
                    {activeFilterColumn === 'label' && (
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
                          width: '200px'
                        }}
                      >
                        {labels.map(label => (
                          <div key={label} style={{ marginBottom: '6px' }}>
                            <label style={{ display: 'flex', alignItems: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={labelFilter.includes(label)}
                                onChange={() => handleLabelFilterChange(label)}
                                style={{ marginRight: '8px' }}
                              />
                              {label}
                            </label>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                          <button 
                            onClick={() => setLabelFilter([])}
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
                  <tr key={transaction.id} style={{ backgroundColor: getRowColor(transaction.label) }}>
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
                      {renderCell(transaction, 'bank_category')}
                    </td>
                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                      {renderCell(transaction, 'label')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="section-title">Totals</h2>
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
                    borderLeft: '5px solid rgba(255, 99, 132, 1)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{labels[0]}</span>
                  <span>
                    {totals[labels[0]] != null ? 
                      (totals[labels[0]] < 0 ? 
                        `-$${Math.abs(totals[labels[0]]).toFixed(2)}` : 
                        `$${totals[labels[0]].toFixed(2)}`)
                      : '$0.00'}
                    {labels[2] && <span style={{ fontSize: '0.85em', marginLeft: '8px', opacity: 0.75 }}>
                      (includes 50% of "{labels[2]}" transactions)
                    </span>}
                  </span>
                </div>
              )}
              {labels[1] && (
                <div 
                  style={{ 
                    backgroundColor: 'rgba(54, 162, 235, 0.2)', 
                    padding: '15px', 
                    borderRadius: '8px',
                    borderLeft: '5px solid rgba(54, 162, 235, 1)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{labels[1]}</span>
                  <span>
                    {totals[labels[1]] != null ? 
                      (totals[labels[1]] < 0 ? 
                        `-$${Math.abs(totals[labels[1]]).toFixed(2)}` : 
                        `$${totals[labels[1]].toFixed(2)}`)
                      : '$0.00'}
                    {labels[2] && <span style={{ fontSize: '0.85em', marginLeft: '8px', opacity: 0.75 }}>
                      (includes 50% of "{labels[2]}" transactions)
                    </span>}
                  </span>
                </div>
              )}
              {labels[2] && (
                <div 
                  style={{ 
                    backgroundColor: 'rgba(75, 192, 95, 0.2)', 
                    padding: '15px', 
                    borderRadius: '8px',
                    borderLeft: '5px solid rgba(75, 192, 95, 1)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>Total Spend</span>
                  <span>
                    {(totals[labels[0]] != null && totals[labels[1]] != null) ? 
                      ((totals[labels[0]] + totals[labels[1]]) < 0 ? 
                        `-$${Math.abs(totals[labels[0]] + totals[labels[1]]).toFixed(2)}` : 
                        `$${(totals[labels[0]] + totals[labels[1]]).toFixed(2)}`)
                      : '$0.00'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {activeTab === 'budgets' && <Budgets helpTextVisible={helpTextVisible} onChartClick={handleBudgetChartClick} />}
    </div>
  );
};

export default App;