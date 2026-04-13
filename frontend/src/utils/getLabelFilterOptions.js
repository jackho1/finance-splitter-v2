// Helper function to get label options for filter dropdowns
// This returns an array of strings (not objects) for compatibility with TableDropdownMenu
export const getLabelFilterOptions = (users, splitAllocations, transactions) => {
  // Guard clause: return empty array if users is not loaded yet
  if (!users || !Array.isArray(users) || users.length === 0) {
    return [];
  }
  
  // Guard clause: ensure splitAllocations exists
  if (!splitAllocations || !transactions || !Array.isArray(transactions)) {
    return [];
  }
  
  const labelOptions = new Set();
  
  // Get active users (excluding 'default' system user)
  const activeUsers = users.filter(user => user.username !== 'default' && user.is_active);
  
  // Add individual user display names
  activeUsers.forEach(user => {
    labelOptions.add(user.display_name);
  });
  
  // Check if we have "Both" or "All users" in any transactions
  // by analyzing the split allocations
  let hasTwoUserSplits = false;
  let hasMultiUserSplits = false;
  
  transactions.forEach(transaction => {
    const allocations = splitAllocations[transaction.id];
    if (allocations && Array.isArray(allocations)) {
      if (allocations.length === 2) {
        // Check if it's an equal split
        const isEqualSplit = allocations.every(alloc => 
          alloc.split_type_code === 'equal' || 
          Math.abs(parseFloat(alloc.percentage) - 50) < 0.1
        );
        if (isEqualSplit) {
          hasTwoUserSplits = true;
        }
      } else if (allocations.length >= 3) {
        // Check if it's an equal split among all users
        const expectedPercentage = 100 / allocations.length;
        const isEqualSplit = allocations.every(alloc => 
          alloc.split_type_code === 'equal' || 
          Math.abs(parseFloat(alloc.percentage) - expectedPercentage) < 0.1
        );
        if (isEqualSplit) {
          hasMultiUserSplits = true;
        }
      }
    }
  });
  
  // Also check for any unallocated transactions (null labels)
  const hasUnallocated = transactions.some(transaction => {
    const allocations = splitAllocations[transaction.id];
    return !allocations || allocations.length === 0;
  });
  
  // Convert to array and separate individual users from collective options
  const allOptions = Array.from(labelOptions);
  const individualUsers = allOptions.filter(option => option !== 'Both' && option !== 'All users').sort();
  const collectiveOptions = [];
  
  // Add collective options at the end if they exist in the data
  if (hasTwoUserSplits && activeUsers.length >= 2) {
    collectiveOptions.push('Both');
  }
  
  if (hasMultiUserSplits && activeUsers.length >= 3) {
    collectiveOptions.push('All users');
  }
  
  // Combine individual users first, then collective options
  let optionsArray = [...individualUsers, ...collectiveOptions];
  
  // Add null option at the very end if there are unallocated transactions
  if (hasUnallocated) {
    optionsArray.push(null);
  }
  
  return optionsArray;
};

// Helper function to get label dropdown options for forms (returns {value, label} objects)
export const getLabelDropdownOptions = (users) => {
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
