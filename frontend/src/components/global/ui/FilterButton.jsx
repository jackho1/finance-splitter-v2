import React from 'react';

// Refactored FilterButton component for more streamlined appearance - EXTRACTED FROM ORIGINAL App.jsx
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

export default FilterButton;
