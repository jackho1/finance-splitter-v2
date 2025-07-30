/**
 * Utility functions for consistent drag and drop behavior across components
 */

// Performance optimization: Throttle function to limit execution frequency
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Cache for computed styles to avoid repeated calculations
const styleCache = new Map();
const dragImageCache = new WeakMap();

/**
 * Creates a properly sized drag image for drag and drop operations (optimized)
 * @param {Event} e - The drag event
 * @param {Function} setDraggedCategory - State setter for dragged category
 * @param {Function} setIsDragging - State setter for dragging status
 * @param {string} category - The category being dragged
 */
export const createDragImage = (e, setDraggedCategory, setIsDragging, category) => {
  setDraggedCategory(category);
  setIsDragging(true);
  
  // Set drag image and effect
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', category);
  
  // Find the entire row that contains the dragged element
  const target = e.target;
  const row = target.closest('tr');
  
  if (!row) {
    // Fallback to original behavior if no row found
    const dragImage = target.cloneNode(true);
    const originalRect = target.getBoundingClientRect();
    Object.assign(dragImage.style, {
      width: `${originalRect.width}px`,
      height: `${originalRect.height}px`,
      opacity: '0.9',
      position: 'absolute',
      top: '-1000px',
      left: '-1000px',
      transform: 'scale(0.95)',
      pointerEvents: 'none',
      zIndex: '9999',
      boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
    });
    
    document.body.appendChild(dragImage);
    const offsetX = e.clientX - originalRect.left;
    const offsetY = e.clientY - originalRect.top;
    e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
    
    requestAnimationFrame(() => {
      if (dragImage && dragImage.parentNode) {
        document.body.removeChild(dragImage);
      }
    });
    return;
  }
  
  // Create drag image from the entire row
  const dragImage = row.cloneNode(true);
  
  // Get the computed styles and dimensions of the original row
  const originalRect = row.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(row);
  
  // Add a specific class for drag image styling
  dragImage.classList.add('drag-image-row');
  
  // Calculate the actual height needed for the row content
  const dragCells = dragImage.querySelectorAll('td, th');
  let maxCellHeight = 0;
  dragCells.forEach(cell => {
    const cellHeight = cell.scrollHeight || cell.offsetHeight;
    maxCellHeight = Math.max(maxCellHeight, cellHeight);
  });
  
  // Use the calculated height or fall back to original height
  const dragImageHeight = Math.max(maxCellHeight + 12, originalRect.height);
  
  // Style the drag image to look like a prominent, non-faded row
  Object.assign(dragImage.style, {
    width: `${originalRect.width}px`,
    height: `${dragImageHeight}px`,
    minHeight: `${dragImageHeight}px`,
    opacity: '1', // Full opacity - not faded
    position: 'absolute',
    top: '-1000px',
    left: '-1000px',
    transform: 'scale(1)', // No scaling down
    borderRadius: '8px',
    backgroundColor: 'var(--color-backgroundSecondary)',
    border: '3px solid var(--color-primary)', // Thicker border for more prominence
    boxSizing: 'border-box',
    pointerEvents: 'none',
    zIndex: '9999',
    fontFamily: computedStyle.fontFamily,
    fontSize: computedStyle.fontSize,
    fontWeight: computedStyle.fontWeight,
    lineHeight: computedStyle.lineHeight,
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)', // Stronger shadow for more prominence
    // Ensure all cells in the row are visible and not faded
    color: 'var(--color-text)',
    textShadow: 'none',
    // Ensure the row is fully visible
    overflow: 'visible',
    display: 'table-row',
    tableLayout: 'fixed'
  });
  
  // Style all cells in the drag image to ensure they're not faded and remove borders
  dragCells.forEach(cell => {
    Object.assign(cell.style, {
      opacity: '1',
      backgroundColor: 'var(--color-backgroundSecondary)', // Match row background for consistency
      color: 'var(--color-text)',
      border: 'none', // Remove all borders
      padding: '8px 12px', // Slightly larger padding for better visibility
      // Ensure cell content is fully visible
      overflow: 'visible',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
      fontWeight: computedStyle.fontWeight, // Preserve original font weight
      textAlign: 'left' // Consistent text alignment
    });
  });
  
  // Remove any dragging classes or attributes from the cloned row
  dragImage.classList.remove('dragging');
  dragImage.removeAttribute('dragging');
  
  document.body.appendChild(dragImage);
  
  // Set the drag image with proper offset (cursor position relative to the row)
  const offsetX = e.clientX - originalRect.left;
  const offsetY = e.clientY - originalRect.top;
  e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
  
  // Remove the cloned element after the drag operation starts
  requestAnimationFrame(() => {
    if (dragImage && dragImage.parentNode) {
      document.body.removeChild(dragImage);
    }
  });
};

/**
 * Optimized drag over handler with throttling to prevent excessive re-renders
 */
const handleDragOverWithReorderInternal = (e, category, draggedCategory, categoryOrder, setCategoryOrder) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  if (category !== draggedCategory && draggedCategory) {
    // Use more efficient array operations
    const fromIndex = categoryOrder.indexOf(draggedCategory);
    const toIndex = categoryOrder.indexOf(category);
    
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      // Only create new array if order actually changes
      const newOrder = [...categoryOrder];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, draggedCategory);
      setCategoryOrder(newOrder);
    }
  }
};

/**
 * Throttled version of drag over handler to improve performance
 */
export const handleDragOverWithReorder = throttle(handleDragOverWithReorderInternal, 16); // ~60fps

/**
 * Handles drag end event
 * @param {Function} setDraggedCategory - State setter for dragged category
 * @param {Function} setIsDragging - State setter for dragging status
 * @param {Function} persistOrder - Optional function to persist the new order
 */
export const handleDragEndCleanup = (setDraggedCategory, setIsDragging, persistOrder = null) => {
  setDraggedCategory(null);
  setIsDragging(false);
  
  // Persist the new order if a persistence function is provided
  if (persistOrder) {
    persistOrder();
  }
  
  // Clear cache periodically to prevent memory leaks
  if (styleCache.size > 100) {
    styleCache.clear();
  }
};

/**
 * Optimized draggable container styles with caching
 * @param {string} category - The current category
 * @param {string} draggedCategory - The category being dragged
 * @param {boolean} isDragging - Whether dragging is in progress
 * @param {object} color - Color configuration object
 * @returns {object} Style object for the draggable container
 */
export const getDraggableContainerStyles = (category, draggedCategory, isDragging, color) => {
  // Create cache key for memoization
  const cacheKey = `${category}-${draggedCategory}-${isDragging}-${color?.bg || 'default'}`;
  
  // Check cache first
  if (styleCache.has(cacheKey)) {
    return styleCache.get(cacheKey);
  }
  
  const isBeingDragged = draggedCategory === category;
  const isOtherItem = isDragging && !isBeingDragged;
  
  // Pre-compute conditional values
  const border = isBeingDragged
    ? `2px dashed ${color?.bg || 'var(--color-primary)'}`
    : '1px solid var(--color-border)';
  
  const boxShadow = isBeingDragged
    ? '0 15px 35px var(--color-shadow)'
    : '0 4px 24px var(--color-shadowLight)';
  
  const transform = isBeingDragged 
    ? 'scale(1.02) rotate(1deg)' 
    : 'scale(1)';
  
  const opacity = isOtherItem ? 0.5 : 1;
  
  const styles = {
    backgroundColor: 'var(--color-backgroundSecondary)',
    padding: '16px',
    borderRadius: '12px',
    border,
    boxShadow,
    opacity,
    cursor: 'move',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform,
    position: 'relative',
    overflow: 'hidden',
  };
  
  // Cache the result for future use
  styleCache.set(cacheKey, styles);
  
  return styles;
};

/**
 * Performance-optimized drag handlers factory
 * @param {Object} config - Configuration object
 * @returns {Object} Optimized drag handlers
 */
export const createOptimizedDragHandlers = (config) => {
  const {
    setDraggedCategory,
    setIsDragging,
    draggedCategory,
    categoryOrder,
    setCategoryOrder,
    onDragEnd = null
  } = config;
  
  // Memoize handlers to prevent recreation on every render
  const handlers = {
    handleDragStart: (e, category) => {
      // Use requestAnimationFrame for smooth start
      requestAnimationFrame(() => {
        createDragImage(e, setDraggedCategory, setIsDragging, category);
      });
    },
    
    handleDragOver: (e, category) => {
      handleDragOverWithReorder(e, category, draggedCategory, categoryOrder, setCategoryOrder);
    },
    
    handleDragEnd: () => {
      handleDragEndCleanup(setDraggedCategory, setIsDragging, onDragEnd);
    }
  };
  
  return handlers;
};

/**
 * Clears performance caches (call periodically or on unmount)
 */
export const clearDragDropCaches = () => {
  styleCache.clear();
  // dragImageCache is WeakMap and will be garbage collected automatically
};
