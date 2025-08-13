import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { getApiUrl, getApiUrlWithParams } from './utils/apiUtils';

// Import utility functions
import { applyFilters } from './utils/filterTransactions';
import { groupSplitTransactions } from './utils/transactionGrouping';
import { optimizedHandlePersonalUpdate } from './utils/updateHandlers';
import { 
  createDragImage, 
  handleDragOverWithReorder, 
  handleDragEndCleanup,
  getDraggableContainerStyles 
} from './utils/dragAndDropUtils';
import './ModernTables.css';
import './SortableTableHeaders.css';
import './CompactDropdown.css';



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
        background: 'var(--color-backgroundElevated)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px var(--color-shadow)',
        width: width === '220px' ? '220px' : width,
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
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-backgroundElevated)',
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
        background: 'var(--color-backgroundElevated)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px var(--color-shadow)',
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
          color: 'var(--color-text)', 
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
            border: '1px solid var(--color-inputBorder)',
            borderRadius: '4px',
            backgroundColor: 'var(--color-inputBackground)',
            color: 'var(--color-inputText)',
            boxSizing: 'border-box'
          }}
        />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '12px', 
          fontWeight: '500', 
          color: 'var(--color-text)', 
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
            border: '1px solid var(--color-inputBorder)',
            borderRadius: '4px',
            backgroundColor: 'var(--color-inputBackground)',
            color: 'var(--color-inputText)',
            boxSizing: 'border-box'
          }}
        />
      </div>
      {(dateFilter.startDate || dateFilter.endDate) && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          paddingTop: '8px',
          borderTop: '1px solid var(--color-border)'
        }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            style={{ 
              padding: '4px 8px',
              backgroundColor: 'transparent',
              color: 'var(--color-textSecondary)',
              border: '1px solid var(--color-borderSecondary)',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--color-backgroundHover)';
              e.target.style.color = 'var(--color-text)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = 'var(--color-textSecondary)';
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

const PersonalTransactions = ({ helpTextVisible, users, splitAllocations }) => {
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
    category: ''
  }]);
  const [isSavingSplit, setIsSavingSplit] = useState(false);
  
  // Smart splitting based on shared transactions states
  const [useSmartSplit, setUseSmartSplit] = useState(false);
  const [smartSplitData, setSmartSplitData] = useState(null);
  const [isLoadingSmartSplit, setIsLoadingSmartSplit] = useState(false);
  const [smartSplitFilters, setSmartSplitFilters] = useState({
    startDate: '',
    endDate: '',
    user: 'Jack'
  });
  
  // Add state for expanded row
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Add settings states
  const [showSettings, setShowSettings] = useState(false);
  const [hideZeroBalanceBuckets, setHideZeroBalanceBuckets] = useState(false);
  // Add state for negative bucket offset setting
  const [enableNegativeOffsetBucket, setEnableNegativeOffsetBucket] = useState(false);
  const [selectedNegativeOffsetBucket, setSelectedNegativeOffsetBucket] = useState('');
  
  // Updated states for multiple auto distributions
  const [autoDistributionEnabled, setAutoDistributionEnabled] = useState(false);
  const [autoDistributionRules, setAutoDistributionRules] = useState([]);
  const [lastAutoDistributionMonth, setLastAutoDistributionMonth] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [showDistributionSummary, setShowDistributionSummary] = useState(false);
  const autoRulesButtonRef = useRef(null);
  const [popupPosition, setPopupPosition] = useState({ top: '60px', left: '0' });
  
  // Add state to track initial loading completion
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Personal Split Configuration States
  const [personalSplitEnabled, setPersonalSplitEnabled] = useState(false);
  const [personalSplitDefaultDays, setPersonalSplitDefaultDays] = useState(7);
  const [personalSplitGroups, setPersonalSplitGroups] = useState([]);
  const [personalSplitMappings, setPersonalSplitMappings] = useState([]);
  const [availableBudgetCategories, setAvailableBudgetCategories] = useState([]);
  const [availablePersonalCategories, setAvailablePersonalCategories] = useState([]);
  const [showPersonalSplitConfig, setShowPersonalSplitConfig] = useState(false);
  const [isLoadingPersonalSplitConfig, setIsLoadingPersonalSplitConfig] = useState(false);
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ 
    group_name: '', 
    personal_category: '',
    budget_categories: []
  });
  
  // Edit mode states
  const [editingGroups, setEditingGroups] = useState({}); // Track which groups are being edited
  const [editingChanges, setEditingChanges] = useState({}); // Track changes for each group
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  
  // Get user ID from the new user management system
  const [userId, setUserId] = useState(null);
  
  // Fetch the current user ID from the user management system
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await axios.get(getApiUrl('/users'));
        if (response.data.success && response.data.data.length > 0) {
          // Use the first active user from the list
          setUserId(response.data.data[0].id);
        } else {
          console.error('Could not get user ID from users endpoint');
          // Fallback to default user ID if needed
          setUserId(1);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        // Fallback to default user ID if needed
        setUserId(1);
      }
    };
    
    fetchCurrentUser();
  }, []);
  
  // Database API functions for auto distribution rules
  const loadAutoDistributionRules = async () => {
    if (!userId) return;
    
    try {
      const response = await axios.get(getApiUrlWithParams('/auto-distribution-rules/:userId', { userId }));
      if (response.data.success) {
        const rules = response.data.data.map(rule => ({
          id: rule.id,
          name: rule.rule_name,
          amount: rule.amount,
          sourceBucket: rule.source_bucket,
          destBucket: rule.dest_bucket
        }));
        setAutoDistributionRules(rules);
      }
    } catch (error) {
      console.error('Error loading auto distribution rules:', error);
    }
  };

  const savePersonalSettings = async (settingsUpdate) => {
    if (!userId) return;
    
    try {
      await axios.put(getApiUrlWithParams('/personal-settings/:userId', { userId }), settingsUpdate);
    } catch (error) {
      console.error('Error saving personal settings:', error);
    }
  };

  // Personal Split Configuration API Functions
  const loadPersonalSplitConfig = async () => {
    if (!userId) return;
    
    try {
      setIsLoadingPersonalSplitConfig(true);
      
      // Load split groups, budget categories, and personal categories
      const [groupsResponse, budgetCategoriesResponse, personalCategoriesResponse] = await Promise.all([
        axios.get(getApiUrlWithParams('/personal-split-groups/:userId', { userId })),
        axios.get(getApiUrl('/budget-categories')),
        axios.get(getApiUrl('/personal-categories'))
      ]);
      

      
      if (groupsResponse.data.success) {
        setPersonalSplitGroups(groupsResponse.data.data);
      }
      
      // Budget categories returns { success: true, data: ["category1", "category2"] }
      if (budgetCategoriesResponse.data.success) {
        setAvailableBudgetCategories(budgetCategoriesResponse.data.data);
      }
      
      // Personal categories returns the array directly without success wrapper
      if (personalCategoriesResponse.data && Array.isArray(personalCategoriesResponse.data)) {
        setAvailablePersonalCategories(personalCategoriesResponse.data);
      } else if (personalCategoriesResponse.data.success && personalCategoriesResponse.data.data) {
        setAvailablePersonalCategories(personalCategoriesResponse.data.data);
      }
    } catch (error) {
      console.error('Error loading personal split configuration:', error);
    } finally {
      setIsLoadingPersonalSplitConfig(false);
    }
  };

  const createPersonalSplitGroup = async (groupData) => {
    if (!userId) return;
    
    try {
      const response = await axios.post(getApiUrl('/personal-split-groups'), {
        user_id: userId,
        ...groupData
      });
      
      if (response.data.success) {
        await loadPersonalSplitConfig(); // Reload configuration
        return response.data.data;
      }
    } catch (error) {
      console.error('Error creating personal split group:', error);
      throw error;
    }
  };

  const updatePersonalSplitGroup = async (groupId, updates) => {
    try {
      const response = await axios.put(getApiUrlWithParams('/personal-split-groups/:groupId', { groupId }), updates);
      
      if (response.data.success) {
        await loadPersonalSplitConfig(); // Reload configuration
        return response.data.data;
      }
    } catch (error) {
      console.error('Error updating personal split group:', error);
      throw error;
    }
  };

  const deletePersonalSplitGroup = async (groupId) => {
    try {
      const response = await axios.delete(getApiUrlWithParams('/personal-split-groups/:groupId', { groupId }));
      
      if (response.data.success) {
        await loadPersonalSplitConfig(); // Reload configuration
      }
    } catch (error) {
      console.error('Error deleting personal split group:', error);
      throw error;
    }
  };

  const updatePersonalSplitMapping = async (groupId, budgetCategories) => {
    if (!userId) return;
    
    try {
      // First, delete existing mappings for this group
      const existingMappings = personalSplitGroups.find(g => g.id === groupId)?.mapped_categories || [];
      if (existingMappings.length > 0) {
        await axios.delete(getApiUrlWithParams('/personal-split-mapping/bulk/:userId', { userId }), {
          data: {
            personal_split_group_id: groupId,
            budget_categories: existingMappings.map(m => m.budget_category)
          }
        });
      }
      
      // Then, create new mappings
      if (budgetCategories.length > 0) {
        await axios.post(getApiUrl('/personal-split-mapping'), {
          user_id: userId,
          personal_split_group_id: groupId,
          budget_categories: budgetCategories
        });
      }
      
      await loadPersonalSplitConfig(); // Reload configuration
    } catch (error) {
      console.error('Error updating personal split mappings:', error);
      throw error;
    }
  };

  const loadPersonalSettings = async () => {
    if (!userId) return;
    
    try {
      const response = await axios.get(getApiUrlWithParams('/personal-settings/:userId', { userId }));
      if (response.data.success) {
        const settings = response.data.data;
        setHideZeroBalanceBuckets(settings.hide_zero_balance_buckets || false);
        setEnableNegativeOffsetBucket(settings.enable_negative_offset_bucket || false);
        setSelectedNegativeOffsetBucket(settings.selected_negative_offset_bucket || '');
        
        // Personal split settings
        setPersonalSplitEnabled(settings.personal_split_enabled || false);
        setPersonalSplitDefaultDays(settings.personal_split_default_days || 7);
        
        // Make sure category_order is handled correctly if it's a string
        if (settings.category_order) {
          if (typeof settings.category_order === 'string') {
            try {
              setCategoryOrder(JSON.parse(settings.category_order));
            } catch (error) {
              console.error('Error parsing category_order from settings:', error);
              setCategoryOrder([]);
            }
          } else if (Array.isArray(settings.category_order)) {
            setCategoryOrder(settings.category_order);
          } else {
            setCategoryOrder([]);
          }
        } else {
          setCategoryOrder([]);
        }
        
        setAutoDistributionEnabled(settings.auto_distribution_enabled || false);
        setLastAutoDistributionMonth(settings.last_auto_distribution_month || '');
      }
    } catch (error) {
      console.error('Error loading personal settings:', error);
    }
  };
  
  // Keys for localStorage (category order now stored in database)
  const SETTINGS_KEY = 'personal_transactions_settings';
  const AUTO_DISTRIBUTION_KEY = 'personal_auto_distribution_settings';
  const LAST_DISTRIBUTION_KEY = 'personal_last_auto_distribution';
  
  // Date formatting utility - concise version for transaction descriptions
  const formatDateRangeConcise = (startDate, endDate) => {
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      return `${day} ${month}`;
    };
    
    return `${formatDate(startDate)}-${formatDate(endDate)}`;
  };
  
  const formatDateRange = (startDate, endDate) => {
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'long' });
      
      // Add ordinal suffix
      const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
          case 1: return 'st';
          case 2: return 'nd';
          case 3: return 'rd';
          default: return 'th';
        }
      };
      
      return `${day}${getOrdinalSuffix(day)} ${month}`;
    };
    
    return `from ${formatDate(startDate)} to ${formatDate(endDate)}`;
  };
  
  // Double-click feature
  const handleCategoryDoubleClick = (category) => {
    // Get the earliest date from all transactions
    const earliestDate = getMinMaxDates().min;
    
    // Set date filter to show from earliest date to today
    setDateFilter({ 
      startDate: earliestDate, 
      endDate: '' // This will default to today/current date
    });
    
    // Set category filter to only show this category
    setCategoryFilter([category]);
    
    // Close any active filter dropdowns
    setActiveFilterColumn(null);
    
    // Show notification
    const notification = document.createElement('div');
    notification.textContent = `Now showing all transactions for "${category}"`;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#e3f2fd';
    notification.style.color = '#0d47a1';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    notification.style.zIndex = '1000';
    notification.style.border = '1px solid #90caf9';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 2000);
  };
  
  // Load saved settings on mount - includes negative offset bucket settings
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setHideZeroBalanceBuckets(parsedSettings.hideZeroBalanceBuckets || false);
        setEnableNegativeOffsetBucket(parsedSettings.enableNegativeOffsetBucket || false);
        setSelectedNegativeOffsetBucket(parsedSettings.selectedNegativeOffsetBucket || '');
      } catch (error) {
        console.error('Error parsing saved settings:', error);
        localStorage.removeItem(SETTINGS_KEY);
      }
    }
  }, []);
  
  // Load auto distribution settings on mount
  useEffect(() => {
    const savedAutoDistribution = localStorage.getItem(AUTO_DISTRIBUTION_KEY);
    if (savedAutoDistribution) {
      try {
        const parsedSettings = JSON.parse(savedAutoDistribution);
        setAutoDistributionEnabled(parsedSettings.enabled || false);
        
        // Ensure each rule has a name property when loading from storage
        const rules = parsedSettings.rules || [];
        const updatedRules = rules.map(rule => ({
          id: rule.id,
          name: rule.name || `Rule ${rule.id}`,
          amount: rule.amount || '',
          sourceBucket: rule.sourceBucket || '',
          destBucket: rule.destBucket || ''
        }));
        
        setAutoDistributionRules(updatedRules);
      } catch (error) {
        console.error('Error parsing auto distribution settings:', error);
        localStorage.removeItem(AUTO_DISTRIBUTION_KEY);
      }
    }
    
    const lastDistribution = localStorage.getItem(LAST_DISTRIBUTION_KEY);
    if (lastDistribution) {
      setLastAutoDistributionMonth(lastDistribution);
    }
  }, []);
  
  // Function to perform auto distribution using backend endpoint
  const performAutoDistribution = async () => {
    if (!userId || !autoDistributionRules || autoDistributionRules.length === 0) {
      return;
    }
    
    try {
      setIsDistributing(true);
      
      const currentDate = new Date();
      const monthYearStr = `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`;
      
      // Use the backend endpoint for atomic distribution
      const response = await axios.post(getApiUrl('/auto-distribution/apply'), {
        user_id: userId, // This should now be a numeric ID from the user management system
        month_year: monthYearStr
      });
      
      if (response.data.success) {
        const { appliedCount, failedCount, createdTransactions, lastDistributionMonth } = response.data.data;
        
        // Update the last distribution month from backend response
        setLastAutoDistributionMonth(lastDistributionMonth);
        console.log('✅ Auto distribution completed, updated lastDistributionMonth to:', lastDistributionMonth);
        // Backend now properly updates personal settings
        
        // Refresh transactions
        const transactionsResponse = await axios.get(getApiUrl('/personal-transactions'));
        setTransactions(transactionsResponse.data);
        
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = `Monthly distribution completed: ${appliedCount} rules applied successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = failedCount > 0 ? '#fff3cd' : '#d4edda';
        notification.style.color = failedCount > 0 ? '#856404' : '#155724';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '6px';
        notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        notification.style.zIndex = '1000';
        notification.style.maxWidth = '400px';
        notification.style.border = `1px solid ${failedCount > 0 ? '#ffeaa7' : '#c3e6cb'}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.3s ease';
          
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 300);
        }, 5000);
      } else {
        throw new Error(response.data.error || 'Auto distribution failed');
      }
      
    } catch (error) {
      console.error('Error performing auto distribution:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error performing monthly distribution. Please check console for details.';
      showErrorNotification(errorMessage);
    } finally {
      setIsDistributing(false);
    }
  };
  
  // Check if we need to perform auto distribution (only after initial load is complete)
  useEffect(() => {
    if (initialLoadComplete && autoDistributionEnabled && autoDistributionRules.length > 0) {
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
      
      console.log('Auto distribution check:', {
        initialLoadComplete,
        autoDistributionEnabled,
        autoDistributionRulesCount: autoDistributionRules.length,
        currentMonthKey,
        lastAutoDistributionMonth,
        shouldRun: lastAutoDistributionMonth !== currentMonthKey
      });
      
      if (lastAutoDistributionMonth !== currentMonthKey) {
        console.log('🚀 New month detected, performing auto distribution...');
        performAutoDistribution();
      } else {
        console.log('✅ Auto distribution already completed for this month');
      }
    }
  }, [initialLoadComplete, autoDistributionEnabled, lastAutoDistributionMonth, autoDistributionRules]);
  
  // Initialize or update category order when transactions change
  // Modified to respect database as source of truth and only update when there are actual changes
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
      
      // Only update category order if:
      // 1. We already have a category order (from database) AND
      // 2. There are new or removed categories
      if (categoryOrder.length > 0) {
        // Check for new categories or removed categories
        const newCategories = currentCategories.filter(cat => !categoryOrder.includes(cat));
        const removedCategories = categoryOrder.filter(cat => !currentCategories.includes(cat));
        
        if (newCategories.length > 0 || removedCategories.length > 0) {
          // Update the order: keep existing order but add new categories and remove old ones  
          const updatedOrder = [
            ...categoryOrder.filter(cat => currentCategories.includes(cat)), // Keep existing categories in order
            ...newCategories // Add new categories at the end
          ];
          
          setCategoryOrder(updatedOrder);
          savePersonalSettings({ category_order: updatedOrder });
        }
      }
      // Note: Removed the else cases that were creating default orders
      // Database should be the source of truth for category order
    }
  }, [transactions, categoryOrder]); // Added categoryOrder as dependency

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

  // Combined useEffect to fetch all initial data sequentially to avoid overwhelming database connections
  useEffect(() => {
    // Only fetch initial data when userId is available
    if (!userId) return;
    
    const fetchInitialData = async () => {
      setIsTransactionsLoading(true);
      
      try {
        // Single API call to get all personal initial data with userId
        const response = await axios.get(getApiUrlWithParams('/personal-initial-data/:userId', { userId }));
        
        if (response.data.success) {
          const { personalTransactions, personalCategories, autoDistributionRules, personalSettings } = response.data.data;
          
          // Set all data from the combined response
          setTransactions(personalTransactions);
          setFilteredTransactions(personalTransactions);
          setAllFilteredTransactions(personalTransactions);
          
          const categories = personalCategories.map(item => item.category);
          setAvailableCategories(categories);
          
          // Transform auto distribution rules to match expected frontend format
          const transformedRules = autoDistributionRules.map(rule => ({
            id: rule.id,
            name: rule.rule_name,
            amount: rule.amount,
            sourceBucket: rule.source_bucket,
            destBucket: rule.dest_bucket
          }));
          setAutoDistributionRules(transformedRules);
          
          // Load personal settings using the dedicated function to ensure proper boolean handling
          if (personalSettings && Object.keys(personalSettings).length > 0) {
            // Use proper boolean handling - only default to false if the value is null/undefined
            setHideZeroBalanceBuckets(personalSettings.hide_zero_balance_buckets ?? false);
            setAutoDistributionEnabled(personalSettings.auto_distribution_enabled ?? false);
            setLastAutoDistributionMonth(personalSettings.last_auto_distribution_month || '');
            setEnableNegativeOffsetBucket(personalSettings.enable_negative_offset_bucket ?? false);
            setSelectedNegativeOffsetBucket(personalSettings.selected_negative_offset_bucket || '');
            
            // Personal split settings
            setPersonalSplitEnabled(personalSettings.personal_split_enabled ?? false);
            setPersonalSplitDefaultDays(personalSettings.personal_split_default_days || 7);
            
            // Handle category order if it exists in database
            if (personalSettings.category_order) {
              if (typeof personalSettings.category_order === 'string') {
                try {
                  setCategoryOrder(JSON.parse(personalSettings.category_order));
                } catch (error) {
                  console.error('Error parsing category_order from settings:', error);
                  // If there's an error parsing, create initial order from transactions but don't save it
                  const categoryData = personalTransactions.reduce((acc, transaction) => {
                    const category = transaction.category || 'Uncategorized';
                    if (!acc[category]) acc[category] = true;
                    return acc;
                  }, {});
                  setCategoryOrder(Object.keys(categoryData).sort());
                }
              } else if (Array.isArray(personalSettings.category_order)) {
                setCategoryOrder(personalSettings.category_order);
              } else {
                // Invalid format, create initial order from transactions but don't save it
                const categoryData = personalTransactions.reduce((acc, transaction) => {
                  const category = transaction.category || 'Uncategorized';
                  if (!acc[category]) acc[category] = true;
                  return acc;
                }, {});
                setCategoryOrder(Object.keys(categoryData).sort());
              }
            } else {
              // No category order in database, create initial order from transactions but don't save it
              // User will need to manually arrange and save to persist the order
              const categoryData = personalTransactions.reduce((acc, transaction) => {
                const category = transaction.category || 'Uncategorized';
                if (!acc[category]) acc[category] = true;
                return acc;
              }, {});
              setCategoryOrder(Object.keys(categoryData).sort());
            }
          }
          
          // Load personal split configuration
          await loadPersonalSplitConfig();
          
          // Also call loadPersonalSettings as a backup to ensure proper boolean handling
          await loadPersonalSettings();
          
          setIsTransactionsLoading(false);
          
          // Mark initial loading as complete after a small delay to prevent immediate auto distribution
          setTimeout(() => {
            setInitialLoadComplete(true);
          }, 1000);
        } else {
          throw new Error(response.data.error || 'Failed to fetch personal initial data');
        }
      } catch (error) {
        console.error('Error fetching personal initial data:', error);
        setIsTransactionsLoading(false);
      }
    };
    
    fetchInitialData();
  }, [userId]);

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
      
      const response = await axios.post(getApiUrl('/refresh-personal-bank-feeds'));
      
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
        const transactionsResponse = await axios.get(getApiUrl('/personal-transactions'));
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
    
    // Group split transactions together after filtering and sorting
    filtered = groupSplitTransactions(filtered);
    
    setAllFilteredTransactions(filtered);
    
    let tableFiltered = filtered;
    if (!dateFilter.startDate && !dateFilter.endDate) {
      tableFiltered = filtered.filter(transaction => {
        const date = new Date(transaction.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
      
      // Re-group after month filtering to maintain split transaction grouping
      tableFiltered = groupSplitTransactions(tableFiltered);
    }
    
    setFilteredTransactions(tableFiltered);
  }, [transactions, filters.sortBy, dateFilter, categoryFilter, currentMonth, currentYear]);

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
    await optimizedHandlePersonalUpdate(
      transactionId, 
      field, 
      editValue, 
      transactions, 
      setTransactions, 
      setFilteredTransactions, 
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
              style={{ 
                textAlign: 'center',
                width: '100%',
                position: 'relative',
                zIndex: 1001,
                pointerEvents: 'auto',
                backgroundColor: 'var(--color-inputBackground)',
                color: 'var(--color-inputText)'
              }}
              autoFocus
            >
              <option value="">Select a category</option>
              {availableCategories.map(category => (
                <option key={category} value={category}>{category}</option>
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

  // Modern table render function
  const renderTransactionsTable = () => (
    <div className="modern-table-container fade-in" style={{ marginTop: '2px' }}>
      {isTransactionsLoading ? (
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
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-state">
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
                    style={{ 
                      backgroundColor: expandedRow === transaction.id ? 'var(--color-backgroundTertiary)' : 
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
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expandedRow === transaction.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="col-amount">{renderCell(transaction, 'amount')}</td>
                    <td className="col-category">{renderCell(transaction, 'category')}</td>
                  </tr>
                  {expandedRow === transaction.id && (
                    <tr>
                      <td colSpan="4" style={{ 
                        padding: '0',
                        backgroundColor: 'var(--color-backgroundTertiary)',
                        border: '1px solid var(--color-border)'
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
                                color: 'var(--color-text)'
                              }}>
                                {transaction.has_split ? 'Split Transactions:' : 'Related Transactions:'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {getRelatedTransactions(transaction).map(related => (
                                  <div key={related.id} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    padding: '8px',
                                    backgroundColor: 'var(--color-backgroundSecondary)',
                                    borderRadius: '4px',
                                    border: '1px solid var(--color-border)'
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
      
      const response = await axios.post(getApiUrl('/personal-transactions'), transactionData);
      
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

  // Drag and Drop handlers using shared utilities for consistency
  const handleDragStart = (e, category) => {
    createDragImage(e, setDraggedCategory, setIsDragging, category);
  };
  
  const handleDragOver = (e, category) => {
    handleDragOverWithReorder(e, category, draggedCategory, categoryOrder, setCategoryOrder);
  };
  
  const handleDragEnd = () => {
    handleDragEndCleanup(setDraggedCategory, setIsDragging);
    
    // Persist the new order to database
    savePersonalSettings({ category_order: categoryOrder });
    
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
    if (window.confirm('Are you sure you want to reset the category order to alphabetical?')) {
      // Reset to alphabetical order based on current transactions
      const categoryData = transactions.reduce((acc, transaction) => {
        const category = transaction.category || 'Uncategorized';
        if (!acc[category]) acc[category] = true;
        return acc;
      }, {});
      
      const defaultOrder = Object.keys(categoryData).sort();
      setCategoryOrder(defaultOrder);
      savePersonalSettings({ category_order: defaultOrder });
      
      // Show notification
      const notification = document.createElement('div');
      notification.textContent = 'Category order reset to alphabetical!';
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

  // Smart Split Functions - Updated to use database configuration
  const loadSmartSplitData = async () => {
    // 1. Check config
    if (!personalSplitEnabled) {
      showErrorNotification('Personal split is not enabled. Please enable it in settings first.');
      return;
    }
    if (personalSplitGroups.length === 0) {
      showErrorNotification('No split groups configured. Please configure split groups in settings first.');
      return;
    }
    if (!Array.isArray(users) || users.length === 0) {
      showErrorNotification('User data not loaded. Please refresh and try again.');
      return;
    }
    // Dynamically select the current user (preferably from context, else first non-default, else fallback)
    let currentUser = users.find(u => u.is_current) || users.find(u => u.username !== 'default') || users[0];
    if (!currentUser) {
      showErrorNotification('No valid user found for smart split.');
      return;
    }
    const userId = currentUser.id;
    const today = new Date().toISOString().split('T')[0];
    const effectiveFilters = { ...smartSplitFilters };
    if (!effectiveFilters.endDate) {
      effectiveFilters.endDate = today;
      setSmartSplitFilters(prev => ({ ...prev, endDate: today }));
    }
    if (!useSmartSplit || !effectiveFilters.startDate) {
      showErrorNotification('Please provide a start date for smart split');
      return;
    }
    try {
      setIsLoadingSmartSplit(true);
      
      // 3. Fetch shared transactions for the date range using the API
      const sharedTransactionsResponse = await axios.get(getApiUrl('/shared-transactions-filtered'), {
        params: {
          startDate: effectiveFilters.startDate,
          endDate: effectiveFilters.endDate,
          user: currentUser.display_name || currentUser.username,
          userId: userId
        }
      });
      
      if (!sharedTransactionsResponse.data.success) {
        throw new Error('Failed to fetch shared transactions for smart split');
      }
      
      const sharedTransactionsData = sharedTransactionsResponse.data.data;
      const sharedTransactions = sharedTransactionsData.transactions || [];
      const groupedTotals = sharedTransactionsData.groupedTotals || {};
      
      // 4. Create split transactions based on the grouped totals from the API
      const newSplitTransactions = [];
      Object.entries(groupedTotals).forEach(([groupName, data]) => {
        if (data.personalCategory && data.personalCategory !== 'original' && data.total !== 0) {
          newSplitTransactions.push({
            description: `${groupName} ${formatDateRangeConcise(effectiveFilters.startDate, effectiveFilters.endDate)}`,
            amount: data.total.toFixed(2),
            category: data.personalCategory
          });
        }
      });
      
      if (newSplitTransactions.length > 0) {
        setSplitTransactions(newSplitTransactions);
      } else {
        showErrorNotification('No split transactions were generated. Check your split group configuration and date range.');
      }
    } catch (error) {
      console.error('Error loading smart split data:', error);
      showErrorNotification('Failed to load shared transaction data for smart splitting');
    } finally {
      setIsLoadingSmartSplit(false);
    }
  };

  // Split Transaction Handlers
  const handleSplitTransaction = (transaction) => {
    // Auto-populate smart split filters with user's configured defaults
    const today = new Date().toISOString().split('T')[0];
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - personalSplitDefaultDays);
    const daysAgoString = daysAgo.toISOString().split('T')[0];
    
    setTransactionToSplit(transaction);
    setSplitTransactions([{
      description: '',
      amount: '',
      category: ''
    }]);
    setUseSmartSplit(personalSplitEnabled); // Auto-enable if configured
    setSmartSplitData(null);
    
    // Auto-populate smart split filters with user's configured default date range
    setSmartSplitFilters({
      startDate: daysAgoString,
      endDate: today,
      user: 'Jack' // This will be replaced with logged-in user when authentication is implemented
    });
    
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
      category: ''
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
          category: split.category
        }))
      };
      
      const response = await axios.post(getApiUrl('/personal-transactions/split'), splitData);
      
      if (response.data.success) {
        // Refresh the transactions
        const transactionsResponse = await axios.get(getApiUrl('/personal-transactions'));
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
          category: ''
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
      category: ''
    }]);
    setUseSmartSplit(false);
    setSmartSplitData(null);
    setSmartSplitFilters({
      startDate: '',
      endDate: '',
      user: 'Jack'
    });
  };

  // Handle settings change - database version
  const handleHideZeroBalanceBucketsChange = (checked) => {
    setHideZeroBalanceBuckets(checked);
    savePersonalSettings({ hide_zero_balance_buckets: checked });
  };

  // Handle negative offset bucket checkbox change - database version
  const handleEnableNegativeOffsetBucketChange = (checked) => {
    setEnableNegativeOffsetBucket(checked);
    const updatedSelectedBucket = checked ? selectedNegativeOffsetBucket : '';
    setSelectedNegativeOffsetBucket(updatedSelectedBucket);
    savePersonalSettings({ 
      enable_negative_offset_bucket: checked,
      selected_negative_offset_bucket: updatedSelectedBucket
    });
  };

  // Handle negative offset bucket selection change - database version
  const handleNegativeOffsetBucketChange = (bucketName) => {
    setSelectedNegativeOffsetBucket(bucketName);
    savePersonalSettings({ selected_negative_offset_bucket: bucketName });
  };

  // Handle auto distribution settings changes - database version
  const handleAutoDistributionEnabledChange = (checked) => {
    setAutoDistributionEnabled(checked);
    savePersonalSettings({ auto_distribution_enabled: checked });
  };

  // Handle personal split settings changes
  const handlePersonalSplitEnabledChange = (checked) => {
    setPersonalSplitEnabled(checked);
    savePersonalSettings({ personal_split_enabled: checked });
  };

  const handlePersonalSplitDefaultDaysChange = (days) => {
    setPersonalSplitDefaultDays(days);
    savePersonalSettings({ personal_split_default_days: days });
  };

  // Edit mode helper functions
  const startEditingGroup = (groupId) => {
    const group = personalSplitGroups.find(g => g.id === groupId);
    if (group) {
      setEditingGroups(prev => ({ ...prev, [groupId]: true }));
      setEditingChanges(prev => ({
        ...prev,
        [groupId]: group.mapped_categories ? group.mapped_categories.map(m => m.budget_category) : []
      }));
    }
  };

  const cancelEditingGroup = (groupId) => {
    setEditingGroups(prev => {
      const newState = { ...prev };
      delete newState[groupId];
      return newState;
    });
    setEditingChanges(prev => {
      const newState = { ...prev };
      delete newState[groupId];
      return newState;
    });
    
    // Check if there are any remaining unsaved changes
    const remainingChanges = Object.keys(editingChanges).filter(id => id !== groupId);
    setHasUnsavedChanges(remainingChanges.length > 0);
  };

  const saveEditingGroup = async (groupId) => {
    try {
      const newCategories = editingChanges[groupId] || [];
      
      // Check for category conflicts with other groups
      const usedCategories = getUsedBudgetCategories(groupId);
      const conflictingCategories = newCategories.filter(category => 
        usedCategories.has(category)
      );
      
      if (conflictingCategories.length > 0) {
        showErrorNotification(`The following categories are already used in other groups: ${conflictingCategories.join(', ')}. Please remove them from other groups first.`);
        return;
      }
      
      await updatePersonalSplitMapping(groupId, newCategories);
      
      // Clear editing state for this group
      setEditingGroups(prev => {
        const newState = { ...prev };
        delete newState[groupId];
        return newState;
      });
      setEditingChanges(prev => {
        const newState = { ...prev };
        delete newState[groupId];
        return newState;
      });
      
      // Check if there are any remaining unsaved changes
      const remainingChanges = Object.keys(editingChanges).filter(id => id !== groupId);
      setHasUnsavedChanges(remainingChanges.length > 0);
    } catch (error) {
      showErrorNotification('Failed to save category mappings');
    }
  };

  const handleEditingCategoryChange = (groupId, category, isSelected) => {
    setEditingChanges(prev => {
      const currentCategories = prev[groupId] || [];
      const updatedCategories = isSelected
        ? [...currentCategories, category]
        : currentCategories.filter(c => c !== category);
      
      setHasUnsavedChanges(true);
      return {
        ...prev,
        [groupId]: updatedCategories
      };
    });
  };

  const handleClosePersonalSplitConfig = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesModal(true);
    } else {
      setShowPersonalSplitConfig(false);
    }
  };

  const handleConfirmDiscardChanges = () => {
    // Clear all editing states
    setEditingGroups({});
    setEditingChanges({});
    setHasUnsavedChanges(false);
    setShowUnsavedChangesModal(false);
    setShowPersonalSplitConfig(false);
  };

  const handleCancelDiscardChanges = () => {
    setShowUnsavedChangesModal(false);
  };

  // Helper function to get all used budget categories across all groups
  const getUsedBudgetCategories = (excludeGroupId = null) => {
    const usedCategories = new Set();
    
    personalSplitGroups.forEach(group => {
      if (group.id !== excludeGroupId && group.mapped_categories) {
        group.mapped_categories.forEach(mapping => {
          usedCategories.add(mapping.budget_category);
        });
      }
    });
    
    // Also include categories from other groups being edited
    Object.entries(editingChanges).forEach(([groupId, categories]) => {
      if (parseInt(groupId) !== excludeGroupId) {
        categories.forEach(category => {
          usedCategories.add(category);
        });
      }
    });
    
    return usedCategories;
  };

  // Helper function to check if a category is available for a specific group
  const isCategoryAvailable = (category, groupId = null) => {
    const usedCategories = getUsedBudgetCategories(groupId);
    return !usedCategories.has(category);
  };

  // Helper function to get available categories for a specific group
  const getAvailableCategoriesForGroup = (groupId = null) => {
    const usedCategories = getUsedBudgetCategories(groupId);
    return availableBudgetCategories.filter(category => !usedCategories.has(category));
  };

  // Handle new group form
  const handleNewGroupFormChange = (field, value) => {
    setNewGroupForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateGroup = async () => {
    if (!newGroupForm.group_name.trim() || !newGroupForm.personal_category.trim()) {
      showErrorNotification('Please fill in both group name and personal category');
      return;
    }

    if (newGroupForm.budget_categories.length === 0) {
      showErrorNotification('Please select at least one budget category');
      return;
    }

    // Check for category conflicts
    const usedCategories = getUsedBudgetCategories();
    const conflictingCategories = newGroupForm.budget_categories.filter(category => 
      usedCategories.has(category)
    );
    
    if (conflictingCategories.length > 0) {
      showErrorNotification(`The following categories are already used in other groups: ${conflictingCategories.join(', ')}. Please remove them from other groups first.`);
      return;
    }

    try {
      // Create the group first
      const createdGroup = await createPersonalSplitGroup({
        group_name: newGroupForm.group_name,
        personal_category: newGroupForm.personal_category
      });
      
      // Then create the mappings
      if (createdGroup && newGroupForm.budget_categories.length > 0) {
        await updatePersonalSplitMapping(createdGroup.id, newGroupForm.budget_categories);
      }
      
      setNewGroupForm({ group_name: '', personal_category: '', budget_categories: [] });
      setShowAddGroupForm(false);
    } catch (error) {
      showErrorNotification('Failed to create split group');
    }
  };

  const cancelAddGroup = () => {
    setNewGroupForm({ group_name: '', personal_category: '', budget_categories: [] });
    setShowAddGroupForm(false);
  };

  // Add a new distribution rule
  const addDistributionRule = async () => {
    try {
      const newRule = {
        user_id: userId,
        rule_name: `Rule ${autoDistributionRules.length + 1}`,
        amount: 0,
        source_bucket: '',
        destBucket: ''
      };
      
      const response = await axios.post(getApiUrl('/auto-distribution-rules'), newRule);
      if (response.data.success) {
        await loadAutoDistributionRules(); // Reload to get updated rules with database IDs
      }
    } catch (error) {
      console.error('Error adding distribution rule:', error);
    }
  };

  // Remove a distribution rule
  const removeDistributionRule = async (id) => {
    try {
      const response = await axios.delete(getApiUrlWithParams('/auto-distribution-rules/:id', { id }));
      if (response.data.success) {
        await loadAutoDistributionRules(); // Reload to get updated rules
      }
    } catch (error) {
      console.error('Error removing distribution rule:', error);
    }
  };

  // Update a distribution rule
  const updateDistributionRule = async (id, field, value) => {
    try {
      // Convert frontend field names to database field names
      const fieldMap = {
        name: 'rule_name',
        amount: 'amount',
        sourceBucket: 'source_bucket',
        destBucket: 'dest_bucket'
      };
      
      const dbField = fieldMap[field] || field;
      const response = await axios.put(getApiUrlWithParams('/auto-distribution-rules/:id', { id }), {
        [dbField]: value
      });
      
      if (response.data.success) {
        await loadAutoDistributionRules(); // Reload to get updated rules
      }
    } catch (error) {
      console.error('Error updating distribution rule:', error);
    }
  };
  
  // State for mapping bank_category/subcategory to main category
  // Remove unused categoryMainMap logic since we use existing categoryMappings
  
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
                            <div style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>Updating transaction...</div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {(dateFilter.startDate || dateFilter.endDate || categoryFilter.length > 0) && (
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
                  backgroundColor: 'var(--color-buttonSecondary)',
                  color: 'var(--color-buttonSecondaryText)',
                  border: '1px solid var(--color-buttonSecondaryBorder)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px var(--color-shadow)'
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
        padding: '24px',
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
                {/* Split Groups and Auto Rules Button Container - Left Side */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  justifyContent: 'flex-start'
                }}>
                  {/* Personal Split Groups Info Button (if enabled and configured) */}
                  {personalSplitEnabled && personalSplitGroups.length > 0 && (
                    <button
                      onClick={() => setShowPersonalSplitConfig(true)}
                      style={{
                        fontSize: '13px',
                        padding: '6px 12px',
                        backgroundColor: '#f0f4ff',
                        color: '#5b21b6',
                        border: '1px solid #c4b5fd',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.backgroundColor = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#a78bfa';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.backgroundColor = '#f0f4ff';
                        e.currentTarget.style.borderColor = '#c4b5fd';
                      }}
                      title="View and manage split groups"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        <path d="M12 11h4"/>
                        <path d="M12 16h4"/>
                        <path d="M8 11h.01"/>
                        <path d="M8 16h.01"/>
                      </svg>
                      {personalSplitGroups.length} Split Group{personalSplitGroups.length > 1 ? 's' : ''}
                    </button>
                  )}

                  {/* Auto Distribution Info Button (if enabled) */}
                  {autoDistributionEnabled && autoDistributionRules.length > 0 && (
                    <button
                      ref={autoRulesButtonRef}
                      onClick={() => {
                        if (!showDistributionSummary && autoRulesButtonRef.current) {
                          // Calculate position to align popup's top-left with button's bottom-left
                          const buttonEl = autoRulesButtonRef.current;
                          const buttonRect = buttonEl.getBoundingClientRect();
                          const container = buttonEl.closest('.modern-table-wrapper') || buttonEl.offsetParent;
                          
                          if (container) {
                            const containerRect = container.getBoundingClientRect();
                            // Calculate left position: button's left edge relative to container
                            const leftPosition = buttonRect.left - containerRect.left + 20;
                            // Calculate top position: button's bottom edge + small gap
                            const topPosition = buttonRect.bottom - containerRect.top + 27;
                            
                            setPopupPosition({
                              top: `${topPosition}px`,
                              left: `${leftPosition}px`
                            });
                          } else {
                            // Fallback: use button's position in the viewport
                            setPopupPosition({
                              top: `${buttonRect.bottom + 8}px`,
                              left: `${buttonRect.left}px`
                            });
                          }
                        }
                        setShowDistributionSummary(!showDistributionSummary);
                      }}
                      style={{
                        fontSize: '13px',
                        padding: '6px 12px',
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        border: '1px solid #7dd3fc',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.backgroundColor = '#bae6fd';
                        e.currentTarget.style.borderColor = '#38bdf8';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.backgroundColor = '#e0f2fe';
                        e.currentTarget.style.borderColor = '#7dd3fc';
                      }}
                      title="View auto distribution summary"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/>
                        <circle cx="12" cy="12" r="8" strokeDasharray="3 3"/>
                        <path d="M12 2v6m0 6v6m10-8h-6m-6 0H2"/>
                      </svg>
                      {autoDistributionRules.length} Auto Rule{autoDistributionRules.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                <h2 className="section-title" style={{ margin: 0, textAlign: 'center' }}>Savings Buckets</h2>
                
                {/* Settings and Reset Button Container - Right Side */}
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
            
            {/* Auto Distribution Summary Popup */}
            {showDistributionSummary && autoDistributionRules.length > 0 && (
              <div               style={{
                position: 'absolute',
                top: popupPosition.top,
                left: popupPosition.left,
                backgroundColor: 'var(--color-modalBackground)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 10px 25px var(--color-shadow)',
                zIndex: 100,
                width: '320px'
              }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    borderBottom: '1px solid #f3f4f6',
                    paddingBottom: '8px'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--color-text)' }}>Monthly Auto Distribution</h4>
                    <button
                      onClick={() => setShowDistributionSummary(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    {autoDistributionRules.map((rule, index) => (
                      <div key={rule.id} style={{ 
                        marginBottom: '8px',
                        padding: '8px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px'
                      }}>
                        <div style={{ 
                          color: '#374151', 
                          marginBottom: '4px', 
                          fontWeight: '500', 
                          fontSize: '14px'
                        }}>
                          {rule.name || `Rule ${index + 1}`}
                        </div>
                        <div style={{ color: '#374151', marginBottom: '4px' }}>
                          <strong>${rule.amount}</strong> per month
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '12px' }}>
                          From: <strong>{rule.sourceBucket || 'Not set'}</strong>
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '12px' }}>
                          To: <strong>{rule.destBucket || 'Not set'}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      performAutoDistribution();
                      setShowDistributionSummary(false);
                    }}
                    disabled={isDistributing}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '8px',
                      backgroundColor: isDistributing ? '#94a3b8' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isDistributing ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {isDistributing ? 'Distributing...' : 'Distribute Now'}
                  </button>
              </div>
            )}
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '30px'
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
                  
                  if (enableNegativeOffsetBucket && selectedNegativeOffsetBucket && categoryData[selectedNegativeOffsetBucket]) {
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
                      const isOffsetBucket = enableNegativeOffsetBucket && category === selectedNegativeOffsetBucket;
                      
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
                            const isOffsetBucket = enableNegativeOffsetBucket && cat === selectedNegativeOffsetBucket;
                            return !isNegative || isOffsetBucket;
                          })
                          .reduce((sum, [cat, catData]) => {
                            const catTotal = typeof catData.total === 'number' ? catData.total : parseFloat(catData.total) || 0;
                            return sum + catTotal;
                          }, 0);

                        // Check if this bucket is included in the sum calculation
                        const isIncludedInSum = numTotal >= 0 || (enableNegativeOffsetBucket && category === selectedNegativeOffsetBucket);
                        const percentage = isIncludedInSum && totalForPercentage !== 0 ? 
                          (numTotal / totalForPercentage) * 100 : 0;
                        
                        const color = getCategoryColor(category, index);
                        
                        // Check if this category has been affected by offsetting
                        const isOffsetBucket = enableNegativeOffsetBucket && category === selectedNegativeOffsetBucket && selectedNegativeOffsetBucket && rawTotal !== numTotal;
                        const isExcludedNegative = rawTotal < 0 && (!enableNegativeOffsetBucket || category !== selectedNegativeOffsetBucket) && enableNegativeOffsetBucket;
                          
                        return (
                          <div 
                            key={category}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, category)}
                            onDragOver={(e) => handleDragOver(e, category)}
                            onDragEnd={handleDragEnd}
                            onDoubleClick={() => handleCategoryDoubleClick(category)}
                            style={getDraggableContainerStyles(category, draggedCategory, isDragging, color)}
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
                              color: 'var(--color-text)',
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
                              color: 'var(--color-textSecondary)'  // Removed marginLeft
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
                      padding: '24px',
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

            {/* Modern Balance Summary Section with new calculation */}
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: 'var(--color-backgroundElevated)',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              maxWidth: '560px',
              margin: '20px auto',
              boxShadow: '0 6px 28px var(--color-shadowLight)',
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
                  
                  if (enableNegativeOffsetBucket && selectedNegativeOffsetBucket && adjustedTotals[selectedNegativeOffsetBucket] !== undefined) {
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
                    const isOffsetBucket = enableNegativeOffsetBucket && category === selectedNegativeOffsetBucket;
                    
                    if (!isNegative || isOffsetBucket) {
                      return sum + numAmount;
                    }
                    return sum;
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
        Personal Transactions
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
      
      {/* Settings Modal - CONDENSED VERSION with reduced padding/whitespace */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--color-modalOverlay)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--color-backgroundElevated)',
            padding: '16px', // Reduced from 24px
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            width: '600px',
            maxWidth: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '12px', // Reduced from 20px
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px' // Reduced from 16px
            }}>
              <h2 style={{ 
                margin: 0, 
                color: 'var(--color-text)',
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
                  color: 'var(--color-textSecondary)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = 'var(--color-backgroundHover)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-textSecondary)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {/* Auto Monthly Distribution Section */}
            <div style={{ marginBottom: '16px' }}> {/* Reduced from 24px */}
              <h3 style={{ 
                margin: '0 0 8px 0', // Reduced from 16px
                color: 'var(--color-text)',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Auto Monthly Distribution
              </h3>
              
              <div style={{
                padding: '12px', // Reduced from 16px
                backgroundColor: 'var(--color-infoLight)',
                borderRadius: '8px',
                border: '1px solid var(--color-info)',
                borderLeft: '4px solid var(--color-info)',
                marginBottom: '12px' // Reduced from 16px
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  gap: '8px' // Reduced from 12px
                }}>
                  <input 
                    type="checkbox" 
                    checked={autoDistributionEnabled}
                    onChange={(e) => handleAutoDistributionEnabledChange(e.target.checked)}
                    style={{ 
                      marginTop: '1px', // Reduced from 2px
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <div>
                    <div style={{ 
                      fontSize: '14px',
                      color: 'var(--color-text)',
                      fontWeight: '500',
                      marginBottom: '2px' // Reduced from 4px
                    }}>
                      Enable auto monthly budget distribution
                    </div>
                    <div style={{ 
                      fontSize: '13px',
                      color: 'var(--color-textSecondary)',
                      lineHeight: '1.3' // Reduced from 1.4
                    }}>
                      Automatically transfer funds between buckets when a new month begins (triggered on first login of the month).
                    </div>
                  </div>
                </label>
              </div>
              
              {autoDistributionEnabled && (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px' // Reduced from 12px
                  }}>
                    <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--color-text)' }}>Distribution Rules</h4>
                    <button
                      onClick={addDistributionRule}
                      style={{
                        padding: '4px 10px', // Reduced from 6px 12px
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      Add Rule
                    </button>
                  </div>
                  
                  {autoDistributionRules.length === 0 ? (
                    <div style={{
                      padding: '14px', // Reduced from 20px
                      backgroundColor: 'var(--color-backgroundTertiary)',
                      borderRadius: '6px',
                      textAlign: 'center',
                      color: 'var(--color-textSecondary)',
                      fontSize: '14px'
                    }}>
                      No distribution rules configured. Click "Add Rule" to create one.
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}> {/* Reduced height from 350px */}
                      {autoDistributionRules.map((rule, index) => (
                        <div key={rule.id} style={{
                          padding: '10px', // Reduced from 12px
                          backgroundColor: 'var(--color-backgroundTertiary)',
                          borderRadius: '6px',
                          marginBottom: '8px', // Reduced from 10px
                          border: '1px solid var(--color-border)'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '6px' // Reduced from 10px
                          }}>
                            <input
                              type="text"
                              value={rule.name || `Rule ${index + 1}`}
                              onChange={(e) => {
                                updateDistributionRule(rule.id, 'name', e.target.value || `Rule ${index + 1}`);
                              }}
                              placeholder={`Rule ${index + 1}`}
                              style={{
                                flex: '1',
                                padding: '3px 6px', // Reduced from 4px 8px
                                height: '26px', // Reduced from 30px
                                border: '1px solid var(--color-border)',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontWeight: '400',
                                backgroundColor: 'var(--color-backgroundSecondary)',
                                color: 'var(--color-text)',
                                maxWidth: '40%' // Reduced from 75% to make the rule name input shorter
                              }}
                            />
                            <button
                              onClick={() => removeDistributionRule(rule.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#ef4444',
                                padding: '2px', // Reduced from 3px
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={e => {
                                e.currentTarget.style.backgroundColor = 'var(--color-backgroundHover)';
                              }}
                              onMouseOut={e => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                          
                          {/* Form Inputs with labels directly above them - more compact design */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '6px', // Reduced from 8px
                            alignItems: 'start'
                          }}>
                            {/* Amount column */}
                            <div>
                              <label style={{ 
                                fontSize: '11px', // Reduced from 12px
                                color: 'var(--color-textSecondary)',
                                fontWeight: '500',
                                display: 'block',
                                marginTop: '1px',
                                marginBottom: '1px' // Reduced from 2px
                              }}>Amount ($)</label>
                              <input
                                type="number"
                                value={rule.amount}
                                onChange={(e) => {
                                  updateDistributionRule(rule.id, 'amount', e.target.value);
                                }}
                                style={{
                                  width: '100%',
                                  height: '30px', // Reduced from 36px
                                  padding: '4px 8px', // Reduced from 6px 12px
                                  borderRadius: '4px',
                                  border: '1px solid var(--color-border)',
                                  fontSize: '13px',
                                  textAlign: 'right',
                                  boxSizing: 'border-box',
                                  backgroundColor: 'var(--color-backgroundSecondary)',
                                  color: 'var(--color-text)',
                                  lineHeight: 'normal',
                                  margin: 0,
                                  appearance: 'textfield'
                                }}
                                placeholder="1000"
                              />
                            </div>
                            
                            {/* From Bucket column */}
                            <div>
                              <label style={{ 
                                fontSize: '11px', // Reduced from 12px
                                color: 'var(--color-textSecondary)',
                                fontWeight: '500',
                                display: 'block',
                                marginTop: '1px',
                                marginBottom: '1px' // Reduced from 2px
                              }}>From Bucket</label>
                              <select
                                value={rule.sourceBucket}
                                onChange={(e) => {
                                  updateDistributionRule(rule.id, 'sourceBucket', e.target.value);
                                }}
                                style={{
                                  width: '100%',
                                  height: '30px', // Reduced from 36px
                                  padding: '4px 8px', // Reduced from 6px 12px
                                  borderRadius: '4px',
                                  border: '1px solid var(--color-border)',
                                  fontSize: '13px',
                                  backgroundColor: 'var(--color-backgroundSecondary)',
                                  color: 'var(--color-text)',
                                  boxSizing: 'border-box',
                                  appearance: 'none',
                                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 8px center',
                                  backgroundSize: '16px',
                                  lineHeight: 'normal',
                                  margin: 0
                                }}
                              >
                                <option value="">Select source</option>
                                {availableCategories.map(category => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {/* To Bucket column */}
                            <div>
                              <label style={{ 
                                fontSize: '11px', // Reduced from 12px
                                color: 'var(--color-textSecondary)',
                                fontWeight: '500',
                                display: 'block',
                                marginTop: '1px',
                                marginBottom: '1px' // Reduced from 2px
                              }}>To Bucket</label>
                              <select
                                value={rule.destBucket}
                                onChange={(e) => {
                                  updateDistributionRule(rule.id, 'destBucket', e.target.value);
                                }}
                                style={{
                                  width: '100%',
                                  height: '30px', // Reduced from 36px
                                  padding: '4px 8px', // Reduced from 6px 12px
                                  borderRadius: '4px',
                                  border: '1px solid var(--color-border)',
                                  fontSize: '13px',
                                  backgroundColor: 'var(--color-backgroundSecondary)',
                                  color: 'var(--color-text)',
                                  boxSizing: 'border-box',
                                  appearance: 'none',
                                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 8px center',
                                  backgroundSize: '16px',
                                  lineHeight: 'normal',
                                  margin: 0
                                }}
                              >
                                <option value="">Select destination</option>
                                {availableCategories.map(category => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        
                          {rule.amount && rule.sourceBucket && rule.destBucket && (
                            <div style={{
                              marginTop: '4px', // Reduced from 6px
                              padding: '4px 8px', // Slightly increased for better highlight visibility
                              backgroundColor: 'var(--color-infoLight)',
                              borderRadius: '4px',
                              fontSize: '11px',
                              color: 'var(--color-info)',
                              textAlign: 'center',
                              fontWeight: '500',
                              border: '1px solid var(--color-info)',
                              opacity: 0.9
                            }}>
                              ${rule.amount} from <strong>{rule.sourceBucket}</strong> → <strong>{rule.destBucket}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: '16px' }}> {/* Reduced from 24px */}
              <h3 style={{ 
                margin: '0 0 8px 0', // Reduced from 16px
                color: 'var(--color-text)',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Display Options
              </h3>
              
              <div style={{
                padding: '12px', // Reduced from 16px
                backgroundColor: 'var(--color-backgroundTertiary)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                marginBottom: '12px' // Reduced from 16px
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  gap: '8px' // Reduced from 12px
                }}>
                  <input 
                    type="checkbox" 
                    checked={hideZeroBalanceBuckets}
                    onChange={(e) => handleHideZeroBalanceBucketsChange(e.target.checked)}
                    style={{ 
                      marginTop: '1px', // Reduced from 2px
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <div>
                    <div style={{ 
                      fontSize: '14px',
                      color: 'var(--color-text)',
                      fontWeight: '500',
                      marginBottom: '2px' // Reduced from 4px
                    }}>
                      Hide buckets with zero balance
                    </div>
                    <div style={{ 
                      fontSize: '13px',
                      color: 'var(--color-textSecondary)',
                      lineHeight: '1.3' // Reduced from 1.4
                    }}>
                      When enabled, savings buckets with a balance of zero (or less than 1 cent) will be hidden from the display.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            {/* Personal Split Configuration Section */}
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ 
                margin: '0 0 6px 0',
                color: 'var(--color-text)',
                fontSize: '15px',
                fontWeight: '500'
              }}>
                Personal Split Configuration
              </h3>
              
              <div style={{
                padding: '10px',
                backgroundColor: 'var(--color-purpleLight)',
                borderRadius: '6px',
                border: '1px solid var(--color-purple)',
                borderLeft: '4px solid var(--color-purple)',
                marginBottom: '8px'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  gap: '6px'
                }}>
                  <input 
                    type="checkbox" 
                    checked={personalSplitEnabled}
                    onChange={(e) => handlePersonalSplitEnabledChange(e.target.checked)}
                    style={{ 
                      marginTop: '1px',
                      cursor: 'pointer',
                      width: '14px',
                      height: '14px'
                    }}
                  />
                  <div>
                    <div style={{ 
                      fontSize: '14px',
                      color: 'var(--color-text)',
                      fontWeight: '500',
                      marginBottom: '1px'
                    }}>
                      Enable personal split feature
                    </div>
                    <div style={{ 
                      fontSize: '13px',
                      color: 'var(--color-textSecondary)',
                      lineHeight: '1.2'
                    }}>
                      Use configured budget category mappings instead of hardcoded rules.
                    </div>
                  </div>
                </label>
                
                {personalSplitEnabled && (
                  <div style={{ marginTop: '8px', paddingTop: '0px', borderTop: '1px dashed var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ 
                          fontSize: '12px',
                          color: 'var(--color-text)',
                          fontWeight: '500',
                          minWidth: '120px'
                        }}>
                          Default lookback (days):
                        </label>
                        <input
                          type="number"
                          value={personalSplitDefaultDays}
                          onChange={(e) => handlePersonalSplitDefaultDaysChange(parseInt(e.target.value) || 7)}
                          min="1"
                          max="365"
                          style={{
                            width: '60px',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            fontSize: '12px',
                            backgroundColor: 'var(--color-backgroundSecondary)',
                            color: 'var(--color-text)'
                          }}
                        />
                      </div>
                      <button
                        onClick={() => setShowPersonalSplitConfig(true)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#7c3aed',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={e => e.target.style.backgroundColor = '#6d28d9'}
                        onMouseOut={e => e.target.style.backgroundColor = '#7c3aed'}
                      >
                        Configure
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Updated Negative Bucket Offsetting Settings */}
            <div style={{ marginBottom: '16px' }}> {/* Reduced from 24px */}
              <h3 style={{ 
                margin: '0 0 8px 0', // Reduced from 16px
                color: 'var(--color-text)',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Negative Bucket Offsetting
              </h3>
              
              <div style={{
                padding: '12px', // Reduced from 16px
                backgroundColor: 'var(--color-infoLight)',
                borderRadius: '8px',
                border: '1px solid var(--color-info)',
                borderLeft: '4px solid var(--color-info)',
                marginBottom: '8px' // Reduced from 12px
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  gap: '8px' // Reduced from 12px
                }}>
                  <input 
                    type="checkbox" 
                    checked={enableNegativeOffsetBucket}
                    onChange={(e) => handleEnableNegativeOffsetBucketChange(e.target.checked)}
                    style={{ 
                      marginTop: '1px', // Reduced from 2px
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <div>
                    <div style={{ 
                      fontSize: '14px',
                      color: 'var(--color-text)',
                      fontWeight: '500',
                      marginBottom: '2px' // Reduced from 4px
                    }}>
                      Enable negative bucket offsetting
                    </div>
                    <div style={{ 
                      fontSize: '13px',
                      color: 'var(--color-textSecondary)',
                      lineHeight: '1.3' // Reduced from 1.4
                    }}>
                      When buckets go negative, they remain visible but are excluded from the Categories Sum calculation. Their negative amounts are deducted from your selected offset bucket to keep totals balanced.
                    </div>
                  </div>
                </label>
                
                {enableNegativeOffsetBucket && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--color-border)' }}> {/* Reduced margins from 16px */}
                    <label style={{ 
                      display: 'block',
                      fontSize: '13px',
                      color: 'var(--color-text)',
                      fontWeight: '500',
                      marginBottom: '4px' // Reduced from 6px
                    }}>
                      Select Offset Bucket
                    </label>
                    <select
                      value={selectedNegativeOffsetBucket}
                      onChange={(e) => handleNegativeOffsetBucketChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px', // Reduced from 10px
                        borderRadius: '6px',
                        border: '1px solid var(--color-border)',
                        fontSize: '14px',
                        backgroundColor: 'var(--color-backgroundSecondary)',
                        color: 'var(--color-text)'
                      }}
                    >
                      <option value="">Select a bucket</option>
                      {availableCategories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    
                    {selectedNegativeOffsetBucket && (
                      <div style={{
                        marginTop: '6px', // Reduced from 8px
                        padding: '6px', // Reduced from 8px
                        backgroundColor: 'var(--color-successLight)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#10b981',
                        fontWeight: '500'
                      }}>
                        ✓ Negative amounts will be deducted from <strong>{selectedNegativeOffsetBucket}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px',
              marginTop: '16px', // Reduced from 24px
              paddingTop: '12px', // Reduced from 16px
              borderTop: '1px solid var(--color-border)'
            }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  padding: '8px 16px', // Reduced from 10px 20px
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

      {/* REFACTORED Personal Split Configuration Popup - Consistent with Settings Popup */}
      {showPersonalSplitConfig && (
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
            backgroundColor: 'var(--color-backgroundElevated)',
            padding: '16px', // Reduced from 20px to match settings
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            width: '700px', // Reduced from 800px
            maxWidth: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '12px', // Reduced from 20px to match settings
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px' // Reduced from 16px to match settings
            }}>
              <h2 style={{ 
                margin: 0, 
                color: 'var(--color-text)',
                fontSize: '20px', // Reduced from 24px to match settings
                fontWeight: '600'
              }}>
                Personal Split Configuration
              </h2>
              <button
                onClick={handleClosePersonalSplitConfig}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  color: 'var(--color-textSecondary)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = 'var(--color-backgroundHover)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-textSecondary)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {isLoadingPersonalSplitConfig ? (
              <div style={{ textAlign: 'center', padding: '30px' }}> {/* Reduced from 40px */}
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  border: '4px solid #f3f4f6', 
                  borderTop: '4px solid #3b82f6', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }}></div>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Loading split configuration...</p>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '16px' }}> {/* Reduced from 20px */}
                  <p style={{ 
                    color: '#6b7280', 
                    fontSize: '13px', // Reduced from 14px
                    margin: '0 0 12px 0', // Reduced from 16px
                    lineHeight: '1.4'
                  }}>
                    Configure how budget categories from shared transactions are grouped and mapped to your personal savings buckets.
                  </p>
                  
                  {!showAddGroupForm ? (
                    <button
                      onClick={() => setShowAddGroupForm(true)}
                      style={{
                        padding: '6px 12px', // Reduced from 8px 16px to match settings buttons
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px', // Reduced from 14px
                        fontWeight: '500',
                        marginBottom: '12px', // Reduced from 16px
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={e => e.target.style.backgroundColor = '#2563eb'}
                      onMouseOut={e => e.target.style.backgroundColor = '#3b82f6'}
                    >
                      + Add Split Group
                    </button>
                  ) : (
                    <div style={{
                      padding: '12px',
                      backgroundColor: 'var(--color-backgroundTertiary)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      marginBottom: '12px' // Reduced from 16px
                    }}>
                      <h4 style={{ 
                        margin: '0 0 10px 0', // Reduced from 12px
                        color: 'var(--color-text)', 
                        fontSize: '14px', // Reduced from 16px
                        fontWeight: '600'
                      }}>
                        Add New Split Group
                      </h4>
                      
                      <div style={{ marginBottom: '10px' }}> {/* Reduced from 12px */}
                        <div style={{ marginBottom: '10px' }}> {/* Reduced from 12px */}
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '4px', 
                            marginLeft: '0px',
                            fontSize: '13px', // Reduced from 14px
                            fontWeight: '500', 
                            color: '#374151' 
                          }}>
                            Group Name
                          </label>
                          <input
                            type="text"
                            value={newGroupForm.group_name}
                            onChange={(e) => handleNewGroupFormChange('group_name', e.target.value)}
                            placeholder="e.g., Bills Split"
                            style={{
                              width: '100%',
                              padding: '6px 8px', // Reduced from 8px
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              fontSize: '13px', // Reduced from 14px
                              backgroundColor: 'var(--color-backgroundSecondary)',
                              color: 'var(--color-text)',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        
                        <div style={{ marginBottom: '10px' }}> {/* Reduced from 12px */}
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '6px', // Reduced from 8px
                            marginLeft: '0px',
                            fontSize: '13px', // Reduced from 14px
                            fontWeight: '500', 
                            color: 'var(--color-text)' 
                          }}>
                            Budget Categories ({newGroupForm.budget_categories.length} selected)
                          </label>
                          
                          {/* Compact category selection - optimized for single category selection */}
                          <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            backgroundColor: 'var(--color-backgroundSecondary)',
                            padding: '4px', // Reduced from 6px
                            maxHeight: newGroupForm.budget_categories.length > 0 ? '120px' : '150px', // Dynamic height
                            overflowY: 'auto'
                          }}>
                            {/* Show selected categories at top if any */}
                            {newGroupForm.budget_categories.length > 0 && (
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px',
                                padding: '4px',
                                marginBottom: '4px',
                                borderBottom: '1px solid #e5e7eb'
                              }}>
                                {newGroupForm.budget_categories.map(category => (
                                  <span key={category} style={{
                                    padding: '2px 8px', // Reduced from 3px 8px
                                    backgroundColor: '#ddd6fe',
                                    color: '#5b21b6',
                                    borderRadius: '12px',
                                    fontSize: '11px', // Reduced from 12px
                                    fontWeight: '500',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    {category}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updatedCategories = newGroupForm.budget_categories.filter(c => c !== category);
                                        handleNewGroupFormChange('budget_categories', updatedCategories);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#5b21b6',
                                        cursor: 'pointer',
                                        padding: '0',
                                        fontSize: '14px',
                                        lineHeight: '1',
                                        marginLeft: '2px'
                                      }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {/* Category checkboxes - ultra compact */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)', // Two columns for better space usage
                              gap: '1px' // Reduced from 2px
                            }}>
                              {availableBudgetCategories.map(category => {
                                const isAvailable = isCategoryAvailable(category);
                                const isSelected = newGroupForm.budget_categories.includes(category);
                                const isDisabled = !isAvailable && !isSelected;
                                
                                return (
                                  <label key={category} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px 4px', // Reduced from 4px 6px
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    borderRadius: '3px',
                                    transition: 'background-color 0.2s',
                                    opacity: isDisabled ? 0.5 : 1,
                                    backgroundColor: isSelected ? '#f0f4ff' : 'transparent',
                                    fontSize: '12px', // Reduced from 13px
                                    lineHeight: '1.2' // Tighter line height
                                  }}
                                  onMouseEnter={(e) => !isDisabled && (e.currentTarget.style.backgroundColor = isSelected ? '#f0f4ff' : '#f9fafb')}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#f0f4ff' : 'transparent'}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={isDisabled}
                                      onChange={(e) => {
                                        const currentCategories = newGroupForm.budget_categories;
                                        const updatedCategories = e.target.checked
                                          ? [...currentCategories, category]
                                          : currentCategories.filter(c => c !== category);
                                        handleNewGroupFormChange('budget_categories', updatedCategories);
                                      }}
                                      style={{
                                        marginRight: '4px', // Reduced from 6px
                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                        width: '12px', // Reduced from 14px
                                        height: '12px' // Reduced from 14px
                                      }}
                                    />
                                    <span style={{ 
                                      color: isDisabled ? '#9ca3af' : '#374151',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      {category}
                                    </span>
                                    {isDisabled && (
                                      <span style={{
                                        fontSize: '11px',
                                        color: '#ef4444',
                                        fontStyle: 'italic',
                                        marginLeft: '4px'
                                      }}>
                                        (used)
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label style={{ 
                            display: 'block', 
                            marginTop: '20px',
                            marginBottom: '0px',
                            marginLeft: '0px',
                            fontSize: '13px', // Reduced from 14px
                            fontWeight: '500',
                            color: '#374151' 
                          }}>
                            Personal Bucket
                          </label>
                          <select
                            value={newGroupForm.personal_category}
                            onChange={(e) => handleNewGroupFormChange('personal_category', e.target.value)}
                            style={{
                              width: '40%',
                              padding: '6px 8px', // Reduced from 8px
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              fontSize: '13px', // Reduced from 14px
                              backgroundColor: 'var(--color-backgroundSecondary)',
                              color: 'var(--color-text)',
                              boxSizing: 'border-box',
                              marginLeft: '0px',
                              marginTop: '5px'
                            }}
                          >
                            <option value="">Select personal bucket...</option>
                            {availablePersonalCategories.map(category => (
                              <option key={category.category} value={category.category}>
                                {category.category}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={cancelAddGroup}
                          style={{
                            padding: '6px 12px', // Consistent with other buttons
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px', // Reduced from 14px
                            fontWeight: '500',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={e => e.target.style.backgroundColor = '#e2e8f0'}
                          onMouseOut={e => e.target.style.backgroundColor = '#f1f5f9'}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateGroup}
                          disabled={!newGroupForm.group_name.trim() || !newGroupForm.personal_category.trim() || newGroupForm.budget_categories.length === 0}
                          style={{
                            padding: '6px 12px', // Consistent with other buttons
                            backgroundColor: (newGroupForm.group_name.trim() && newGroupForm.personal_category.trim() && newGroupForm.budget_categories.length > 0) ? '#7c3aed' : '#9ca3af',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: (newGroupForm.group_name.trim() && newGroupForm.personal_category.trim() && newGroupForm.budget_categories.length > 0) ? 'pointer' : 'not-allowed',
                            fontSize: '13px', // Reduced from 14px
                            fontWeight: '500',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={e => {
                            if (newGroupForm.group_name.trim() && newGroupForm.personal_category.trim() && newGroupForm.budget_categories.length > 0) {
                              e.target.style.backgroundColor = '#6d28d9';
                            }
                          }}
                          onMouseOut={e => {
                            if (newGroupForm.group_name.trim() && newGroupForm.personal_category.trim() && newGroupForm.budget_categories.length > 0) {
                              e.target.style.backgroundColor = '#7c3aed';
                            }
                          }}
                        >
                          Create Group
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {personalSplitGroups.length === 0 ? (
                  <div style={{
                    padding: '30px', // Reduced from 40px
                    backgroundColor: 'var(--color-backgroundTertiary)',
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: 'var(--color-textSecondary)'
                  }}>
                    <p style={{ fontSize: '14px', marginBottom: '8px' }}>No split groups configured yet.</p>
                    <p style={{ fontSize: '13px' }}>Click "Add Split Group" to create your first group.</p>
                  </div>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '6px', // Reduced from 8px
                    maxHeight: '400px', // Add max height for scrolling
                    overflowY: 'auto'
                  }}>
                    {personalSplitGroups.map((group) => (
                      <div key={group.id} style={{
                        padding: '10px', // Reduced from 12px
                        backgroundColor: 'var(--color-backgroundTertiary)',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border)'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'flex-start',
                          marginBottom: '6px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}> {/* Added minWidth: 0 for text truncation */}
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              marginBottom: '2px',
                              flexWrap: 'wrap' // Allow wrapping on small screens
                            }}>
                              <h4 style={{ 
                                margin: '0', 
                                color: '#1e293b', 
                                fontSize: '14px',
                                fontWeight: '600',
                                lineHeight: '1.2'
                              }}>
                                {group.group_name}
                              </h4>
                              <span style={{ 
                                fontSize: '12px',
                                color: '#64748b',
                                backgroundColor: '#e2e8f0',
                                padding: '1px 5px',
                                borderRadius: '8px',
                                fontWeight: '500',
                                whiteSpace: 'nowrap'
                              }}>
                                {group.mapped_categories ? group.mapped_categories.length : 0} {group.mapped_categories?.length === 1 ? 'category' : 'categories'}
                              </span>
                            </div>
                            <p style={{ 
                              margin: '0', 
                              color: '#64748b', 
                              fontSize: '12px', // Reduced from 13px
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              → <strong style={{ color: '#4b5563' }}>{group.personal_category}</strong>
                            </p>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            flexShrink: 0 // Prevent button shrinking
                          }}>
                            {!editingGroups[group.id] ? (
                              <>
                                <button
                                  onClick={() => startEditingGroup(group.id)}
                                  style={{
                                    padding: '4px 8px', // Reduced from 3px 6px
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseOver={e => {
                                    e.target.style.backgroundColor = '#e2e8f0';
                                    e.target.style.borderColor = '#94a3b8';
                                  }}
                                  onMouseOut={e => {
                                    e.target.style.backgroundColor = '#f1f5f9';
                                    e.target.style.borderColor = '#cbd5e1';
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm(`Delete split group "${group.group_name}"?`)) {
                                      try {
                                        await deletePersonalSplitGroup(group.id);
                                      } catch (error) {
                                        showErrorNotification('Failed to delete split group');
                                      }
                                    }
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#ef4444',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                  onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                  title="Delete group"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => saveEditingGroup(group.id)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseOver={e => e.target.style.backgroundColor = '#059669'}
                                  onMouseOut={e => e.target.style.backgroundColor = '#10b981'}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => cancelEditingGroup(group.id)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#f3f4f6',
                                    color: '#6b7280',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseOver={e => {
                                    e.target.style.backgroundColor = '#e5e7eb';
                                    e.target.style.borderColor = '#9ca3af';
                                  }}
                                  onMouseOut={e => {
                                    e.target.style.backgroundColor = '#f3f4f6';
                                    e.target.style.borderColor = '#d1d5db';
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Categories display */}
                        {!editingGroups[group.id] ? (
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '3px',
                            maxHeight: group.mapped_categories?.length <= 3 ? 'auto' : '50px', // Auto height for 3 or fewer categories
                            overflowY: group.mapped_categories?.length > 3 ? 'auto' : 'visible',
                            padding: '4px',
                            backgroundColor: 'var(--color-backgroundSecondary)',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)'
                          }}>
                            {group.mapped_categories && group.mapped_categories.length > 0 ? (
                              group.mapped_categories.map((mapping) => (
                                <span key={mapping.id} style={{
                                  padding: '2px 6px',
                                  backgroundColor: 'var(--color-backgroundTertiary)',
                                  color: 'var(--color-text)',
                                  borderRadius: '8px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-block',
                                  lineHeight: '1.2'
                                }}>
                                  {mapping.budget_category}
                                </span>
                              ))
                            ) : (
                              <span style={{ 
                                color: 'var(--color-textSecondary)', 
                                fontSize: '11px',
                                fontStyle: 'italic',
                                padding: '2px'
                              }}>
                                No categories mapped
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{
                            maxHeight: '120px', // Reduced from 150px
                            overflowY: 'auto',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px', // Updated to match add form (was 4px)
                            backgroundColor: 'var(--color-backgroundSecondary)',
                            padding: '4px',
                            marginTop: '6px'
                          }}>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)', // Two columns
                              gap: '1px' // Reduced from 2px
                            }}>
                              {availableBudgetCategories.map(category => {
                                const isSelected = editingChanges[group.id] ? 
                                  editingChanges[group.id].includes(category) : false;
                                const isAvailable = isCategoryAvailable(category, group.id);
                                const isDisabled = !isAvailable && !isSelected;
                                
                                return (
                                  <label key={category} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px 4px', // Updated to match add form (was 2px 3px)
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    borderRadius: '3px',
                                    backgroundColor: isSelected ? '#f0f4ff' : 'transparent',
                                    opacity: isDisabled ? 0.5 : 1,
                                    fontSize: '12px', // Updated to match add form (was 11px)
                                    lineHeight: '1.2', // Tighter line height
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseEnter={(e) => !isDisabled && (e.currentTarget.style.backgroundColor = isSelected ? '#f0f4ff' : '#f9fafb')}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#f0f4ff' : 'transparent'}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={isDisabled}
                                      onChange={(e) => {
                                        handleEditingCategoryChange(group.id, category, e.target.checked);
                                      }}
                                      style={{
                                        marginRight: '4px', // Updated to match add form (was 3px)
                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                        width: '12px', // Updated to match add form (was 11px)
                                        height: '12px' // Updated to match add form (was 11px)
                                      }}
                                    />
                                    <span style={{ 
                                      color: isDisabled ? '#9ca3af' : '#374151',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      {category}
                                    </span>
                                    {isDisabled && (
                                      <span style={{
                                        fontSize: '9px',
                                        color: '#ef4444',
                                        fontStyle: 'italic',
                                        marginLeft: '4px' // Updated to match add form (was 1px)
                                      }}>
                                        (used)
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              marginTop: '16px', // Reduced from 24px
              paddingTop: '12px', // Reduced from 16px
              borderTop: '1px solid var(--color-border)'
            }}>
              <button
                onClick={handleClosePersonalSplitConfig}
                style={{
                  padding: '8px 16px', // Reduced from 10px 20px
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px', // Reduced from 14px
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#4338ca'}
                onMouseOut={e => e.target.style.backgroundColor = '#4f46e5'}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other modals remain unchanged */}
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
            backgroundColor: 'var(--color-backgroundElevated)',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            width: '400px',
            maxWidth: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
                          <h2 style={{ marginTop: 0, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>Add Personal Transaction</h2>
            
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
                    border: '1px solid var(--color-inputBorder)',
                    fontSize: '14px',
                    backgroundColor: 'var(--color-inputBackground)',
                    color: 'var(--color-inputText)',
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
            backgroundColor: 'var(--color-backgroundElevated)',
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
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '16px'
            }}>
              <h2 style={{ 
                margin: 0, 
                color: 'var(--color-text)',
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
                  color: 'var(--color-textSecondary)',
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
                backgroundColor: 'var(--color-backgroundTertiary)', 
                borderRadius: '8px',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '13px', 
                      color: 'var(--color-textSecondary)', 
                      marginBottom: '4px',
                      fontWeight: '500'
                    }}>
                      Original Transaction
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: 'var(--color-text)',
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
                        backgroundColor: 'var(--color-infoLight)',
                        color: 'var(--color-info)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        border: '1px solid var(--color-info)'
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
                          backgroundColor: 'var(--color-successLight)',
                          color: 'var(--color-success)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          border: '1px solid var(--color-success)'
                        }}>
                          🏷️ {transactionToSplit.category}
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
                backgroundColor: calculateRemainingAmount() === 0 ? 'var(--color-successLight)' : 'var(--color-warningLight)',
                borderRadius: '8px',
                border: `1px solid ${calculateRemainingAmount() === 0 ? 'var(--color-success)' : 'var(--color-warning)'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ 
                  fontSize: '13px', 
                  color: 'var(--color-text)',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>Remaining:</span>
                  <span style={{ 
                    color: calculateRemainingAmount() < 0 ? 'var(--color-error)' : 'var(--color-success)',
                    fontWeight: '600'
                  }}>
                    {calculateRemainingAmount() < 0 
                      ? `-$${Math.abs(calculateRemainingAmount()).toFixed(2)}` 
                      : `$${calculateRemainingAmount().toFixed(2)}`}
                  </span>
                </span>
                <span style={{ 
                  fontSize: '12px', 
                  color: calculateRemainingAmount() === 0 ? 'var(--color-success)' : 'var(--color-warning)'
                }}>
                  {calculateRemainingAmount() === 0 
                    ? '✓ Fully allocated' 
                    : 'Will remain on original'}
                </span>
              </div>
              
              {/* Personal Split Options - Simplified */}
              {personalSplitEnabled && personalSplitGroups.length > 0 && (
                <div style={{ 
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: 'var(--color-purpleLight)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-purple)'
                }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    gap: '8px',
                    marginBottom: useSmartSplit ? '12px' : '0'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={useSmartSplit}
                      onChange={(e) => {
                        setUseSmartSplit(e.target.checked);
                        if (e.target.checked) {
                          // Automatically load split data when enabled
                          setTimeout(() => loadSmartSplitData(), 100);
                        }
                      }}
                      style={{ 
                        cursor: 'pointer',
                        width: '16px',
                        height: '16px',
                        marginTop: '1px'
                      }}
                    />
                    <div>
                      <div style={{ 
                        fontSize: '14px',
                        color: 'var(--color-purple)',
                        fontWeight: '500'
                      }}>
                        Use configured split groups
                      </div>
                      <div style={{ 
                        fontSize: '12px',
                        color: 'var(--color-purple)',
                        marginTop: '2px',
                        lineHeight: '1.3'
                      }}>
                        Automatically split based on your configured category mappings ({personalSplitDefaultDays} days lookback)
                      </div>
                    </div>
                  </label>
                  
                  {useSmartSplit && (
                    <div style={{ 
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ 
                          fontSize: '11px',
                          color: '#6b7280',
                          fontWeight: '500',
                          display: 'block',
                          marginBottom: '2px'
                        }}>Date Range</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px' }}>
                          <input
                            type="date"
                            value={smartSplitFilters.startDate}
                            onChange={(e) => setSmartSplitFilters(prev => ({
                              ...prev,
                              startDate: e.target.value
                            }))}
                            style={{
                              padding: '4px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              fontSize: '12px',
                              backgroundColor: 'var(--color-backgroundSecondary)',
                              color: 'var(--color-text)'
                            }}
                          />
                          <span style={{ color: 'var(--color-textSecondary)' }}>to</span>
                          <input
                            type="date"
                            value={smartSplitFilters.endDate}
                            onChange={(e) => setSmartSplitFilters(prev => ({
                              ...prev,
                              endDate: e.target.value
                            }))}
                            style={{
                              padding: '4px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              fontSize: '12px',
                              backgroundColor: 'var(--color-backgroundSecondary)',
                              color: 'var(--color-text)'
                            }}
                          />
                        </div>
                      </div>
                      
                      <button
                        onClick={loadSmartSplitData}
                        disabled={isLoadingSmartSplit}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: isLoadingSmartSplit ? 'var(--color-textTertiary)' : 'var(--color-purple)',
                          color: 'var(--color-buttonPrimaryText)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isLoadingSmartSplit ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          marginTop: '16px'
                        }}
                      >
                        {isLoadingSmartSplit ? 'Loading...' : 'Refresh'}
                      </button>
                    </div>
                  )}
                  
                  {smartSplitData && (
                    <div style={{
                      padding: '8px',
                      backgroundColor: 'var(--color-successLight)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: 'var(--color-success)',
                      border: '1px solid var(--color-success)'
                    }}>
                      <div style={{ marginBottom: '6px', fontWeight: '500' }}>
                        ✓ Loaded {smartSplitData.count} transactions • Total: {smartSplitData.totalAmount < 0 ? `-$${Math.abs(smartSplitData.totalAmount).toFixed(2)}` : `$${smartSplitData.totalAmount.toFixed(2)}`}
                      </div>
                      
                      {/* Show configured group breakdown */}
                      <div style={{ fontSize: '11px', color: 'var(--color-success)' }}>
                        {Object.entries(smartSplitData.groupedTotals).map(([groupName, data]) => {
                          const groupConfig = personalSplitGroups.find(g => g.group_name === groupName);
                          
                          if (groupConfig && groupConfig.personal_category !== 'original') {
                            return (
                              <div key={groupName} style={{ 
                                marginLeft: '8px', 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span>{groupName} → {groupConfig.personal_category}</span>
                                <span style={{ fontWeight: 'bold' }}>
                                  {data.total < 0 ? `-$${Math.abs(data.total).toFixed(2)}` : `$${data.total.toFixed(2)}`}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show message if personal split is not configured */}
              {(!personalSplitEnabled || personalSplitGroups.length === 0) && (
                <div style={{ 
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: 'var(--color-warningLight)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-warning)'
                }}>
                  <div style={{ 
                    fontSize: '13px',
                    color: 'var(--color-warning)',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    Personal Split Not Configured
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    color: 'var(--color-warning)',
                    lineHeight: '1.3'
                  }}>
                    {!personalSplitEnabled 
                      ? 'Enable personal split in Settings to use automatic category mapping.'
                      : 'Configure split groups in Settings to use automatic splitting.'}
                  </div>
                </div>
              )}

              {/* Split Transactions - More Compact */}
              <div style={{ 
                flex: 1, 
                overflowY: 'auto',
                marginBottom: '16px'
              }}>
                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: 'var(--color-text)',
                  marginBottom: '12px'
                }}>
                  Split Into {splitTransactions.length} Transaction{splitTransactions.length > 1 ? 's' : ''}
                </h3>
                
                {splitTransactions.map((split, index) => (
                  <div key={index} style={{ 
                    marginBottom: '12px', 
                    padding: '12px', 
                    backgroundColor: 'var(--color-backgroundSecondary)', 
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
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
                          backgroundColor: 'var(--color-errorLight)',
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
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="3">
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
                          border: '1px solid var(--color-inputBorder)',
                          fontSize: '14px',
                          width: '100%',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.2s',
                          backgroundColor: 'var(--color-inputBackground)',
                          color: 'var(--color-inputText)'
                        }}
                        placeholder="Description"
                        onFocus={(e) => e.target.style.borderColor = 'var(--color-borderFocus)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--color-inputBorder)'}
                      />
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={split.amount}
                          onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-inputBorder)',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                            transition: 'border-color 0.2s',
                            backgroundColor: 'var(--color-inputBackground)',
                            color: 'var(--color-inputText)'
                          }}
                          placeholder="Amount"
                          onFocus={(e) => e.target.style.borderColor = 'var(--color-borderFocus)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--color-inputBorder)'}
                        />
                        
                        <select
                          value={split.category}
                          onChange={(e) => handleSplitChange(index, 'category', e.target.value)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-inputBorder)',
                            fontSize: '14px',
                            backgroundColor: 'var(--color-inputBackground)',
                            color: 'var(--color-inputText)',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--color-borderFocus)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--color-inputBorder)'}
                        >
                          <option value="">Category</option>
                          {availableCategories.map(category => (
                            <option key={category} value={category}>{category}</option>
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
                    color: 'var(--color-buttonPrimary)',
                    border: '1px dashed var(--color-buttonPrimary)',
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
                    e.target.style.backgroundColor = 'var(--color-backgroundHover)';
                    e.target.style.borderColor = 'var(--color-buttonPrimaryHover)';
                    e.target.style.color = 'var(--color-buttonPrimaryHover)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.borderColor = 'var(--color-buttonPrimary)';
                    e.target.style.color = 'var(--color-buttonPrimary)';
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
                borderTop: '1px solid var(--color-border)'
              }}>
                <button
                  onClick={cancelSplit}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'var(--color-buttonSecondary)',
                    color: 'var(--color-buttonSecondaryText)',
                    border: '1px solid var(--color-buttonSecondaryBorder)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = 'var(--color-buttonSecondaryHover)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'var(--color-buttonSecondary)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSplit}
                  disabled={isSavingSplit}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: isSavingSplit ? 'var(--color-textTertiary)' : 'var(--color-buttonPrimary)',
                    color: 'var(--color-buttonPrimaryText)',
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
                      e.target.style.backgroundColor = 'var(--color-buttonPrimaryHover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSavingSplit) {
                      e.target.style.backgroundColor = 'var(--color-buttonPrimary)';
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

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedChangesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--color-modalBackground)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 25px -5px var(--color-shadow), 0 10px 10px -5px var(--color-shadowLight)',
            animation: 'modalSlideIn 0.2s ease-out'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827'
              }}>
                Unsaved Changes
              </h3>
            </div>
            
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.5'
            }}>
              You have unsaved changes to your split group configuration. Are you sure you want to close without saving? All changes will be discarded.
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={handleCancelDiscardChanges}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'var(--color-buttonSecondary)',
                  color: 'var(--color-buttonSecondaryText)',
                  border: '1px solid var(--color-buttonSecondaryBorder)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'var(--color-buttonSecondaryHover)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'var(--color-buttonSecondary)';
                  e.target.style.borderColor = 'var(--color-buttonSecondaryBorder)';
                }}
              >
                Keep Editing
              </button>
              <button
                onClick={handleConfirmDiscardChanges}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#dc2626';
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalTransactions;