import React from 'react';

// Refactored table dropdown menu component - EXTRACTED FROM ORIGINAL PersonalTransactions.jsx
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

export default TableDropdownMenu;
