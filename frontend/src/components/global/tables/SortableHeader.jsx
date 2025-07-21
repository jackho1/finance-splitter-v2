import React from 'react';
// Import FilterButton from the same global components
import FilterButton from '../ui/FilterButton';

// Sortable header component - EXTRACTED FROM ORIGINAL PersonalTransactions.jsx
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

export default SortableHeader;
