// Budgets.jsx
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
  LogarithmicScale
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const defaultBudgets = {
  Vehicle: 100.00,
  Entertainment: 25.00,
  Food: 500.00,
  Home: 75.00,
  Medical: 25.00,
  "Personal Items": 107.50,
  Travel: 50.00,
  Other: 117.50,
  Mortgage: 3000.00,
  Bills: 1000.00,
  Savings: 1000.00,
  Gifts: 200.00,
  Holidays: 400.00,
};

// Default order of categories
const defaultCategoryOrder = [
  'Vehicle', 
  'Entertainment', 
  'Food', 
  'Home', 
  'Medical', 
  'Personal Items', 
  'Travel', 
  'Other',
  'Mortgage',
  'Bills',
  'Savings',
  'Gifts',
  'Holidays'
];

// Categories for monthly spend calculation (Vehicle through Other)
const monthlySpendCategories = [
  'Vehicle', 
  'Entertainment', 
  'Food', 
  'Home', 
  'Medical', 
  'Personal Items', 
  'Travel', 
  'Other'
];

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

const Budgets = ({ helpTextVisible = true, onChartClick }) => {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState(defaultBudgets);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [categoryMappings, setCategoryMappings] = useState({});
  const [categoryOrder, setCategoryOrder] = useState(() => {
    // Initialize from localStorage or use default
    const savedOrder = localStorage.getItem('categoryOrder');
    return savedOrder ? JSON.parse(savedOrder) : defaultCategoryOrder;
  });
  const [chartData, setChartData] = useState({
    labels: Object.keys(defaultBudgets).filter(cat => cat !== 'Mortgage'),
    datasets: [
      {
        label: 'Budget',
        data: Object.entries(defaultBudgets)
          .filter(([cat]) => cat !== 'Mortgage')
          .map(([_, value]) => value),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
      {
        label: 'Spend',
        data: Array(Object.keys(defaultBudgets).length - 1).fill(0),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
      },
    ]
  });
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [draggedRowStyle, setDraggedRowStyle] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editBudgetValue, setEditBudgetValue] = useState('');
  
  // Reference to hold drag ghost element
  const dragGhostRef = useRef(null);

  // Fetch transactions
  useEffect(() => {
    axios.get('http://localhost:5000/transactions')
      .then(response => {
        setTransactions(response.data);
      })
      .catch(err => {
        console.error('Error fetching transactions:', err);
      });
  }, []);

  // Fetch category mappings
  useEffect(() => {
    axios.get('http://localhost:5000/category-mappings')
      .then(response => {
        setCategoryMappings(response.data);
      })
      .catch(err => {
        console.error('Error fetching category mappings:', err);
      });
  }, []);

  // Function to get category from bank_category using mappings
  const getCategoryFromMapping = (bankCategory) => {
    if (!bankCategory) return null;
    // Only return a value if it exists in the mappings
    return categoryMappings[bankCategory] || null;
  };

  useEffect(() => {
    if (transactions.length > 0) {
    const monthlySpend = calculateMonthlySpend();
    setChartData(createChartData(monthlySpend));
    }
  }, [transactions, budgets, currentMonth, currentYear, categoryMappings]);

  const calculateMonthlySpend = () => {
    const spend = {};
    const labels = ["Jack", "Both"];

    // Initialize spend object with all budget categories
    Object.keys(budgets).forEach(category => {
      spend[category] = { Jack: 0, Both: 0 };
    });

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        const category = getCategoryFromMapping(transaction.bank_category);
        const amount = parseFloat(transaction.amount) || 0;

        if (!spend[category]) {
          spend[category] = { Jack: 0, Both: 0 };
        }

        if (labels.includes(transaction.label)) {
          spend[category][transaction.label] += amount;
        }
      }
    });

    return spend;
  };

  const createChartData = (monthlySpend) => {
    // Filter out Mortgage from chart data
    const filteredCategories = categoryOrder.filter(cat => cat !== 'Mortgage');
    
    const budgetData = filteredCategories.map(label => budgets[label]);
    const spendData = filteredCategories.map(label => {
      const categorySpend = monthlySpend[label] || { Jack: 0, Both: 0 };
      return Math.abs(-(categorySpend.Jack || 0) - (categorySpend.Both || 0) / 2); // Use absolute values for log scale
    });

    return {
      labels: filteredCategories,
      datasets: [
        {
          label: 'Budget',
          data: budgetData,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
        {
          label: 'Spend',
          data: spendData,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
      ],
    };
  };

  const handleBudgetChange = (category, value) => {
    setBudgets(prev => ({ ...prev, [category]: parseFloat(value) }));
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => (prev === 0 ? 11 : prev - 1));
    setCurrentYear(prev => (currentMonth === 0 ? prev - 1 : prev));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => (prev === 11 ? 0 : prev + 1));
    setCurrentYear(prev => (currentMonth === 11 ? prev + 1 : prev));
  };

  // Calculate summary data
  const calculateSummaryData = () => {
    if (transactions.length === 0) return { monthlySpend: 0, totalSpend: 0, monthlyBudget: 0, totalBudget: 0 };
    
    const spend = calculateMonthlySpend();
    
    // Calculate monthly spend total (Vehicle through Other)
    let monthlySpendTotal = 0;
    let monthlyBudgetTotal = 0;
    
    monthlySpendCategories.forEach(category => {
      const categorySpend = spend[category] || { Jack: 0, Both: 0 };
      monthlySpendTotal += (categorySpend.Jack || 0) + (categorySpend.Both || 0) / 2;
      monthlyBudgetTotal += budgets[category] || 0;
    });
    
    // Calculate total spend (all categories)
    let totalSpendAmount = 0;
    let totalBudgetAmount = 0;
    
    categoryOrder.forEach(category => {
      const categorySpend = spend[category] || { Jack: 0, Both: 0 };
      // For all categories except Mortgage, use actual spending
      if (category !== 'Mortgage') {
        totalSpendAmount += (categorySpend.Jack || 0) + (categorySpend.Both || 0) / 2;
      } else {
        // For Mortgage, we'll add the hardcoded 3000 later
        // Just add the budget amount
      }
      totalBudgetAmount += budgets[category] || 0;
    });
    
    // Add hardcoded -3000 for Mortgage to totalSpendAmount
    totalSpendAmount += 3000; // Adding positive 3000 since we'll negate it later
    
    return {
      monthlySpend: monthlySpendTotal, // Negate for display
      totalSpend: -totalSpendAmount, // Negate for display
      monthlyBudget: monthlyBudgetTotal,
      totalBudget: totalBudgetAmount
    };
  };
  
  const summaryData = calculateSummaryData();

  // Enhanced drag and drop handling functions
  const handleDragStart = (e, category, rowElement) => {
    // Only proceed if the drag started from a category name cell
    if (!e.target.classList.contains('category-name-cell')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    setDraggedCategory(category);    
    // Fix for Firefox which may show default ghost image as well
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a custom drag image that shows the entire row
    const dragGhost = document.createElement('table');
    dragGhost.className = 'drag-ghost';
    dragGhost.style.position = 'absolute';
    dragGhost.style.top = '-1000px';
    dragGhost.style.opacity = '1.0'; // Full opacity
    dragGhost.style.backgroundColor = '#fff';
    dragGhost.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
    dragGhost.style.width = rowElement.offsetWidth + 'px';
    dragGhost.style.borderCollapse = 'collapse';
    dragGhost.style.border = '2px solid #2196F3';
    dragGhost.style.zIndex = '9999'; // Ensure it's on top
    
    // Save to ref for cleanup later
    dragGhostRef.current = dragGhost;
    
    // Clone the row content with complete styling
    const clonedRow = rowElement.cloneNode(true);
    clonedRow.style.opacity = '1.0'; // Ensure full opacity
    clonedRow.style.backgroundColor = 'white';
    
    // Make sure all cells in the cloned row are visible
    Array.from(clonedRow.children).forEach(cell => {
      cell.style.opacity = '1';
      cell.style.backgroundColor = 'white';
      cell.style.color = 'black';
      cell.style.border = '1px solid #2196F3';
    });
    
    // Make sure the drag ghost has the same structure as a table
    const tbody = document.createElement('tbody');
    tbody.appendChild(clonedRow);
    dragGhost.appendChild(tbody);
    
    // Add to document for drag image
    document.body.appendChild(dragGhost);
    
    // Set the drag image to our custom element
    e.dataTransfer.setDragImage(dragGhost, 20, 20);
    
    // Add custom attribute for CSS targeting
    rowElement.setAttribute('dragging', 'true');
    
    // Set styles while dragging
    setDraggedRowStyle({
      opacity: 0.85, // Higher opacity
      backgroundColor: 'rgba(173, 216, 230, 0.8)',
      border: '2px solid #2196F3'
    });
  };

  const handleDragOver = (e, category) => {
    e.preventDefault();
    // Add indication that item can be dropped here
    e.currentTarget.style.borderTop = category !== draggedCategory 
      ? '2px solid #4CAF50' 
      : '';
    
    if (draggedCategory && draggedCategory !== category) {
      // Create a new order by swapping positions
      const newOrder = [...categoryOrder];
      const dragIndex = newOrder.indexOf(draggedCategory);
      const dropIndex = newOrder.indexOf(category);
      
      if (dragIndex !== -1 && dropIndex !== -1) {
        // Remove from old position and add at new position
        newOrder.splice(dragIndex, 1);
        newOrder.splice(dropIndex, 0, draggedCategory);
        
        // Save the new order
        setCategoryOrder(newOrder);
        localStorage.setItem('categoryOrder', JSON.stringify(newOrder));
      }
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = 'rgba(173, 216, 230, 0.2)';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '';
    e.currentTarget.style.borderTop = '';
  };

  const handleDragEnd = (e) => {
    setDraggedCategory(null);
    setDraggedRowStyle(null);
    
    // Remove all temporary styles from table rows
    document.querySelectorAll('tr').forEach(row => {
      row.style.borderTop = '';
      row.style.backgroundColor = '';
      row.removeAttribute('dragging');
    });
    
    // Clean up the drag ghost element
    if (dragGhostRef.current) {
      try {
        document.body.removeChild(dragGhostRef.current);
      } catch(err) {
        console.log('Drag ghost already removed');
      }
      dragGhostRef.current = null;
    }
    
    // Force redraw on some browsers
    setTimeout(() => {
      document.querySelectorAll('.drag-row').forEach(row => {
        row.style.opacity = '1';
      });
    }, 50);
  };

  const handleDrop = (e, category) => {
    e.preventDefault();
    // Reset styles
    e.currentTarget.style.backgroundColor = '';
    e.currentTarget.style.borderTop = '';
  };

  // Add a formatter function for currency display
  const formatCurrency = (amount) => {
    const absAmount = Math.abs(amount);
    return amount < 0 
      ? `-$${absAmount.toFixed(2)}` 
      : `$${absAmount.toFixed(2)}`;
  };

  // Chart options with logarithmic scale
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        type: 'logarithmic',
        min: 1, // Start at 1 to avoid log(0) which is -Infinity
        title: {
          display: true,
          text: 'Amount (logarithmic scale)'
        },
        grid: {
          // Reduce number of grid lines
          tickLength: 10
        },
        ticks: {
          // Limit the number of ticks to reduce clutter
          autoSkip: true,
          maxTicksLimit: 6,
          // Show specific values on the y-axis with proper formatting
          callback: function(tickValue, index, ticks) {
            // For a logarithmic scale, use specific values that make sense
            const valuesToShow = [1, 10, 50, 100, 500, 1000, 5000];
            
            // Check if this is close to one of our preferred values
            for (let i = 0; i < valuesToShow.length; i++) {
              const preferredValue = valuesToShow[i];
              // If it's within 10% of our preferred value, show it
              if (tickValue >= preferredValue * 0.9 && tickValue <= preferredValue * 1.1) {
                return formatCurrency(preferredValue);
              }
            }
            return ''; // Hide other tick values
          },
          font: {
            size: 11 // Slightly smaller font for tick labels
          }
        }
      },
      x: {
        ticks: {
          // Wrap long category names
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y);
            }
            return label;
          }
        }
      },
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Budget vs. Spending (Logarithmic Scale)',
        font: {
          size: 16
        }
      }
    },
    // Add onClick handler that includes current month and year
    onClick: (event, elements) => {
      if (elements.length > 0 && onChartClick) {
        const element = elements[0];
        const datasetIndex = element.datasetIndex;
        
        // Only handle clicks on the Spend dataset (index 1)
        if (datasetIndex === 1) {
          const categoryIndex = element.index;
          const category = chartData.labels[categoryIndex];
          
          // Call the navigation function with category, month, and year
          onChartClick(category, currentMonth, currentYear);
        }
      }
    }
  };

  // Handle double click on budget cell
  const handleBudgetDoubleClick = (category, value) => {
    setEditingBudget(category);
    setEditBudgetValue(value.toString());
  };

  // Handle budget input change
  const handleBudgetInputChange = (e) => {
    setEditBudgetValue(e.target.value);
  };

  // Handle budget edit completion
  const handleBudgetEditDone = () => {
    if (editingBudget && editBudgetValue) {
      const numValue = parseFloat(editBudgetValue);
      if (!isNaN(numValue)) {
        handleBudgetChange(editingBudget, numValue);
      }
    }
    setEditingBudget(null);
  };

  // Handle key press in budget edit
  const handleBudgetKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleBudgetEditDone();
    } else if (e.key === 'Escape') {
      setEditingBudget(null);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 className="section-title">Monthly Expenditure</h2>
      <div className="month-navigation">
        <button 
          className="modern-button navigation" 
          onClick={handlePrevMonth}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Previous Month
        </button>
        <div className="month-display">
          {`${new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })} ${currentYear}`}
        </div>
        <button 
          className="modern-button navigation" 
          onClick={handleNextMonth}
        >
          Next Month
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      
      <HelpText isVisible={helpTextVisible}>
        Drag categories by clicking and dragging the category name cell. Red highlight indicates categories over budget.
      </HelpText>
      
      {/* Add CSS styles for drag and drop */}
      <style>
      {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        .month-display {
          font-family: 'Inter', sans-serif;
          font-size: 18px;
          font-weight: 500;
          padding: 0 20px;
          color: #2c3e50;
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
        
        .drag-row {
          cursor: default; /* Change default cursor */
        }
        
        .category-name-cell {
          cursor: move; /* Only show move cursor on category name cell */
          position: relative;
        }
        
        .category-name-cell::after {
          content: '⋮⋮';
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #777;
          font-size: 14px;
          opacity: 0.7;
        }
        
        .category-name-cell:hover::after {
          opacity: 1;
        }
        
        .drag-row:hover {
          background-color: rgba(240, 240, 240, 0.5);
        }
        
        .drag-row.dragging {
          opacity: 0.85;
          background-color: rgba(173, 216, 230, 0.8);
          border: 2px solid #2196F3;
        }
        
        .drag-ghost {
          cursor: grabbing;
          border-collapse: collapse;
          opacity: 1 !important;
          z-index: 9999;
        }
        
        .drag-ghost td, .drag-ghost th {
          border: 1px solid #2196F3;
          padding: 8px;
          opacity: 1 !important;
          background-color: white !important;
        }
        
        /* Override any default browser drag opacity */
        [dragging="true"] {
          opacity: 1 !important;
        }
        
        .budget-cell {
          cursor: pointer;
          position: relative;
        }
        
        .budget-cell:hover {
          background-color: rgba(240, 240, 240, 0.5);
        }
        
        .budget-cell:hover::after {
          content: '✎';
          position: absolute;
          right: 10px;
          opacity: 0.6;
        }
        
        .budget-input {
          width: 100%;
          padding: 6px;
          border: 2px solid #2196F3;
          border-radius: 4px;
          font-size: 14px;
        }

        /* Modern button styles */
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

        .modern-button.primary {
          background-color: #3498db;
          color: white;
          border: 1px solid #2980b9;
        }

        .modern-button.primary:hover {
          background-color: #2980b9;
        }

        .modern-button.primary:active {
          background-color: #2471a3;
        }

        .modern-button.navigation {
          display: inline-flex;
          align-items: center;
          padding: 8px 15px;
        }

        .modern-button.navigation svg {
          margin: 0 5px;
        }

        /* Month navigation controls */
        .month-navigation {
          display: flex;
          margin-bottom: 20px;
          align-items: center;
        }
      `}
      </style>
      
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid black', padding: '8px' }}>Category</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>Budget</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>Total Spend</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>Remaining Balance</th>
          </tr>
        </thead>
        <tbody>
          {categoryOrder.map((category, index) => {
            const budget = budgets[category];
            
            // For Mortgage, hardcode the spend as -3000
            let totalSpend;
            let remainingBalance;
            
            if (category === 'Mortgage') {
              totalSpend = 3000;
              remainingBalance = budget - Math.abs(totalSpend);
            } else {
              const spend = (transactions.length > 0 ? calculateMonthlySpend() : {})[category] || { Jack: 0, Both: 0 };
              totalSpend = -(spend.Jack + spend.Both / 2);
              remainingBalance = budget - Math.abs(totalSpend);
            }

            // Calculate if this category is over budget for styling
            const isOverBudget = Math.abs(totalSpend) > budget;

            return (
              <tr 
                key={index}
                className={`drag-row ${draggedCategory === category ? 'dragging' : ''}`}
                style={draggedCategory === category ? draggedRowStyle : {}}
              >
                <td 
                  draggable
                  onDragStart={(e) => handleDragStart(e, category, e.target.parentElement)}
                  onDragOver={(e) => handleDragOver(e, category)}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, category)}
                  className="category-name-cell"
                  style={{ 
                    border: '1px solid black', 
                    padding: '8px',
                    backgroundColor: isOverBudget ? 'rgba(255, 200, 200, 0.3)' : 'transparent'
                  }}
                >
                  {category}
                </td>
                <td 
                  className="budget-cell"
                  onDoubleClick={() => handleBudgetDoubleClick(category, budget)}
                  style={{ 
                    border: '1px solid black', 
                    padding: '8px',
                    backgroundColor: isOverBudget ? 'rgba(255, 200, 200, 0.1)' : 'transparent'
                  }}
                >
                  {editingBudget === category ? (
                  <input
                    type="number"
                      className="budget-input"
                      value={editBudgetValue}
                      onChange={handleBudgetInputChange}
                      onBlur={handleBudgetEditDone}
                      onKeyDown={handleBudgetKeyPress}
                      autoFocus
                    />
                  ) : (
                    formatCurrency(budget)
                  )}
                </td>
                <td 
                  style={{ 
                    border: '1px solid black', 
                    padding: '8px',
                    color: isOverBudget ? '#d32f2f' : 'inherit',
                    fontWeight: isOverBudget ? 'bold' : 'normal',
                    backgroundColor: isOverBudget ? 'rgba(255, 200, 200, 0.3)' : 'transparent'
                  }}
                >
                  {formatCurrency(totalSpend)}
                </td>
                <td 
                  style={{ 
                    border: '1px solid black', 
                    padding: '8px',
                    color: remainingBalance < 0 ? '#d32f2f' : 'inherit',
                    fontWeight: remainingBalance < 0 ? 'bold' : 'normal',
                    backgroundColor: isOverBudget ? 'rgba(255, 200, 200, 0.3)' : 'transparent'
                  }}
                >
                  {formatCurrency(remainingBalance)}
                </td>
              </tr>
            );
          })}
          
          {/* Monthly Spend Summary Row */}
          <tr style={{ 
            backgroundColor: '#f0f8ff', 
            fontWeight: 'bold',
            borderTop: '2px solid #333'
          }}>
            <td style={{ border: '1px solid black', padding: '8px' }}>Monthly Spend</td>
            <td style={{ border: '1px solid black', padding: '8px' }}>{formatCurrency(summaryData.monthlyBudget)}</td>
            <td style={{ border: '1px solid black', padding: '8px' }}>{formatCurrency(summaryData.monthlySpend)}</td>
            <td style={{ border: '1px solid black', padding: '8px' }}>{formatCurrency(summaryData.monthlyBudget - Math.abs(summaryData.monthlySpend))}</td>
          </tr>
          
          {/* Total Spend Summary Row */}
          <tr style={{ 
            backgroundColor: '#e6f7ff', 
            fontWeight: 'bold',
            borderTop: '1px solid #333'
          }}>
            <td style={{ border: '1px solid black', padding: '8px' }}>Total</td>
            <td style={{ border: '1px solid black', padding: '8px' }}>{formatCurrency(summaryData.totalBudget)}</td>
            <td style={{ border: '1px solid black', padding: '8px' }}>{formatCurrency(summaryData.totalSpend)}</td>
            <td style={{ border: '1px solid black', padding: '8px' }}>{formatCurrency(summaryData.totalBudget - Math.abs(summaryData.totalSpend))}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ width: '90%', maxWidth: '1200px', height: '400px', margin: '30px auto' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
      
      <HelpText isVisible={helpTextVisible}>
        Chart uses logarithmic scale to better visualize both small and large amounts
      </HelpText>
    </div>
  );
};

export default Budgets;