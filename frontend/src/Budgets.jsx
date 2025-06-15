// Budgets.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { USER_CONFIG } from './config/userConfig';
import { valuesAreEqual } from './utils/updateHandlers';
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

// Refactored budget calculation function that uses configuration
const calculateCategorySpend = (spend, category) => {
  const { PRIMARY_USER_2, BOTH_LABEL } = USER_CONFIG;
  
  // Using configuration values instead of hardcoded names
  const categorySpend = spend[category] || { [PRIMARY_USER_2]: 0, [BOTH_LABEL]: 0 };
  
  // Refactored calculation using configuration values
  const totalSpend = -(categorySpend[PRIMARY_USER_2] + categorySpend[BOTH_LABEL] / 2);
  return totalSpend;
};

const Budgets = ({ helpTextVisible = true, onChartClick }) => {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [monthlySpendCategories, setMonthlySpendCategories] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-11 (JavaScript native)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [categoryMappings, setCategoryMappings] = useState({});
  const [categoryOrder, setCategoryOrder] = useState(() => {
    // Initialize from localStorage or use empty array
    const savedOrder = localStorage.getItem('categoryOrder');
    return savedOrder ? JSON.parse(savedOrder) : [];
  });
  const [loading, setLoading] = useState(true);
  
  // Get user labels from configuration
  const { PRIMARY_USER_2, BOTH_LABEL } = USER_CONFIG;

  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Budget',
        data: [],
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
      {
        label: 'Spend',
        data: [],
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

  // Function to get category from bank_category using mappings
  const getCategoryFromMapping = (bankCategory) => {
    if (!bankCategory) return null;
    // Only return a value if it exists in the mappings
    return categoryMappings[bankCategory] || null;
  };

  // Combined useEffect to fetch all initial data sequentially to avoid overwhelming database connections
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      
      try {
        // Single API call to get all budget initial data
        const response = await axios.get('http://localhost:5000/budget-initial-data');
        
        if (response.data.success) {
          const { budgetCategories, transactions, categoryMappings } = response.data.data;
          
          // Set budget categories
          setBudgetCategories(budgetCategories);
          
          // Convert to budgets object for easier access
          const budgetsObj = {};
          const categories = [];
          budgetCategories.forEach(item => {
            budgetsObj[item.category] = item.budget;
            categories.push(item.category);
          });
          setBudgets(budgetsObj);
          
          // Set up monthly spend categories (exclude Mortgage, Bills, Savings, Gifts, Holidays)
          const monthlyCategories = categories.filter(cat => 
            !['Mortgage', 'Bills', 'Savings', 'Gifts', 'Holidays'].includes(cat)
          );
          setMonthlySpendCategories(monthlyCategories);
          
          // Set transactions and category mappings
          setTransactions(transactions);
          setCategoryMappings(categoryMappings);
          
          setLoading(false);
        } else {
          throw new Error(response.data.error || 'Failed to fetch budget initial data');
        }
      } catch (error) {
        console.error('Error fetching budget initial data:', error);
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (transactions.length > 0 && Object.keys(budgets).length > 0) {
      const monthlySpend = calculateMonthlySpend();
      setChartData(createChartData(monthlySpend));
    }
  }, [transactions, budgets, currentMonth, currentYear, categoryMappings, categoryOrder]);

  // Update category order when budgets are loaded
  useEffect(() => {
    if (budgetCategories.length > 0 && categoryOrder.length === 0) {
      const categories = budgetCategories.map(bc => bc.category);
      const savedOrder = localStorage.getItem('categoryOrder');
      
      if (savedOrder) {
        try {
          const parsedOrder = JSON.parse(savedOrder);
          // Validate that saved order contains valid categories
          const validCategories = parsedOrder.filter(cat => categories.includes(cat));
          // Add any new categories that aren't in saved order
          const newCategories = categories.filter(cat => !validCategories.includes(cat));
          const finalOrder = [...validCategories, ...newCategories];
          setCategoryOrder(finalOrder);
          localStorage.setItem('categoryOrder', JSON.stringify(finalOrder));
        } catch (error) {
          console.error('Error parsing saved category order:', error);
          setCategoryOrder(categories);
          localStorage.setItem('categoryOrder', JSON.stringify(categories));
        }
      } else {
        setCategoryOrder(categories);
        localStorage.setItem('categoryOrder', JSON.stringify(categories));
      }
    }
  }, [budgetCategories, categoryOrder.length]);

  const calculateMonthlySpend = () => {
    const spend = {};
    const labels = [PRIMARY_USER_2, BOTH_LABEL];

    // Initialize spend object with all budget categories
    Object.keys(budgets).forEach(category => {
      spend[category] = { [PRIMARY_USER_2]: 0, [BOTH_LABEL]: 0 };
    });

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        // Use the category field directly from the transaction instead of mapping from bank_category
        const category = transaction.category;
        const amount = parseFloat(transaction.amount) || 0;

        // Only process if we have a valid category AND it exists in our budgets
        if (category && spend[category]) {
          if (labels.includes(transaction.label)) {
            spend[category][transaction.label] += amount;
          }
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
      // Use the helper function and get absolute value for the chart
      return Math.abs(calculateCategorySpend(monthlySpend, label));
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

  const handleBudgetChange = async (category, value) => {
    // Find the budget category ID
    const budgetCategory = budgetCategories.find(bc => bc.category === category);
    if (!budgetCategory) {
      console.error('Budget category not found:', category);
      return;
    }
    
    try {
      // Get current budget value for comparison
      const currentBudget = budgets[category];
      const newBudget = parseFloat(value);
      
      // OPTIMIZATION: Check if the budget value has actually changed before sending request
      if (valuesAreEqual(currentBudget, newBudget, 'number')) {
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

      const response = await axios.put(`http://localhost:5000/budget-categories/${budgetCategory.id}`, {
        budget: newBudget
      });
      
      if (response.data.success) {
        // Update local state
        setBudgets(prev => ({ ...prev, [category]: newBudget }));
        
        // Update the budgetCategories array as well
        setBudgetCategories(prev => 
          prev.map(bc => 
            bc.id === budgetCategory.id 
              ? { ...bc, budget: newBudget }
              : bc
          )
        );
        
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
      } else {
        console.error('Failed to update budget:', response.data.error);
      }
    } catch (error) {
      console.error('Error updating budget:', error);
    }
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
    if (transactions.length === 0 || Object.keys(budgets).length === 0 || monthlySpendCategories.length === 0) {
      return { monthlySpend: 0, totalSpend: 0, monthlyBudget: 0, totalBudget: 0 };
    }
    
    const spend = calculateMonthlySpend();
    
    // Calculate monthly spend total (exclude non-monthly categories)
    let monthlySpendTotal = 0;
    let monthlyBudgetTotal = 0;
    
    monthlySpendCategories.forEach(category => {
      if (budgets[category] !== undefined) {
        // Use helper function for consistent calculation
        monthlySpendTotal += Math.abs(calculateCategorySpend(spend, category));
        monthlyBudgetTotal += parseFloat(budgets[category]) || 0;
      }
    });
    
    // Calculate total spend (all categories including Mortgage)
    let totalSpendAmount = 0;
    let totalBudgetAmount = 0;
    
    categoryOrder.forEach(category => {
      if (budgets[category] !== undefined) {
        if (category === 'Mortgage') {
          totalSpendAmount += 3000;
        } else {
          totalSpendAmount += Math.abs(calculateCategorySpend(spend, category));
        }
        totalBudgetAmount += parseFloat(budgets[category]) || 0;
      }
    });
    
    return {
      monthlySpend: monthlySpendTotal,
      totalSpend: totalSpendAmount,
      monthlyBudget: monthlyBudgetTotal,
      totalBudget: totalBudgetAmount
    };
  };
  
  const summaryData = useMemo(() => {
    return calculateSummaryData();
  }, [transactions, budgets, monthlySpendCategories, currentMonth, currentYear, categoryOrder, categoryMappings]);

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
        // Drag ghost already removed
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
          
          // Call the navigation function with category, month (keep in 0-11 format), and year
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

  // Show loading state
  if (loading) {
    return (
      <div style={{ padding: '15px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
        <h2 className="section-title">Monthly Expenditure</h2>
        <div style={{ padding: '50px' }}>Loading budget data...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '15px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}>
          <button 
            className="modern-button navigation prev" 
            onClick={handlePrevMonth}
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
            {`${new Date(currentYear, currentMonth).toLocaleString('default', { month: 'short' })} ${currentYear}`}
          </div>
          <button 
            className="modern-button navigation next" 
            onClick={handleNextMonth}
          >
            Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <h2 className="section-title" style={{ margin: 0, textAlign: 'center' }}>
          Monthly Expenditure
        </h2>
        
        <div></div>
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
          font-size: 16px;
          font-weight: 500;
          padding: 0 15px;
          color: #2c3e50;
        }
        
        .help-text {
          display: flex;
          align-items: flex-start;
          background-color: #f8f9fa;
          padding: 8px 12px;
          border-radius: 6px;
          border-left: 3px solid #4a90e2;
          margin-bottom: 12px;
          font-size: 12px;
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

        /* Month navigation controls */
        .month-navigation {
          display: flex;
          margin-bottom: 15px;
          align-items: center;
        }
        
        /* Modern table styling */
        .modern-table-container {
          margin-top: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          background-color: #ffffff;
        }
        
        .modern-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Inter', sans-serif;
          color: #1a202c;
        }
        
        .modern-table thead {
          background-color: #f7fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .modern-table th {
          padding: 8px 10px;
          text-align: left;
          font-weight: 600;
          font-size: 0.85rem;
          color: #4a5568;
          border: none;
          white-space: nowrap;
        }
        
        .modern-table td {
          padding: 6px 10px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          border-left: none;
          border-right: none;
          vertical-align: middle;
          font-size: 0.9rem;
          text-align: left;
        }
        
        .modern-table tr:hover {
          background-color: #f7fafc;
        }
        
        .empty-state {
          text-align: center;
          padding: 32px;
          color: #718096;
        }
        
        .empty-state h3 {
          font-weight: 500;
          font-size: 1.125rem;
          margin-bottom: 8px;
        }
        
        .empty-state p {
          font-size: 0.875rem;
        }
        
        /* Amount styling */
        .amount-negative {
          color: #e53e3e;
          font-weight: 500;
        }
        
        .amount-positive {
          color: #38a169;
          font-weight: 500;
        }
        
        .row-expense {
          background-color: rgba(255, 240, 240, 0.1);
        }
        
        .row-income {
          background-color: rgba(240, 255, 240, 0.1);
        }
        
        .action-buttons {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        
        /* Progress bar for budget tracking */
        .budget-progress {
          width: 100%;
          height: 6px;
          background-color: #edf2f7;
          border-radius: 3px;
          overflow: hidden;
          margin-top: 2px;
        }
        
        .budget-progress-bar {
          height: 100%;
          transition: width 0.3s ease;
        }
        
        /* Category indicator */
        .category-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
        }
        
        /* Summary rows styling */
        .summary-row {
          font-weight: 600;
          background-color: #f1f5f9;
          border-top: 2px solid #cbd5e1;
        }
        
        .summary-row td {
          padding-top: 10px;
          padding-bottom: 10px;
          font-size: 0.95rem;
        }
        
        .total-row {
          font-weight: 700;
          background-color: #e0f2fe;
          border-top: 2px solid #7dd3fc;
          border-bottom: 2px solid #7dd3fc;
        }
        
        .total-row td {
          padding-top: 10px;
          padding-bottom: 10px;
          font-size: 1rem;
        }
        
        .modern-table td, .modern-table th {
          line-height: 1.1;
        }
      `}
      </style>
      
      <div className="modern-table-container">
        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Category</th>
              <th style={{ textAlign: 'left' }}>Budget</th>
              <th style={{ textAlign: 'left' }}>Actual Spend</th>
              <th style={{ textAlign: 'left' }}>Remaining</th>
              <th style={{ textAlign: 'left', minWidth: '120px' }}>Progress</th>
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
                // Use the helper function for consistent calculation
                const spend = transactions.length > 0 ? calculateMonthlySpend() : {};
                totalSpend = calculateCategorySpend(spend, category);
                remainingBalance = budget - Math.abs(totalSpend);
              }
              
              // Calculate if this category is over budget for styling
              const isOverBudget = Math.abs(totalSpend) > budget;
              
              // Calculate progress percentage
              const progressPercentage = budget !== 0 ? (Math.abs(totalSpend) / budget) * 100 : 0;
              
              // Generate a stable color based on category name
              const getColorFromString = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                  hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }
                const hue = Math.abs(hash % 360);
                return `hsl(${hue}, 70%, 50%)`;
              };
              
              const categoryColor = getColorFromString(category);

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
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div className="category-indicator" style={{ backgroundColor: categoryColor }} />
                      {category}
                    </div>
                  </td>
                  <td 
                    className="budget-cell"
                    onDoubleClick={() => handleBudgetDoubleClick(category, budget)}
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
                      <span className="amount-positive">
                        {formatCurrency(budget)}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="amount-negative">
                      {formatCurrency(totalSpend)}
                    </span>
                  </td>
                  <td>
                    <span className={remainingBalance < 0 ? 'amount-negative' : 'amount-positive'}>
                      {formatCurrency(remainingBalance)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', width: '100%' }}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>
                          {progressPercentage.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>
                          {isOverBudget ? 'Over' : 'Under'}
                        </span>
                      </div>
                      <div className="budget-progress" style={{ height: '7px' }}>
                        <div 
                          className="budget-progress-bar"
                          style={{
                            width: `${Math.min(progressPercentage, 100)}%`,
                            backgroundColor: isOverBudget ? '#ef4444' : '#10b981',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {/* Monthly Spend Summary Row */}
            <tr className="summary-row">
              <td>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="category-indicator" style={{ backgroundColor: '#4299e1', width: '10px', height: '10px', boxShadow: '0 0 0 2px rgba(66, 153, 225, 0.2)' }} />
                  <strong>Monthly Spend</strong>
                </div>
              </td>
              <td>
                <span className="amount-positive" style={{ fontSize: '0.95rem' }}>{formatCurrency(summaryData.monthlyBudget)}</span>
              </td>
              <td style={{ textAlign: 'left' }}>
                <span className="amount-negative" style={{ fontSize: '0.95rem' }}>{formatCurrency(summaryData.monthlySpend)}</span>
              </td>
              <td>
                <span className={summaryData.monthlyBudget - Math.abs(summaryData.monthlySpend) < 0 ? 'amount-negative' : 'amount-positive'} style={{ fontSize: '0.95rem' }}>
                  {formatCurrency(summaryData.monthlyBudget - Math.abs(summaryData.monthlySpend))}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', width: '100%' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>
                      {(summaryData.monthlyBudget ? (Math.abs(summaryData.monthlySpend) / summaryData.monthlyBudget) * 100 : 0).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>
                      {summaryData.monthlyBudget - Math.abs(summaryData.monthlySpend) < 0 ? 'Over' : 'Under'}
                    </span>
                  </div>
                  <div className="budget-progress" style={{ height: '7px' }}>
                    <div 
                      className="budget-progress-bar"
                      style={{
                        width: `${Math.min(summaryData.monthlyBudget ? (Math.abs(summaryData.monthlySpend) / summaryData.monthlyBudget) * 100 : 0, 100)}%`,
                        backgroundColor: summaryData.monthlyBudget - Math.abs(summaryData.monthlySpend) < 0 ? '#ef4444' : '#10b981',
                      }}
                    />
                  </div>
                </div>
              </td>
            </tr>
            
            {/* Total Spend Summary Row */}
            <tr className="total-row">
              <td>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="category-indicator" style={{ backgroundColor: '#38b2ac', width: '12px', height: '12px', boxShadow: '0 0 0 2px rgba(56, 178, 172, 0.3)' }} />
                  <strong>Total</strong>
                </div>
              </td>
              <td>
                <span className="amount-positive" style={{ fontSize: '1rem' }}>{formatCurrency(summaryData.totalBudget)}</span>
              </td>
              <td style={{ textAlign: 'left' }}>
                <span className="amount-negative" style={{ fontSize: '1rem' }}>{formatCurrency(summaryData.totalSpend)}</span>
              </td>
              <td>
                <span className={summaryData.totalBudget - Math.abs(summaryData.totalSpend) < 0 ? 'amount-negative' : 'amount-positive'} style={{ fontSize: '1rem' }}>
                  {formatCurrency(summaryData.totalBudget - Math.abs(summaryData.totalSpend))}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', width: '100%' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                      {(summaryData.totalBudget ? (Math.abs(summaryData.totalSpend) / summaryData.totalBudget) * 100 : 0).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                      {summaryData.totalBudget - Math.abs(summaryData.totalSpend) < 0 ? 'Over' : 'Under'}
                    </span>
                  </div>
                  <div className="budget-progress" style={{ height: '8px' }}>
                    <div 
                      className="budget-progress-bar"
                      style={{
                        width: `${Math.min(summaryData.totalBudget ? (Math.abs(summaryData.totalSpend) / summaryData.totalBudget) * 100 : 0, 100)}%`,
                        backgroundColor: summaryData.totalBudget - Math.abs(summaryData.totalSpend) < 0 ? '#dc2626' : '#059669',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ width: '90%', maxWidth: '1200px', height: '350px', margin: '25px auto' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
      
      <HelpText isVisible={helpTextVisible}>
        Chart uses logarithmic scale to better visualize both small and large amounts
      </HelpText>
    </div>
  );
};

export default Budgets;