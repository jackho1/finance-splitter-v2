import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { getApiUrl, getApiUrlWithParams } from './utils/apiUtils';
import { useUserPreferencesContext } from './contexts/UserPreferencesContext';
import { updateUserColorStyles, updateUserTotalColors, setUserPreferencesCache } from './utils/userColorStyles';

// Import utility functions
//import { calculateTotals } from './utils/calculateTotals';
import { applyFilters } from './utils/filterTransactions';
import { groupSplitTransactions } from './utils/transactionGrouping';
import { optimizedHandleOffsetUpdate } from './utils/updateHandlers';
import './ModernTables.css';
import './SortableTableHeaders.css';
import './CompactDropdown.css';

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
    padding: 0 15px;
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

// Refactored FilterButton component for more streamlined appearance
const FilterButton = ({ isActive, onClick, count = 0 }) => (
  <button 
    className={`filter-button compact ${isActive ? 'active' : ''}`}
    onClick={onClick}
    title="Filter"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
    {count > 0 && (
      <span className="filter-badge">{count}</span>
    )}
  </button>
);

// Refactored table dropdown menu component
const TableDropdownMenu = ({ 
  isActive, 
  onClose, 
  availableOptions,
  selectedOptions,
  onChange,
  onClear,
  emptyLabel = '(Empty/Null)',
  width = '220px',
  maxHeight = '280px',
  skipSearch = false,
}) => {
  // Stop clicks from propagating and closing the dropdown
  const handleClick = (e) => e.stopPropagation();
  
  if (!isActive) return null;
  
  return (
    <div 
      className="filter-dropdown"
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: '100%',
        zIndex: 1000,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        width: width === '220px' ? '240px' : width,
        marginTop: '5px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: maxHeight
      }}
    >
      {/* Search field - optional enhancement */}
      {availableOptions.length > 10 && !skipSearch && (
        <div className="filter-search" style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
          <input
            type="text"
            placeholder="Search..."
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
            }}
          />
        </div>
      )}
      
      <div className="filter-options" style={{ 
        overflowY: 'auto', 
        flex: '1 1 auto',
        padding: '8px 0' 
      }}>
        {/* Display non-null options */}
        {availableOptions
          .filter(option => option !== null && option !== undefined && option !== '')
          .map(option => (
            <div 
              key={option} 
              className="filter-option"
              style={{ 
                padding: '3px 1px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={(e) => {
                e.stopPropagation();
                onChange(option, e);
              }}
            >
              <input 
                type="checkbox" 
                checked={selectedOptions.includes(option)}
                onChange={() => {}} // Handled by parent div onClick
                style={{ marginRight: '6px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px' }}>
                {option}
              </span>
            </div>
          ))
        }
        
        {/* Display null/empty option at the bottom if it exists */}
        {availableOptions.some(option => option === null || option === undefined || option === '') && (
          <div 
            className="filter-option"
            style={{ 
              padding: '6px 4px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              borderTop: '1px solid #f0f0f0',
              marginTop: '4px',
              paddingTop: '8px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null, e);
            }}
          >
            <input 
              type="checkbox" 
              checked={selectedOptions.includes(null)}
              onChange={() => {}} // Handled by parent div onClick
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', fontStyle: 'italic', color: '#6b7280' }}>
              {emptyLabel}
            </span>
          </div>
        )}
      </div>
      
      {/* Footer with clear button only */}
      {selectedOptions.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          padding: '3px 4px',
          borderTop: '1px solid #f0f0f0',
          backgroundColor: 'white',
          borderBottomLeftRadius: '6px',
          borderBottomRightRadius: '6px',
          position: 'sticky',
          bottom: 0,
          flex: '0 0 auto'
        }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            style={{ 
              padding: '3px 6px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f9fafb';
              e.target.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#6b7280';
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

// Specialized date filter dropdown component
const DateFilterDropdown = ({ 
  isActive, 
  dateFilter,
  onChange,
  onClear,
  dateRange,
  width = '220px',
}) => {
  // Stop clicks from propagating and closing the dropdown
  const handleClick = (e) => e.stopPropagation();
  
  if (!isActive) return null;
  
  return (
    <div 
      className="filter-dropdown"
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: '100%',
        zIndex: 1000,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        width: width,
        marginTop: '5px',
        padding: '12px',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '12px', 
          fontWeight: '500', 
          color: '#374151', 
          marginBottom: '4px' 
        }}>
          From:
        </label>
        <input 
          type="date" 
          name="startDate"
          value={dateFilter.startDate}
          onChange={onChange}
          min={dateRange.min}
          max={dateRange.max}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '13px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '12px', 
          fontWeight: '500', 
          color: '#374151', 
          marginBottom: '4px' 
        }}>
          To:
        </label>
        <input 
          type="date" 
          name="endDate"
          value={dateFilter.endDate}
          onChange={onChange}
          min={dateRange.min}
          max={dateRange.max}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '13px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        />
      </div>
      {(dateFilter.startDate || dateFilter.endDate) && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          paddingTop: '8px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            style={{ 
              padding: '4px 8px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f9fafb';
              e.target.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#6b7280';
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

// Sortable header component
const SortableHeader = ({ column, sortBy, onSort, children, hasFilter = false, onFilterToggle, isFilterActive }) => {
  const isActive = sortBy.startsWith(column);
  const isDesc = sortBy === `${column}-desc`;

  // For headers without filters, use a simpler structure
  if (!hasFilter) {
    return (
      <div 
        className="modern-filter-header"
      >
        <div 
          className="header-content"
          onClick={() => onSort(column)}
        >
          <span>{children}</span>
          <span className={`sort-indicator ${isActive ? 'active' : ''}`}>
            <span className={`sort-arrow up ${isActive && !isDesc ? 'active' : ''}`}></span>
            <span className={`sort-arrow down ${isActive && isDesc ? 'active' : ''}`}></span>
          </span>
        </div>
      </div>
  );
  }

  // For headers with filters
    return (
      <div 
      className="modern-filter-header sortable"
    >
      <div 
        className="sortable-header"
        onClick={() => onSort(column)}
        style={{ width: 'calc(100% - 30px)' }}
      >
        <div className="header-content">
          <span>{children}</span>
          <span className={`sort-indicator ${isActive ? 'active' : ''}`}>
            <span className={`sort-arrow up ${isActive && !isDesc ? 'active' : ''}`}></span>
            <span className={`sort-arrow down ${isActive && isDesc ? 'active' : ''}`}></span>
          </span>
        </div>
      </div>
      <FilterButton
        isActive={isFilterActive}
        onClick={(e) => {
          e.stopPropagation();
          onFilterToggle();
        }}
      />
      </div>
    );
};

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

  // New: Add user management states
  const [users, setUsers] = useState([]);
  const [splitAllocations, setSplitAllocations] = useState(null); // Use null to distinguish from empty object
  
  // User preferences context for getting color functions
  const { getUserTotalColors } = useUserPreferencesContext();

  // Helper function to get transaction label from split allocations
  const getTransactionLabel = (transaction) => {
    // Early return for loading states
    if (isTransactionsLoading || !users || users.length === 0) {
      return null;
    }
    
    // Check if splitAllocations is loaded
    if (splitAllocations === null || splitAllocations === undefined) {
      return null;
    }
    
    const allocations = splitAllocations[transaction.id];
    
    // If we have split allocations data for this transaction, use it
    if (allocations && Array.isArray(allocations) && allocations.length > 0) {
      // If single user, show their display name
      if (allocations.length === 1) {
        const displayName = allocations[0].display_name;
        return displayName;
      }
      
      // For multiple users, check if it's an equal split
      const isEqualSplit = () => {
        // Check if all allocations have the same split_type_code and it's 'equal'
        const allEqualType = allocations.every(allocation => allocation.split_type_code === 'equal');
        
        if (allEqualType) {
          return true;
        }
        
        // Alternative check: if percentages are equal (indicating equal split)
        if (allocations.length > 1 && allocations[0].percentage) {
          const firstPercentage = parseFloat(allocations[0].percentage);
          const expectedPercentage = 100 / allocations.length;
          const tolerance = 0.1; // Small tolerance for floating point comparison
          
          return allocations.every(allocation => {
            const percentage = parseFloat(allocation.percentage);
            return Math.abs(percentage - expectedPercentage) < tolerance;
          });
        }
        
        // Alternative check: if amounts are equal (for equal splits)
        if (allocations.length > 1) {
          const firstAmount = Math.abs(parseFloat(allocations[0].amount));
          const tolerance = 0.01; // 1 cent tolerance
          
          return allocations.every(allocation => {
            const amount = Math.abs(parseFloat(allocation.amount));
            return Math.abs(amount - firstAmount) < tolerance;
          });
        }
        
        return false;
      };
      
      // If it's an equal split among multiple users
      if (isEqualSplit()) {
        // If exactly 2 users with equal split, show "Both"
        if (allocations.length === 2) {
          return 'Both';
        }
        
        // If 3+ users with equal split, show "All users"
        if (allocations.length >= 3) {
          return 'All users';
        }
      }
      
      // For other cases (mixed split types), show first user + count
      return `${allocations[0].display_name} +${allocations.length - 1}`;
    } else {
      // No split allocations found
      return null;
    }
  };

  // Helper function to get user total from allocations
  const getUserTotalFromAllocations = (userId, filteredTransactions) => {
    return filteredTransactions.reduce((total, transaction) => {
      const allocations = splitAllocations[transaction.id];
      if (allocations) {
        const userAllocation = allocations.find(allocation => allocation.user_id === userId);
        if (userAllocation) {
          return total + userAllocation.amount;
        }
      }
      return total;
    }, 0);
  };

  // Helper function to calculate totals from allocations
  const calculateTotalsFromAllocations = (filteredTransactions) => {
    const totals = {};
    
    // Guard clause: return empty totals if users is not loaded yet
    if (!users || !Array.isArray(users)) {
      return totals;
    }
    
    users.forEach(user => {
      if (user.username !== 'default') {
        const userTotal = getUserTotalFromAllocations(user.id, filteredTransactions);
        const safeTotal = typeof userTotal === 'number' && !isNaN(userTotal) ? userTotal : 0;
        totals[user.display_name] = safeTotal;
      }
    });
    
    return totals;
  };

  // Helper function to generate dynamic dropdown options based on active users
  const getLabelDropdownOptions = () => {
    // Guard clause: return default options if users is not loaded yet
    if (!users || !Array.isArray(users)) {
      return [{ value: '', label: 'None' }];
    }
    
    const activeUsers = users.filter(user => user.username !== 'default' && user.is_active);
    
    const options = [
      { value: '', label: 'None' }
    ];
    
    // Add individual user options
    activeUsers.forEach(user => {
      options.push({
        value: user.display_name,
        label: user.display_name
      });
    });
    
    // Add collective option based on number of users
    if (activeUsers.length === 2) {
      options.push({
        value: 'Both',
        label: 'Both (Equal Split)'
      });
    } else if (activeUsers.length >= 3) {
      options.push({
        value: 'All users',
        label: 'All users (Equal Split)'
      });
    }
    
    return options;
  };

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
        // Single API call to get all offset initial data
        const response = await axios.get(getApiUrl('/offset-initial-data'));
        
        if (response.data.success) {
          const { offsetTransactions, offsetCategories, labels, users, splitAllocations } = response.data.data;
          
          // Set all data from the combined response
          setTransactions(offsetTransactions);
          setFilteredTransactions(offsetTransactions);
          setAllFilteredTransactions(offsetTransactions);
          setIsTransactionsLoading(false);
          
          setAvailableCategories(offsetCategories);
          
          setLabels(labels);
          setIsLabelsLoading(false);

          // New: Set users and split allocations
          setUsers(users || []);
          setSplitAllocations(splitAllocations || {});
          
          // Initialize user preferences cache (prevents multiple API calls)
          setUserPreferencesCache(users || []);
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

  // Listen for color style updates from preferences modal
  useEffect(() => {
    const handleColorStylesUpdate = () => {
      // Force a small re-render to pick up new CSS classes
      setIsTransactionsLoading(prev => prev);
    };

    window.addEventListener('userColorStylesUpdated', handleColorStylesUpdate);
    
    return () => {
      window.removeEventListener('userColorStylesUpdated', handleColorStylesUpdate);
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
      
      const response = await axios.post(getApiUrl('/refresh-offset-bank-feeds'));
      
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
        
        // Refresh the transactions data - use the full initial data endpoint
        const transactionsResponse = await axios.get(getApiUrl('/offset-initial-data'));
        if (transactionsResponse.data.success) {
          const { offsetTransactions, offsetCategories, labels, users, splitAllocations } = transactionsResponse.data.data;
          setTransactions(offsetTransactions);
          setAvailableCategories(offsetCategories);
          setLabels(labels);
          setUsers(users);
          setSplitAllocations(splitAllocations);
        } else {
          throw new Error(transactionsResponse.data.error || 'Failed to refresh data');
        }
        
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
        const transactionLabel = getTransactionLabel(transaction);
        if (labelFilter.includes(null) && !transactionLabel) {
          return true;
        }
        return labelFilter.includes(transactionLabel);
      });
    }
    
    // Group split transactions together after filtering and sorting
    filtered = groupSplitTransactions(filtered);
    
    setAllFilteredTransactions(filtered);
    
    let tableFiltered = filtered;
    // Only apply month filter if there's no date range filter AND showAllTransactions is false
    if (!dateFilter.startDate && !dateFilter.endDate && !showAllTransactions) {
      tableFiltered = filtered.filter(transaction => {
        const date = new Date(transaction.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
      
      // Re-group after month filtering to maintain split transaction grouping
      tableFiltered = groupSplitTransactions(tableFiltered);
    }
    
    setFilteredTransactions(tableFiltered);
  }, [transactions, filters.sortBy, dateFilter, categoryFilter, labelFilter, currentMonth, currentYear, showAllTransactions]);

  // Update user color styles when users change
  useEffect(() => {
    if (users && users.length > 0) {
      try {
        updateUserColorStyles(users);
        updateUserTotalColors(users);
      } catch (error) {
        console.error('Error updating user colors in OffsetTransactions:', error);
      }
    }
  }, [users]);

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

  // Helper function to show success notifications
  const showSuccessNotification = (message) => {
    const notification = document.createElement('div');
    notification.textContent = message;
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
  };

  // Handle split configuration updates for label editing
  const handleSplitConfigUpdate = async (transactionId, newLabelValue) => {
    try {
      setIsUpdating(true);
      
      // Guard clause: return early if users is not loaded yet
      if (!users || !Array.isArray(users)) {
        throw new Error('Users data not loaded yet');
      }
      
      const activeUsers = users.filter(user => user.username !== 'default');
      
      if (newLabelValue === '' || newLabelValue === null) {
        // Delete existing split configuration
        try {
          const deleteResponse = await axios.delete(getApiUrl(`/transactions/${transactionId}/split-config?transaction_type=offset`));
          
          if (deleteResponse.data.success) {
            // Update local state to reflect the change - clear legacy label
            setTransactions(prevTransactions => 
              prevTransactions.map(t => t.id === transactionId ? {...t, label: null} : t)
            );
            setFilteredTransactions(prevFiltered => 
              prevFiltered.map(t => t.id === transactionId ? {...t, label: null} : t)
            );
            
            // Update split allocations state
            setSplitAllocations(prev => {
              const updated = {...prev};
              delete updated[transactionId];
              return updated;
            });
            
            showSuccessNotification('Split configuration removed successfully');
            
            // Clear edit state to exit edit mode
            setEditCell(null);
            return;
          }
        } catch (deleteErr) {
          if (deleteErr.response?.status === 404) {
            // Split config doesn't exist, just update the label to null
            console.log(`ℹ️ No split configuration found to delete for transaction ${transactionId}`);
            
            // Still update local state even if no split config existed - clear legacy label
            setTransactions(prevTransactions => 
              prevTransactions.map(t => t.id === transactionId ? {...t, label: null} : t)
            );
            setFilteredTransactions(prevFiltered => 
              prevFiltered.map(t => t.id === transactionId ? {...t, label: null} : t)
            );
            
            // Update split allocations state
            setSplitAllocations(prev => {
              const updated = {...prev};
              delete updated[transactionId];
              return updated;
            });
            
            showSuccessNotification('Label cleared successfully');
            
            // Clear edit state to exit edit mode
            setEditCell(null);
            return;
          } else {
            throw deleteErr;
          }
        }
        return;
      } else {
        // Create or update split configuration
        const transaction = transactions.find(t => t.id === transactionId);
        if (!transaction) {
          throw new Error('Transaction not found');
        }

        // Determine users for the split based on the new label value
        let splitUsers = [];
        
        if (newLabelValue === 'Both' || newLabelValue === 'All users') {
          // Equal split between all active users
          splitUsers = activeUsers.map(user => ({ id: user.id }));
        } else {
          // Single user assignment
          const selectedUser = activeUsers.find(user => user.display_name === newLabelValue);
          if (!selectedUser) {
            throw new Error('Selected user not found');
          }
          splitUsers = [{ id: selectedUser.id }];
        }

        // Check if split configuration already exists
        const existingConfigResponse = await axios.get(getApiUrl(`/transactions/${transactionId}/split-config?transaction_type=offset`));
        
        if (existingConfigResponse.data.success && existingConfigResponse.data.data) {
          // Update existing configuration
          const updateResponse = await axios.put(getApiUrl(`/transactions/${transactionId}/split-config`), {
            transaction_type: 'offset',
            split_type_code: 'equal',
            users: splitUsers
          });
          
          if (updateResponse.data.success) {
            // Update local split allocations
            const newAllocations = updateResponse.data.data.allocations.map(allocation => ({
              allocation_id: allocation.id,
              split_id: updateResponse.data.data.config.id,
              user_id: allocation.user_id,
              amount: parseFloat(allocation.amount),
              percentage: allocation.percentage,
              is_paid: allocation.is_paid,
              paid_date: allocation.paid_date,
              notes: allocation.notes,
              created_at: allocation.created_at,
              username: allocation.username,
              display_name: allocation.display_name,
              config_id: updateResponse.data.data.config.id,
              split_type_code: 'equal',
              split_type_label: 'Equal Split'
            }));
            
            setSplitAllocations(prev => ({
              ...prev,
              [transactionId]: newAllocations
            }));
            
            // Update transaction state - clear the legacy label since we now have split allocations
            setTransactions(prevTransactions => 
              prevTransactions.map(t => 
                t.id === transactionId 
                  ? {...t, label: null} // Clear legacy label since we now use split allocations
                  : t
              )
            );
            setFilteredTransactions(prevFiltered => 
              prevFiltered.map(t => 
                t.id === transactionId 
                  ? {...t, label: null} // Clear legacy label since we now use split allocations
                  : t
              )
            );
            
            showSuccessNotification('Split configuration updated successfully');
            
            // Clear edit state to exit edit mode
            setEditCell(null);
          } else {
            throw new Error(updateResponse.data.error || 'Failed to update split configuration');
          }
        } else {
          // Create new configuration
          const createResponse = await axios.post(getApiUrl(`/transactions/${transactionId}/split-config`), {
            transaction_type: 'offset',
            split_type_code: 'equal',
            users: splitUsers
          });
          
          if (createResponse.data.success) {
            // Update local split allocations
            const newAllocations = createResponse.data.data.allocations.map(allocation => ({
              allocation_id: allocation.id,
              split_id: createResponse.data.data.config.id,
              user_id: allocation.user_id,
              amount: parseFloat(allocation.amount),
              percentage: allocation.percentage,
              is_paid: allocation.is_paid,
              paid_date: allocation.paid_date,
              notes: allocation.notes,
              created_at: allocation.created_at,
              username: allocation.username,
              display_name: allocation.display_name,
              config_id: createResponse.data.data.config.id,
              split_type_code: 'equal',
              split_type_label: 'Equal Split'
            }));
            
            setSplitAllocations(prev => ({
              ...prev,
              [transactionId]: newAllocations
            }));
            
            // Update transaction state - clear the legacy label since we now have split allocations
            setTransactions(prevTransactions => 
              prevTransactions.map(t => 
                t.id === transactionId 
                  ? {...t, label: null} // Clear legacy label since we now use split allocations
                  : t
              )
            );
            setFilteredTransactions(prevFiltered => 
              prevFiltered.map(t => 
                t.id === transactionId 
                  ? {...t, label: null} // Clear legacy label since we now use split allocations
                  : t
              )
            );
            
            showSuccessNotification('Split configuration created successfully');
            
            // Clear edit state to exit edit mode
            setEditCell(null);
          } else {
            throw new Error(createResponse.data.error || 'Failed to create split configuration');
          }
        }
      }
    } catch (error) {
      console.error('Error updating split configuration:', error);
      showErrorNotification(error.message || 'Failed to update split configuration');
      
      // Clear edit state even on error
      setEditCell(null);
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper function to create split configuration for newly created transactions
  const createSplitConfigForNewTransaction = async (transactionId, labelValue) => {
    // Guard clause: return early if users is not loaded yet
    if (!users || !Array.isArray(users)) {
      console.error('Users data not loaded yet');
      return;
    }
    
    // If no label value is provided, don't create a split configuration
    if (!labelValue || labelValue === '') {
      return;
    }
    
    // Determine users for the split based on the label value
    let splitUsers = [];
    
    if (labelValue === 'Both' || labelValue === 'All users') {
      // Equal split between all active users (excluding default)
      const activeUsers = users.filter(user => user.username !== 'default' && user.is_active);
      splitUsers = activeUsers.map(user => ({ id: user.id }));
    } else if (labelValue && labelValue !== '') {
      // Single user assignment
      const selectedUser = users.find(user => user.display_name === labelValue);
      if (selectedUser) {
        splitUsers = [{ id: selectedUser.id }];
      } else {
        throw new Error(`User not found: ${labelValue}`);
      }
    }

    if (splitUsers.length === 0) {
      throw new Error('No valid users found for split configuration');
    }

    const splitConfigData = {
      transaction_type: 'offset',
      split_type_code: 'equal', // Default to equal split
      users: splitUsers,
      created_by: 1 // Default user ID
    };

    const response = await axios.post(getApiUrl(`/transactions/${transactionId}/split-config`), splitConfigData);
    
    if (response.data.success) {
      const { allocations } = response.data.data;
      
      // Update split allocations state for this transaction
      setSplitAllocations(prev => ({
        ...prev,
        [transactionId]: allocations
      }));

      // Update transaction state - clear the legacy label since we now have split allocations
      setTransactions(prevTransactions => 
        prevTransactions.map(t => 
          t.id === transactionId 
            ? {...t, label: null} // Clear legacy label since we now use split allocations
            : t
        )
      );
      setFilteredTransactions(prevFiltered => 
        prevFiltered.map(t => 
          t.id === transactionId 
            ? {...t, label: null} // Clear legacy label since we now use split allocations
            : t
        )
      );
    }
  };

  const handleUpdate = async (transactionId, field) => {
    // Special handling for label field - use new split configuration system
    if (field === 'label') {
      await handleSplitConfigUpdate(transactionId, editValue);
    } else {
      // For all other fields, use the existing optimized update handler
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
    }
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
              {getLabelDropdownOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
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
    
    const isInEditMode = editCell && editCell.transactionId === transaction.id && editCell.field === field;
  
    return (
      <div 
          className={isInEditMode ? '' : 'cell-content editable-cell'}
          onDoubleClick={isInEditMode ? undefined : () => handleDoubleClick(transaction.id, field, transaction[field] || '')}
          style={{
            pointerEvents: isInEditMode ? 'none' : 'auto',
            position: 'relative',
            width: '100%',
            height: '100%'
          }}
        >
        {field === 'label' ? (
          (() => {
            const label = getTransactionLabel(transaction);
            
            // Show loading indicator if data is still loading
            if (isTransactionsLoading || splitAllocations === null) {
              return <span style={{ color: '#999', fontStyle: 'italic', fontSize: '12px' }}>Loading...</span>;
            }
            
            // Return clean label display
            return label || '';
          })()
        ) : isEmpty ? (
          <span className="empty-value"></span>
        ) : field === 'date' ? (
          new Date(transaction[field]).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: '2-digit'
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
  const getRowLabelClass = (transaction) => {
    const label = getTransactionLabel(transaction);
    if (!label || !users || !Array.isArray(users)) return '';
    const lowerLabel = label.toLowerCase();
    // Check for exact or partial match with any user display_name
    for (const user of users) {
      if (user.username === 'default') continue;
      if (lowerLabel.includes(user.display_name.toLowerCase())) {
        return `row-${user.display_name.toLowerCase().replace(/\s+/g, '-')}`;
      }
    }
    // Group split (e.g., 'Both', 'All users', or any label with 2+ users)
    if (lowerLabel.includes('both') || lowerLabel.includes('all user') || /\+\d+/.test(lowerLabel)) {
      return 'row-group';
    }
    return '';
  };

  // Modern table render function
  const renderTransactionsTable = () => (
    <div className="modern-table-container fade-in" style={{ marginTop: '2px' }}>
      {isTransactionsLoading || isLabelsLoading ? (
        <div className="loading-spinner" />
      ) : (
        <table className="modern-table">
          <thead>
            <tr>
              <th className="col-date">
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
                <DateFilterDropdown
                  isActive={activeFilterColumn === 'date'}
                  dateFilter={dateFilter}
                  onChange={handleDateFilterChange}
                  onClear={() => setDateFilter({ startDate: '', endDate: '' })}
                  dateRange={dateRange}
                />
              </th>
              <th className="col-description">
                <SortableHeader
                  column="description"
                  sortBy={filters.sortBy}
                  onSort={handleHeaderSort}
                >
                  Description
                </SortableHeader>
              </th>
              <th className="col-amount">
                <SortableHeader
                  column="amount"
                  sortBy={filters.sortBy}
                  onSort={handleHeaderSort}
                >
                  Amount
                </SortableHeader>
              </th>
              <th className="col-category">
                <SortableHeader
                  column="category"
                  sortBy={filters.sortBy}
                  onSort={handleHeaderSort}
                  hasFilter={true}
                  onFilterToggle={() => toggleColumnFilter('category')}
                  isFilterActive={activeFilterColumn === 'category'}
                >
                  Category
                </SortableHeader>
                <TableDropdownMenu
                  isActive={activeFilterColumn === 'category'}
                  onClose={() => setActiveFilterColumn(null)}
                  availableOptions={availableCategories.concat(transactions.some(t => !t.category) ? [null] : [])}
                  selectedOptions={categoryFilter}
                  onChange={handleCategoryFilterChange}
                  onClear={() => setCategoryFilter([])}
                  skipSearch={true}
                />
              </th>
              <th className="col-label">
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
                <TableDropdownMenu
                  isActive={activeFilterColumn === 'label'}
                  onClose={() => setActiveFilterColumn(null)}
                  availableOptions={getLabelDropdownOptions()}
                  selectedOptions={labelFilter}
                  onChange={handleLabelFilterChange}
                  onClear={() => setLabelFilter([])}
                  width="75px"
                />
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
                    className={getRowLabelClass(transaction)} 
                    style={{ 
                      backgroundColor: expandedRow === transaction.id ? '#f8fafc' : 
                                     transaction.split_from_id ? '#f7fbff' : undefined,
                      transition: 'background-color 0.2s',
                      borderLeft: transaction.split_from_id ? '4px solid #93c5fd' : undefined
                    }}
                  >
                    <td className="col-date">{renderCell(transaction, 'date')}</td>
                    <td className="col-description">
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
                    <td className="col-amount">{renderCell(transaction, 'amount')}</td>
                    <td className="col-category">{renderCell(transaction, 'category')}</td>
                    <td className="col-label">{renderCell(transaction, 'label')}</td>
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
      
      const response = await axios.post(getApiUrl('/offset-transactions'), transactionData);
      
      if (response.data.success) {
        const addedTransaction = response.data.data;
        
        setTransactions(prev => [addedTransaction, ...prev]);
        
        // Create split configuration if label is provided
        if (newTransaction.label) {
          await createSplitConfigForNewTransaction(addedTransaction.id, newTransaction.label);
        }
        
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
        
        showSuccessNotification('Transaction added successfully!');
        
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
      
      const response = await axios.post(getApiUrl('/offset-transactions/split'), splitData);
      
      if (response.data.success) {
        // Refresh the transactions
        const transactionsResponse = await axios.get(getApiUrl('/offset-transactions'));
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
      <style>{buttonStyles}</style>
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
          padding: '12px', 
          backgroundColor: '#e8f4fd', 
          borderRadius: '8px',
          border: '1px solid #d0e8f9',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <strong style={{ color: '#1e40af', fontSize: '14px' }}>Active Filters:</strong>
              {(dateFilter.startDate || dateFilter.endDate) && (
                <span style={{ 
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: '1px solid #bfdbfe'
                }}>
                  📅 {dateFilter.startDate || 'Start'} to {dateFilter.endDate || 'Today'}
                </span>
              )}
              {categoryFilter.length > 0 && (
                <span style={{ 
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: '1px solid #fde68a'
                }}>
                  📋 Categories: {categoryFilter.slice(0, 3).map(cat => cat === null ? '(empty)' : cat).join(', ')}{categoryFilter.length > 3 ? ` +${categoryFilter.length - 3} more` : ''}
                </span>
              )}
              {labelFilter.length > 0 && (
                <span style={{ 
                  backgroundColor: '#fce7f3',
                  color: '#be185d',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: '1px solid #f9a8d4'
                }}>
                  👤 Labels: {labelFilter.slice(0, 3).join(', ')}{labelFilter.length > 3 ? ` +${labelFilter.length - 3} more` : ''}
                </span>
              )}
              <span style={{ 
                fontSize: '13px', 
                color: '#4b5563',
                fontWeight: '500'
              }}>
                ({filteredTransactions.length} transactions)
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={clearFilters}
                style={{ 
                  padding: '8px 14px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                Clear All Filters
              </button>
            </div>
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
              marginBottom: '20px',
              position: 'relative',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div></div>
                <h2 className="section-title" style={{ margin: 0, textAlign: 'center' }}>Savings Buckets</h2>
                
                {/* Settings and Reset Button Container */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}>
                  {/* Settings Button */}
                  <button
                    onClick={() => setShowSettings(true)}
                    className="modern-button"
                    style={{ marginRight: 0, padding: '6px 12px' }}
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
                    className="modern-button"
                    style={{ padding: '6px 12px' }}
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
              
              {/* HelpText below the title and buttons */}
              <div style={{ marginBottom: '6px' }}>
                <HelpText isVisible={helpTextVisible}>
                  Drag category cards to reorder them. Your arrangement will be saved automatically. 
                </HelpText>
              </div>

              <div style={{ marginBottom: '6px' }}>
                <HelpText isVisible={helpTextVisible}>
                  Double-click on any category to show all transactions for that category across all months.
                </HelpText>
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

      <div className="table-navigation-container">
        <div className="table-navigation-left">
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
        
        <div className="table-navigation-right">
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
              
              <div style={{ marginBottom: '15px' }}>
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
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Label
                </label>
                <select
                  name="label"
                  value={newTransaction.label || ''}
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
                  {getLabelDropdownOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
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
      
      {/* Split Transaction Modal - REFACTORED VERSION */}
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
                      {transactionToSplit.category && (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#f0fdf4',
                          color: '#166534',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          border: '1px solid #bbf7d0'
                        }}>
                          🏷️ {transactionToSplit.category}
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
                          value={split.category}
                          onChange={(e) => handleSplitChange(index, 'category', e.target.value)}
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
                          {availableCategories.map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
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
                          {getLabelDropdownOptions().map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
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
          </div>
        </div>
      )}

      
      {/* Transactions table with modern styling */}
      {renderTransactionsTable()}
    </div>
  );
};

export default OffsetTransactions;