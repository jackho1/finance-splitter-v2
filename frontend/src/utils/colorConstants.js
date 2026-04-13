/**
 * Color-related constants for the application
 * Centralized configuration for easy maintenance and updates
 */

// Opacity values for user colors
export const USER_COLOR_OPACITIES = {
  // Background opacity for transaction rows and user totals
  BACKGROUND: 0.2,
  // Border opacity for user totals
  BORDER: 0.8
};

// Default color values
export const DEFAULT_COLORS = {
  PRIMARY: { r: 100, g: 149, b: 237, a: USER_COLOR_OPACITIES.BACKGROUND }, // Cornflower blue
  SECONDARY: { r: 100, g: 149, b: 237, a: USER_COLOR_OPACITIES.BACKGROUND }
};

// Theme options
export const THEME_OPTIONS = {
  LIGHT: 'light',
  DARK: 'dark'
}; 