import React, { createContext, useContext, useState, useEffect } from 'react';
import useUserPreferences from '../hooks/useUserPreferences';

const UserPreferencesContext = createContext();

/**
 * User Preferences Provider Component
 * Manages user color preferences at the app level
 */
export const UserPreferencesProvider = ({ children }) => {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [users, setUsers] = useState([]);
  
  // Use the custom hook for preferences management
  const {
    preferences,
    loading,
    error,
    updatePreferences,
    refreshPreferences,
    rgbaToString,
    rgbaToHex,
    hexToRgba,
    getUserColor,
    getTransactionRowColor,
    defaultPreferences
  } = useUserPreferences(currentUserId);

  // Initialize current user ID when users are available
  useEffect(() => {
    if (users.length > 0 && !currentUserId) {
      // Default to first non-default user or first user
      const firstUser = users.find(user => user.username !== 'default') || users[0];
      if (firstUser) {
        setCurrentUserId(firstUser.id);
      }
    }
  }, [users, currentUserId]);

  /**
   * Update the current user (useful for multi-user scenarios)
   * @param {number} userId - The user ID to set as current
   */
  const setCurrentUser = (userId) => {
    setCurrentUserId(userId);
  };

  /**
   * Get color for totals display based on user
   * @param {string} userDisplayName - Display name of the user
   * @returns {Object} Object with background and border colors
   */
  const getUserTotalColors = (userDisplayName) => {
    if (!users.length) {
      return {
        bg: 'rgba(54, 162, 235, 0.2)',
        border: 'rgba(54, 162, 235, 1)'
      };
    }

    const user = users.find(u => u.display_name === userDisplayName);
    if (!user) {
      return {
        bg: 'rgba(200, 200, 200, 0.2)',
        border: 'rgba(200, 200, 200, 1)'
      };
    }

    // Get user's primary and secondary colors
    const primaryColor = getUserColor(user.id, 'primary');
    const secondaryColor = getUserColor(user.id, 'secondary');
    
    // Extract RGB values - secondary for background, primary for border
    const primaryMatch = primaryColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    const secondaryMatch = secondaryColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    
    if (primaryMatch && secondaryMatch) {
      const [, primaryR, primaryG, primaryB] = primaryMatch;
      const [, secondaryR, secondaryG, secondaryB] = secondaryMatch;
      return {
        bg: `rgba(${secondaryR}, ${secondaryG}, ${secondaryB}, 0.2)`,
        border: `rgba(${primaryR}, ${primaryG}, ${primaryB}, 1)`
      };
    }

    // Fallback
    return {
      bg: 'rgba(54, 162, 235, 0.2)',
      border: 'rgba(54, 162, 235, 1)'
    };
  };

  const contextValue = {
    // User management
    currentUserId,
    users,
    setUsers,
    setCurrentUser,
    
    // Preferences
    preferences,
    loading,
    error,
    updatePreferences,
    refreshPreferences,
    
    // Color utilities
    rgbaToString,
    rgbaToHex,
    hexToRgba,
    getUserColor,
    getTransactionRowColor,
    getUserTotalColors,
    
    // Default preferences
    defaultPreferences
  };

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

/**
 * Custom hook to use user preferences context
 * @returns {Object} User preferences context value
 */
export const useUserPreferencesContext = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferencesContext must be used within a UserPreferencesProvider');
  }
  return context;
};

export default UserPreferencesContext;
