import React, { createContext, useContext, useState, useEffect } from 'react';
import useUserPreferences from '../hooks/useUserPreferences';
import { USER_COLOR_OPACITIES } from '../utils/colorConstants';

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
        bg: `rgba(54, 162, 235, ${USER_COLOR_OPACITIES.BACKGROUND})`,
        border: 'rgba(54, 162, 235, 1)'
      };
    }

    const user = users.find(u => u.display_name === userDisplayName);
    if (!user) {
      return {
        bg: `rgba(200, 200, 200, ${USER_COLOR_OPACITIES.BACKGROUND})`,
        border: 'rgba(200, 200, 200, 1)'
      };
    }

    // Get user's primary color only
    const primaryColor = getUserColor(user.id, 'primary');
    
    // Extract RGB values - use primary for both with different opacity
    const primaryMatch = primaryColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    
    if (primaryMatch) {
      const [, primaryR, primaryG, primaryB] = primaryMatch;
      return {
        bg: `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${USER_COLOR_OPACITIES.BACKGROUND})`,
        border: `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${USER_COLOR_OPACITIES.BORDER})`
      };
    }

    // Fallback
    return {
      bg: `rgba(54, 162, 235, ${USER_COLOR_OPACITIES.BACKGROUND})`,
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
