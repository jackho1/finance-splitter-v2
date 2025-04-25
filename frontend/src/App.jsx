import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
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

function App() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
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

  // Column filtering states
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [bankCategoryFilter, setBankCategoryFilter] = useState([]);
  const [labelFilter, setLabelFilter] = useState([]);
  const [availableBankCategories, setAvailableBankCategories] = useState([]);
  const filterPopupRef = useRef(null);

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
        
        // Extract unique bank categories and sort them (null values at the end)
        const categories = [...new Set(response.data.map(transaction => transaction.bank_category))]
          .filter(category => category !== null && category !== undefined && category !== '')
          .sort((a, b) => a.localeCompare(b));
        
        // Add null/empty as the last option if they exist in the data
        if (response.data.some(t => !t.bank_category)) {
          categories.push(null);
        }
        
        setAvailableBankCategories(categories);
        // Set loading state to false after successfully fetching data
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

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterPopupRef.current && !filterPopupRef.current.contains(event.target)) {
        setActiveFilterColumn(null);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle category filter change
  const handleCategoryFilterChange = (category) => {
    setCategoryFilter(prev => {
      if (prev.includes(category)) {
        return prev.filter(cat => cat !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Add category filtering to the combined filtering logic
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
        return categoryFilter.includes(category);
      });
    }

    setFilteredTransactions(filtered);

    // Calculate totals using the utility function
    const newTotals = calculateTotals(filtered, labels);
    setTotals(newTotals);
  }, [
    transactions, 
    filters.sortBy, 
    dateFilter, 
    bankCategoryFilter, 
    labelFilter, 
    categoryFilter, 
    labels, 
    categoryMappings
  ]);

  const data = {
    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    datasets: []
  };

  // Create datasets for each category (instead of bank category)
  const uniqueCategories = [...new Set(
    filteredTransactions
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
  const chartFilteredTransactions = filteredTransactions.filter(transaction => {
    if (chartLabelFilter === 'All') {
      return true;
    } else if (chartLabelFilter === labels[0]) { // Ruby
      return transaction.label === labels[0] || transaction.label === labels[2]; 
    } else if (chartLabelFilter === labels[1]) { // Jack
      return transaction.label === labels[1] || transaction.label === labels[2];
    }
    return true;
  });

  uniqueCategories.forEach(category => {
    const categoryData = Array(12).fill(0); // Initialize an array for each month
    
    chartFilteredTransactions.forEach(transaction => {
      const month = new Date(transaction.date).getMonth();
      const transactionCategory = getCategoryFromMapping(transaction.bank_category);
      
      // Skip positive transfer transactions
      if (transactionCategory === category && 
         !(transaction.bank_category === "Transfer" && parseFloat(transaction.amount) > 0)) {
        
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
      backgroundColor: categoryColors.current[category], // Use consistent colors for categories
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
          ? 'Transactions by Month and Category' 
          : `${chartLabelFilter}'s Transactions by Month and Category`,
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
    setEditValue(e.target.value);
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
              value={editValue || ''} 
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

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Transactions</h1>

      {/* Show loading indicator when updating a transaction */}
      {isUpdating && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.3)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ marginBottom: '15px' }}>Updating transaction...</div>
            <LoadingSpinner />
          </div>
        </div>
      )}

      <div>
        {/* Active filters display */}
        {(dateFilter.startDate || bankCategoryFilter.length > 0 || labelFilter.length > 0 || categoryFilter.length > 0) && (
          <div style={{ margin: '10px 0', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>Active Filters:</strong>
                {dateFilter.startDate && (
                  <span style={{ margin: '0 10px' }}>
                    Date: {dateFilter.startDate} to {dateFilter.endDate}
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
              <button onClick={clearFilters}>Clear All Filters</button>
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
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    height: '34px',
                    boxSizing: 'border-box'
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
                  onClick={() => setActiveFilterColumn(activeFilterColumn === 'categoryFilter' ? null : 'categoryFilter')}
                  style={{ 
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: categoryFilter.length > 0 ? '#e6f7ff' : 'white',
                    cursor: 'pointer',
                    height: '34px',
                    boxSizing: 'border-box'
                  }}
                >
                  Filter by Category {categoryFilter.length > 0 ? `(${categoryFilter.length})` : ''}
                </button>
                
                {activeFilterColumn === 'categoryFilter' && (
                  <div 
                    ref={filterPopupRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
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
                    {availableCategories
                      .filter(category => category !== null && category !== undefined && category !== '')
                      .map(category => (
                        <div key={category} style={{ marginBottom: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={categoryFilter.includes(category)}
                              onChange={() => handleCategoryFilterChange(category)}
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
                        <label style={{ display: 'flex', alignItems: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={categoryFilter.includes(null)}
                            onChange={() => handleCategoryFilterChange(null)}
                            style={{ marginRight: '8px' }}
                          />
                          null
                        </label>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                      <button 
                        onClick={() => setCategoryFilter([])}
                        style={{ padding: '4px 8px' }}
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => setActiveFilterColumn(null)}
                        style={{ padding: '4px 8px' }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ width: '90%', maxWidth: '1200px', height: '400px' }}>
              <Bar data={data} options={options} />
            </div>
          </>
        )}
      </div>

      <h2 style={{ marginTop: '30px' }}>Filtered Transactions</h2>
      <div style={{ marginBottom: '15px' }}>
        <label>
          Sort by:
          <select value={filters.sortBy} onChange={e => setFilters({ ...filters, sortBy: e.target.value })} style={{ marginLeft: '8px' }}>
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
          </select>
        </label>
      </div>

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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <button 
                        onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                        style={{ padding: '4px 8px' }}
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => setActiveFilterColumn(null)}
                        style={{ padding: '4px 8px' }}
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
                    
                    {/* Display null/empty category at the bottom if it exists */}
                    {availableBankCategories.some(category => category === null || category === undefined || category === '') && (
                      <div style={{ marginBottom: '6px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={bankCategoryFilter.includes(null)}
                            onChange={() => handleBankCategoryFilterChange(null)}
                            style={{ marginRight: '8px' }}
                          />
                          (Empty)
                        </label>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                      <button 
                        onClick={() => setBankCategoryFilter([])}
                        style={{ padding: '4px 8px' }}
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => setActiveFilterColumn(null)}
                        style={{ padding: '4px 8px' }}
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
                        style={{ padding: '4px 8px' }}
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => setActiveFilterColumn(null)}
                        style={{ padding: '4px 8px' }}
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

      <h2>Totals</h2>
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
                    `$${totals[labels[0]].toFixed(2)}`) : 
                  '$0.00'}
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
                    `$${totals[labels[1]].toFixed(2)}`) : 
                  '$0.00'}
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
                {totals[labels[2]] != null ? 
                  (totals[labels[2]] < 0 ? 
                    `-$${Math.abs(totals[labels[2]]).toFixed(2)}` : 
                    `$${totals[labels[2]].toFixed(2)}`) : 
                  '$0.00'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;