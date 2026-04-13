/**
 * API utility functions
 * 
 * Use these functions to construct API endpoints without hardcoding the base URL.
 */

import API_CONFIG from '../config/apiConfig';

/**
 * Constructs a full API URL by appending the path to the base URL
 * @param {string} path - API endpoint path (should start with '/')
 * @returns {string} Full API URL
 */
export const getApiUrl = (path) => {
  // Ensure path starts with '/'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.BASE_URL}${normalizedPath}`;
};

/**
 * Constructs a parameterized API URL
 * @param {string} path - Base path pattern with :param placeholders
 * @param {object} params - Object containing parameter values
 * @returns {string} Full API URL with substituted parameters
 */
export const getApiUrlWithParams = (path, params = {}) => {
  let finalPath = path;
  
  // Replace :param with actual values
  Object.entries(params).forEach(([key, value]) => {
    finalPath = finalPath.replace(`:${key}`, value);
  });
  
  return getApiUrl(finalPath);
};
