import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useUserPreferencesContext } from '../contexts/UserPreferencesContext';
import { getApiUrl } from '../utils/apiUtils';
import { updateUserColorStyles, updateUserTotalColors, setUserPreferencesCache } from '../utils/userColorStyles';
import { USER_COLOR_OPACITIES, THEME_OPTIONS } from '../utils/colorConstants';

/**
 * User Preferences Modal Component
 * Allows users to customize their color preferences
 */
const UserPreferencesModal = ({ isOpen, onClose }) => {
  const {
    preferences,
    updatePreferences,
    rgbaToHex,
    hexToRgba,
    currentUserId,
    users,
    loading: preferencesLoading
  } = useUserPreferencesContext();

  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [globalTheme, setGlobalTheme] = useState('light');
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [loadingUserPrefs, setLoadingUserPrefs] = useState(false);
  
  // Default opacity for the primary color
  const DEFAULT_OPACITY = USER_COLOR_OPACITIES.BACKGROUND;

  // Update selected user when currentUserId changes
  useEffect(() => {
    if (currentUserId && !selectedUserId) {
      setSelectedUserId(currentUserId);
    }
  }, [currentUserId, selectedUserId]);

  // Load preferences for selected user
  const loadPreferencesForUser = useCallback(async (userId) => {
    if (!userId) return;
    
    setLoadingUserPrefs(true);
    try {
      const response = await axios.get(getApiUrl(`/user-preferences/${userId}`));
      if (response.data.success) {
        const userPrefs = response.data.data;
        // Ensure primary color has default opacity of 0.2
        const primaryColor = userPrefs.primary ? {
          ...userPrefs.primary,
          a: DEFAULT_OPACITY
        } : { r: 54, g: 162, b: 235, a: DEFAULT_OPACITY };
        
        setLocalPreferences({
          user_id: userId,
          primary: primaryColor
        });
        // Keep theme separate - it's global
        setGlobalTheme(userPrefs.theme || THEME_OPTIONS.LIGHT);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      // Set defaults for this user
      setLocalPreferences({
        user_id: userId,
        primary: { r: 54, g: 162, b: 235, a: DEFAULT_OPACITY }
      });
    } finally {
      setLoadingUserPrefs(false);
    }
  }, []);

  // Load preferences when selected user changes
  useEffect(() => {
    if (selectedUserId && isOpen) {
      loadPreferencesForUser(selectedUserId);
    }
  }, [selectedUserId, isOpen, loadPreferencesForUser]);

  // Update local preferences when context preferences change (for current user)
  useEffect(() => {
    if (preferences && selectedUserId === currentUserId) {
      const primaryColor = preferences.primary ? {
        ...preferences.primary,
        a: DEFAULT_OPACITY
      } : { r: 54, g: 162, b: 235, a: DEFAULT_OPACITY };
      
      setLocalPreferences({
        user_id: preferences.user_id,
        primary: primaryColor
      });
      setGlobalTheme(preferences.theme || THEME_OPTIONS.LIGHT);
    }
  }, [preferences, selectedUserId, currentUserId]);

  // Handle color change
  const handleColorChange = (hexValue) => {
    if (!hexValue || hexValue.length < 7) return;
    
    const newRgba = hexToRgba(hexValue, DEFAULT_OPACITY);
    setLocalPreferences(prev => ({
      ...prev,
      primary: newRgba
    }));
  };



  // Save preferences
  const handleSave = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    try {
      // Save color preferences for selected user
      const colorPreferences = {
        primary: localPreferences.primary,
        // Keep backward compatibility by saving the primary color as secondary too
        secondary: localPreferences.primary,
        theme: globalTheme // Include theme in the save
      };

      const response = await axios.put(
        getApiUrl(`/user-preferences/${selectedUserId}`),
        colorPreferences
      );

      if (response.data.success) {
        // If we're editing the current user, update the context
        if (selectedUserId === currentUserId) {
          updatePreferences(response.data.data);
        }
        
        // Update the webpage colors immediately to reflect the new preferences
        if (users && users.length > 0) {
          try {
            // First, update the users array with the new preferences
            const updatedUsers = users.map(user => {
              if (user.id === selectedUserId) {
                return {
                  ...user,
                  primary: colorPreferences.primary,
                  theme: colorPreferences.theme
                };
              }
              return user;
            });
            
            // Update the preferences cache with the new data
            setUserPreferencesCache(updatedUsers);
            
            // Update both transaction row colors and totals colors
            updateUserColorStyles(updatedUsers);
            updateUserTotalColors(updatedUsers);
          } catch (error) {
            console.error('Error updating colors after save:', error);
          }
        }
        
        onClose();
      } else {
        console.error('Failed to save preferences:', response.data.error);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setLocalPreferences({
      user_id: selectedUserId,
      primary: { r: 54, g: 162, b: 235, a: DEFAULT_OPACITY }
    });
    setGlobalTheme(THEME_OPTIONS.LIGHT);
  };

  // Cancel changes
  const handleCancel = () => {
    // Reset to original preferences
    if (selectedUserId && isOpen) {
      loadPreferencesForUser(selectedUserId);
    }
    // If we're editing the current user, revert theme changes
    if (selectedUserId === currentUserId && preferences.theme) {
      document.documentElement.classList.remove('theme-light', 'theme-dark');
      document.documentElement.classList.add(`theme-${preferences.theme}`);
    }
    onClose();
  };

  // Get current user display name
  const getCurrentUserName = () => {
    if (!users.length || !currentUserId) return 'User';
    const user = users.find(u => u.id === currentUserId);
    return user?.display_name || 'User';
  };

  // Get selected user display name
  const getSelectedUserName = () => {
    if (!users.length || !selectedUserId) return '';
    const user = users.find(u => u.id === selectedUserId);
    return user?.display_name || user?.username || '';
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--color-modalBackground)',
        padding: '16px', // Reduced from 24px to match other modals
        borderRadius: '12px',
        boxShadow: '0 10px 40px var(--color-shadowDark)', // Updated to match other modals
        width: '500px',
        maxWidth: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px', // Reduced from 24px to match other modals
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px' // Reduced from 16px to match other modals
        }}>
          <h2 style={{
            margin: 0,
            color: 'var(--color-text)',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            User Settings{selectedUserId ? ` - ${getSelectedUserName()}` : ''}
          </h2>
          <button
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              color: 'var(--color-textSecondary)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => {
              e.currentTarget.style.backgroundColor = 'var(--color-backgroundHover)';
              e.currentTarget.style.color = 'var(--color-text)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-textSecondary)';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ marginBottom: '12px' }}> {/* Reduced from 16px for tighter spacing */}
          <p style={{
            margin: '0 0 12px 0', // Reduced from 16px for tighter spacing
            color: 'var(--color-textSecondary)',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            Customize settings for different users. Select a user below to edit their preferences.
          </p>

          {/* User Selection */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'var(--color-backgroundTertiary)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--color-text)',
              marginBottom: '8px',
              marginTop: '4px'
            }}>
              Select User
            </label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(parseInt(e.target.value))}
              disabled={loadingUserPrefs}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-backgroundSecondary)',
                fontSize: '14px',
                color: 'var(--color-text)',
                cursor: loadingUserPrefs ? 'not-allowed' : 'pointer',
                opacity: loadingUserPrefs ? 0.6 : 1
              }}
            >
              <option value="">Select a user...</option>
              {users.filter(user => user.is_active).map(user => (
                <option key={user.id} value={user.id}>
                  {user.display_name || user.username}
                  {user.id === currentUserId ? ' (You)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Loading indicator for user preferences */}
          {loadingUserPrefs && (
            <div style={{
              textAlign: 'center',
              padding: '16px',
              color: 'var(--color-textSecondary)',
              fontSize: '14px'
            }}>
              Loading user preferences...
            </div>
          )}

          {/* Color Input - Primary Only */}
          {selectedUserId && !loadingUserPrefs && (
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--color-backgroundTertiary)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            marginBottom: '12px'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--color-text)',
              marginBottom: '10px'
            }}>
              User Color
            </label>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {/* Color Preview with opacity applied */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: `rgba(${localPreferences.primary?.r || 0}, ${localPreferences.primary?.g || 0}, ${localPreferences.primary?.b || 0}, ${DEFAULT_OPACITY})`,
                  border: '2px solid var(--color-border)',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Show a border preview */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '6px',
                    backgroundColor: `rgba(${localPreferences.primary?.r || 0}, ${localPreferences.primary?.g || 0}, ${localPreferences.primary?.b || 0}, ${USER_COLOR_OPACITIES.BORDER})`
                  }} />
                </div>
                <span style={{
                  fontSize: '11px',
                  color: 'var(--color-textSecondary)',
                  textAlign: 'center'
                }}>
                  Preview
                </span>
              </div>
              
              {/* Color Picker */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <input
                  type="color"
                  value={rgbaToHex(localPreferences.primary)}
                  onChange={(e) => handleColorChange(e.target.value)}
                  style={{
                    width: '60px',
                    height: '60px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-backgroundSecondary)',
                    padding: '4px'
                  }}
                />
                <span style={{
                  fontSize: '11px',
                  color: 'var(--color-textSecondary)'
                }}>
                  Select Color
                </span>
              </div>
              
              {/* Color Information */}
              <div style={{
                flex: 1,
                minWidth: '200px',
                backgroundColor: 'var(--color-backgroundSecondary)',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--color-text)',
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  Color Details
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--color-textSecondary)'
                }}>
                  <div>
                    <span style={{ fontWeight: '500' }}>R:</span> {localPreferences.primary?.r || 0}
                  </div>
                  <div>
                    <span style={{ fontWeight: '500' }}>G:</span> {localPreferences.primary?.g || 0}
                  </div>
                  <div>
                    <span style={{ fontWeight: '500' }}>B:</span> {localPreferences.primary?.b || 0}
                  </div>
                </div>
                <div style={{
                  marginTop: '6px',
                  fontSize: '11px',
                  color: 'var(--color-textTertiary)',
                  fontStyle: 'italic'
                }}>
                  Background opacity: 20% • Border opacity: 80%
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Theme Selection */}
          <div style={{
            marginTop: '12px',
            padding: '10px',
            backgroundColor: 'var(--color-backgroundTertiary)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--color-text)',
              marginBottom: '8px'
            }}>
              Theme
            </label>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              {[
                { 
                  value: 'light', 
                  label: 'Light Mode', 
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5"/>
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                  )
                },
                { 
                  value: 'dark', 
                  label: 'Dark Mode', 
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  )
                }
              ].map((themeOption) => (
                <label
                  key={themeOption.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: globalTheme === themeOption.value ? 'var(--color-backgroundHover)' : 'var(--color-backgroundSecondary)',
                    transition: 'all 0.2s',
                    minWidth: '120px',
                    justifyContent: 'flex-start'
                  }}
                  onMouseOver={e => {
                    if (globalTheme !== themeOption.value) {
                      e.currentTarget.style.backgroundColor = 'var(--color-backgroundHover)';
                      e.currentTarget.style.borderColor = 'var(--color-borderSecondary)';
                    }
                  }}
                  onMouseOut={e => {
                    if (globalTheme !== themeOption.value) {
                      e.currentTarget.style.backgroundColor = 'var(--color-backgroundSecondary)';
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={themeOption.value}
                    checked={globalTheme === themeOption.value}
                    onChange={(e) => {
                      const newTheme = e.target.value;
                      setGlobalTheme(newTheme);
                      // Apply theme immediately for preview
                      document.documentElement.classList.remove('theme-light', 'theme-dark');
                      document.documentElement.classList.add(`theme-${newTheme}`);
                      localStorage.setItem('theme', newTheme);
                    }}
                    style={{
                      margin: 0,
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-textSecondary)' }}>
                    {themeOption.icon}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    color: 'var(--color-text)',
                    fontWeight: globalTheme === themeOption.value ? '600' : '400'
                  }}>
                    {themeOption.label}
                  </span>
                </label>
              ))}
            </div>
          </div>


        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '12px', // Reduced from 16px
          borderTop: '1px solid var(--color-border)'
        }}>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: 'var(--color-textSecondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            Reset to Defaults
          </button>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || preferencesLoading || !selectedUserId || loadingUserPrefs}
              style={{
                padding: '8px 20px',
                backgroundColor: (saving || !selectedUserId || loadingUserPrefs) ? '#9ca3af' : '#4f46e5', // Updated to match other modals
                color: 'white',
                border: 'none',
                borderRadius: '6px', // Reduced from 8px to match other modals
                cursor: (saving || !selectedUserId || loadingUserPrefs) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => {
                if (!saving && !preferencesLoading && selectedUserId && !loadingUserPrefs) {
                  e.currentTarget.style.backgroundColor = '#4338ca';
                }
              }}
              onMouseOut={e => {
                if (!saving && !preferencesLoading && selectedUserId && !loadingUserPrefs) {
                  e.currentTarget.style.backgroundColor = '#4f46e5';
                }
              }}
            >
              {saving ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
                    style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="30 60" />
                  </svg>
                  Saving...
                </>
              ) : loadingUserPrefs ? (
                'Loading...'
              ) : !selectedUserId ? (
                'Select User First'
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPreferencesModal;
