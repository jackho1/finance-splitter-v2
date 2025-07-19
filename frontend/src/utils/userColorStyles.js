/**
 * Utility functions for generating dynamic CSS based on user color preferences
 */

import { USER_COLOR_OPACITIES, DEFAULT_COLORS, THEME_OPTIONS } from './colorConstants';

/**
 * Convert RGBA object to CSS rgba string
 * @param {Object} color - Color object with r, g, b, a properties
 * @returns {string} CSS rgba string
 */
export const rgbaToString = (color) => {
  if (!color || typeof color !== 'object') {
    return 'rgb(70, 70, 70)'; // fallback
  }
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
};

/**
 * Create a lighter version of a color for backgrounds
 * @param {Object} color - Color object with r, g, b, a properties  
 * @param {number} opacity - Opacity for background (default from constants)
 * @returns {string} CSS rgba string with reduced opacity
 */
export const createBackgroundColor = (color, opacity = USER_COLOR_OPACITIES.BACKGROUND) => {
  if (!color || typeof color !== 'object') {
    return `rgba(54, 162, 235, ${opacity})`;
  }
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
};

// Cache for user preferences to avoid redundant API calls
let userPreferencesCache = {};

/**
 * Set user preferences cache (called once during initial data load)
 * @param {Array} users - Array of user objects with preferences included
 */
export const setUserPreferencesCache = (users) => {
  userPreferencesCache = {};
  
  if (!users || !Array.isArray(users)) {
    return;
  }
  
  users.forEach(user => {
    if (user.username === 'default') return;
    
    // Use preferences from the user object if available
    if (user.primary) {
      // Ensure primary color has correct opacity from constants
      const primary = {
        ...user.primary,
        a: USER_COLOR_OPACITIES.BACKGROUND
      };
      userPreferencesCache[user.id] = {
        user_id: user.id,
        primary: primary,
        secondary: primary, // Keep for backward compatibility
        theme: user.theme || THEME_OPTIONS.LIGHT
      };
    } else {
      // Use default preferences if none found
      userPreferencesCache[user.id] = getDefaultPreferences(user.id);
    }
  });
};

/**
 * Get user preferences from cache (no API calls)
 * @param {number} userId - User ID to get preferences for
 * @returns {Object} User preferences object
 */
const getUserPreferencesFromCache = (userId) => {
  if (userPreferencesCache[userId]) {
    return userPreferencesCache[userId];
  }
  
  // Return default preferences if not in cache
  console.warn(`User preferences not found in cache for user ${userId}, using defaults`);
  return getDefaultPreferences(userId);
};

/**
 * Get default color preferences for a user
 * @param {number} userId - User ID
 * @returns {Object} Default preferences object
 */
const getDefaultPreferences = (userId) => {
  // Use deterministic colors based on user ID
  const defaultColors = [
    { r: 255, g: 99, b: 132, a: USER_COLOR_OPACITIES.BACKGROUND }, // Pink
    { r: 54, g: 162, b: 235, a: USER_COLOR_OPACITIES.BACKGROUND }, // Blue
    { r: 153, g: 102, b: 255, a: USER_COLOR_OPACITIES.BACKGROUND }, // Purple
    { r: 255, g: 159, b: 64, a: USER_COLOR_OPACITIES.BACKGROUND }, // Orange
    { r: 75, g: 192, b: 192, a: USER_COLOR_OPACITIES.BACKGROUND }, // Teal
  ];
  
  const colorIndex = (userId - 1) % defaultColors.length;
  return {
    user_id: userId,
    primary: defaultColors[colorIndex],
    secondary: defaultColors[colorIndex], // Keep for backward compatibility
    theme: THEME_OPTIONS.LIGHT
  };
};

/**
 * Generate CSS rules for user row styling (now uses cache instead of API calls)
 * @param {Array} users - Array of user objects  
 * @returns {string} CSS string with dynamic user row styles
 */
export const generateUserRowCSS = (users) => {
  if (!users || !Array.isArray(users)) {
    return '';
  }

  let cssRules = `
    /* Fallback for unlabeled rows */
    .modern-table tbody tr:not([class*="row-"]) {
      background-color: white !important;
      border-left: 4px solid #d1d1d1 !important;
    }
  `;

  // Use cached preferences (no API calls)
  users.forEach(user => {
    if (user.username === 'default') return;
    
    const preferences = getUserPreferencesFromCache(user.id);
    if (!preferences) return;
    
    const className = `row-${user.display_name.toLowerCase().replace(/\s+/g, '-')}`;

    const primaryColor = rgbaToString(preferences.primary);

    // Extract RGBA values for creating background color  
    const primaryMatch = primaryColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);

    if (primaryMatch) {
      const [, primaryR, primaryG, primaryB] = primaryMatch;

      cssRules += `
        /* User preference styles for ${user.display_name} */
        .modern-table tbody tr.${className},
        .modern-table .${className} {
          background-color: rgba(${primaryR}, ${primaryG}, ${primaryB}, ${USER_COLOR_OPACITIES.BACKGROUND}) !important;
          border-left: 4px solid rgba(${primaryR}, ${primaryG}, ${primaryB}, ${USER_COLOR_OPACITIES.BORDER}) !important;
          transition: background-color 0.2s ease !important;
        }
        
        .modern-table tbody tr.${className}:hover,
        .modern-table .${className}:hover {
          background-color: rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.3) !important;
        }
      `;
    }
  });

  return cssRules;
};

/**
 * Generate and update totals colors dynamically (now uses cache instead of API calls)
 * @param {Array} users - Array of user objects
 * @returns {void}
 */
export const updateUserTotalColors = (users) => {
  if (!users || !Array.isArray(users)) {
    return;
  }

  try {
    // Create a global object to store user total colors
    if (!window.userTotalColors) {
      window.userTotalColors = {};
    }

    // Use cached preferences (no API calls)
    users.forEach(user => {
      if (user.username === 'default') return;
      
      const preferences = getUserPreferencesFromCache(user.id);
      
      if (!preferences) return;
      
      const primaryColor = rgbaToString(preferences.primary);

      // Extract RGB values - use primary for both with different opacity
      const primaryMatch = primaryColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      
      if (primaryMatch) {
        const [, primaryR, primaryG, primaryB] = primaryMatch;
        
        window.userTotalColors[user.display_name] = {
          bg: `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${USER_COLOR_OPACITIES.BACKGROUND})`,
          border: `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${USER_COLOR_OPACITIES.BORDER})`
        };
      }
    });

    // Trigger a re-render of any components that use total colors
    const event = new CustomEvent('userTotalColorsUpdated', { 
      detail: { userTotalColors: window.userTotalColors } 
    });
    window.dispatchEvent(event);
    
  } catch (error) {
    console.error('Error updating user total colors:', error);
  }
};

/**
 * Inject CSS into the document head
 * @param {string} cssString - CSS string to inject
 * @param {string} id - ID for the style element (for replacement)
 */
export const injectCSS = (cssString, id = 'user-color-preferences') => {
  // Remove existing style element if it exists
  const existingStyle = document.getElementById(id);
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create and inject new style element
  if (cssString.trim()) {
    const styleElement = document.createElement('style');
    styleElement.id = id;
    styleElement.textContent = cssString;
    document.head.appendChild(styleElement);
  }
};

/**
 * Generate and inject CSS for all users (now synchronous - no API calls)
 * @param {Array} users - Array of user objects
 */
export const updateUserColorStyles = (users) => {
  try {
    const cssString = generateUserRowCSS(users);
    
    if (cssString.trim()) {
      // Apply styles immediately
      injectCSS(cssString);
      
      // Remove placeholder styles since we now have real user preferences
      removePlaceholderStyles();
      
      // Notify components that color styles have been updated
      const event = new CustomEvent('userColorStylesUpdated');
      window.dispatchEvent(event);
    }
  } catch (error) {
    console.error('Error generating user color styles:', error);
  }
};

/**
 * Initialize placeholder styles to prevent flash of unstyled content
 * This provides basic styling until user preferences are loaded
 */
export const initializePlaceholderStyles = () => {
  const placeholderCSS = `
    /* Basic placeholder until user preferences load */
    .modern-table tbody tr[class*="row-"]:not(.row-group) {
      border-left: 4px solid rgba(200, 200, 200, 0.6);
    }
  `;
  injectCSS(placeholderCSS, 'user-color-placeholder');
};

/**
 * Remove placeholder styles (called after real user preferences are loaded)
 */
export const removePlaceholderStyles = () => {
  const existingPlaceholder = document.getElementById('user-color-placeholder');
  if (existingPlaceholder) {
    existingPlaceholder.remove();
  }
}; 