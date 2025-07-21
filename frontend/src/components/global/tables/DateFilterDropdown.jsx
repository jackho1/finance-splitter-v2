import React from 'react';
import './DateFilterDropdown.css';

// Specialized date filter dropdown component - EXTRACTED FROM ORIGINAL App.jsx
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

export default DateFilterDropdown; 