import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiUtils';
import { USER_COLOR_OPACITIES, THEME_OPTIONS } from '../utils/colorConstants';

// Move defaultPreferences outside the component to prevent recreation on every render
const createDefaultPreferences = (userId) => ({
  user_id: userId,
  primary: { r: 54, g: 162, b: 235, a: USER_COLOR_OPACITIES.BACKGROUND },
  secondary: { r: 54, g: 162, b: 235, a: USER_COLOR_OPACITIES.BACKGROUND }, // Keep for backward compatibility
  theme: THEME_OPTIONS.LIGHT
});

/**
 * Custom hook for managing user color preferences
 * @param {number} userId - The user ID to fetch preferences for
 * @returns {Object} Object containing preferences, loading state, and update function
 */
const useUserPreferences = (userId) => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize default preferences to use while loading or if user has no saved preferences
  const defaultPreferences = useMemo(() => createDefaultPreferences(userId), [userId]);

  /**
   * Convert RGBA object to CSS rgba string
   * @param {Object} color - Color object with r, g, b, a properties
   * @returns {string} CSS rgba string
   */
  const rgbaToString = useCallback((color) => {
    if (!color || typeof color !== 'object') {
      return 'rgba(54, 162, 235, 1)'; // fallback
    }
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
  }, []);

  /**
   * Convert RGBA object to hex string (for color pickers)
   * @param {Object} color - Color object with r, g, b, a properties
   * @returns {string} Hex color string
   */
  const rgbaToHex = useCallback((color) => {
    if (!color || typeof color !== 'object') {
      return '#36a2eb'; // fallback
    }
    const toHex = (c) => {
      const hex = Math.round(c).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }, []);

  /**
   * Convert hex string to RGBA object
   * @param {string} hex - Hex color string
   * @param {number} alpha - Alpha value (0-1)
   * @returns {Object} RGBA object
   */
  const hexToRgba = useCallback((hex, alpha = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: alpha
    } : { r: 54, g: 162, b: 235, a: 1 }; // fallback
  }, []);

  /**
   * Get user color for a specific user
   * @param {number} targetUserId - The user ID to get color for
   * @param {string} colorType - Type of color ('primary', 'secondary', 'tertiary')
   * @returns {string} CSS rgba string
   */
  const getUserColor = useCallback((targetUserId, colorType = 'primary') => {
    const currentPrefs = preferences || defaultPreferences;
    
    // If this is the current user, return their specified color
    if (targetUserId === userId) {
      return rgbaToString(currentPrefs[colorType]);
    }
    
    // For other users, we could implement a deterministic color generation
    // based on their user ID to ensure consistency
    const colors = [
      currentPrefs.primary,
      currentPrefs.secondary,
      currentPrefs.tertiary,
      { r: 153, g: 102, b: 255, a: 1 }, // Purple
      { r: 255, g: 159, b: 64, a: 1 },  // Orange
      { r: 255, g: 205, b: 86, a: 1 },  // Yellow
      { r: 75, g: 192, b: 192, a: 1 },  // Teal
      { r: 255, g: 99, b: 132, a: 1 },  // Pink
    ];
    
    // Use user ID to determine color consistently
    const colorIndex = targetUserId % colors.length;
    return rgbaToString(colors[colorIndex]);
  }, [preferences, userId, rgbaToString, defaultPreferences]);

  /**
   * Get transaction row color based on user ownership
   * @param {Object} transaction - Transaction object
   * @param {Array} users - Array of user objects
   * @param {Object} splitAllocations - Split allocations object
   * @returns {string} CSS rgba string for background color
   */
  const getTransactionRowColor = useCallback((transaction, users, splitAllocations) => {
    if (!transaction || !users || !splitAllocations) {
      return 'rgba(255, 255, 255, 1)'; // white background
    }

    const allocations = splitAllocations[transaction.id];
    
    // If we have split allocations data
    if (allocations && Array.isArray(allocations) && allocations.length > 0) {
      // Single user allocation
      if (allocations.length === 1) {
        const userColor = getUserColor(allocations[0].user_id, 'primary');
        // Return a lighter version for background
        const color = preferences?.primary || defaultPreferences.primary;
        return `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`;
      }
      
      // Multiple users - check if current user is involved
      const currentUserAllocation = allocations.find(alloc => alloc.user_id === userId);
      if (currentUserAllocation) {
        const color = preferences?.primary || defaultPreferences.primary;
        return `rgba(${color.r}, ${color.g}, ${color.b}, 0.05)`;
      }
      
      // Other users' transaction
      return 'rgba(200, 200, 200, 0.05)';
    }
    
    // Fallback to legacy label system
    if (transaction.label) {
      const user = users.find(u => u.display_name === transaction.label);
      if (user && user.id === userId) {
        const color = preferences?.primary || defaultPreferences.primary;
        return `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`;
      }
      
      // "Both" transactions
      if (transaction.label === 'Both') {
        const color = preferences?.secondary || defaultPreferences.secondary;
        return `rgba(${color.r}, ${color.g}, ${color.b}, 0.05)`;
      }
    }
    
    return 'rgba(255, 255, 255, 1)'; // white background
  }, [userId, preferences, defaultPreferences, getUserColor]);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    if (!userId) {
      setPreferences(defaultPreferences);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(getApiUrl(`/user-preferences/${userId}`));
      
      if (response.data.success) {
        const data = response.data.data;
        // Ensure primary color has correct opacity from constants
        if (data.primary) {
          data.primary = { ...data.primary, a: USER_COLOR_OPACITIES.BACKGROUND };
        }
        if (data.secondary) {
          data.secondary = { ...data.secondary, a: USER_COLOR_OPACITIES.BACKGROUND };
        }
        setPreferences(data);
      } else {
        setError(response.data.error || 'Failed to fetch preferences');
        setPreferences(defaultPreferences);
      }
    } catch (err) {
      console.error('Error fetching user preferences:', err);
      setError(err.response?.data?.error || 'Failed to fetch preferences');
      setPreferences(defaultPreferences);
    } finally {
      setLoading(false);
    }
  }, [userId, defaultPreferences]);

  // Update user preferences
  const updatePreferences = useCallback(async (newPreferences) => {
    if (!userId) {
      console.error('Cannot update preferences without user ID');
      return false;
    }

    try {
      setError(null);
      
      const response = await axios.put(
        getApiUrl(`/user-preferences/${userId}`),
        newPreferences
      );
      
      if (response.data.success) {
        setPreferences(response.data.data);
        return true;
      } else {
        setError(response.data.error || 'Failed to update preferences');
        return false;
      }
    } catch (err) {
      console.error('Error updating user preferences:', err);
      setError(err.response?.data?.error || 'Failed to update preferences');
      return false;
    }
  }, [userId]);

  // Load preferences on mount and when userId changes
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences: preferences || defaultPreferences,
    loading,
    error,
    updatePreferences,
    refreshPreferences: fetchPreferences,
    // Utility functions
    rgbaToString,
    rgbaToHex,
    hexToRgba,
    getUserColor,
    getTransactionRowColor,
    // Default preferences for reference
    defaultPreferences
  };
};

export default useUserPreferences;