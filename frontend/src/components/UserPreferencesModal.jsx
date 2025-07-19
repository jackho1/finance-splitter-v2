import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useUserPreferencesContext } from '../contexts/UserPreferencesContext';
import { getApiUrl } from '../utils/apiUtils';
import { updateUserColorStyles, updateUserTotalColors } from '../utils/userColorStyles';

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
        setLocalPreferences({
          user_id: userId,
          primary: userPrefs.primary,
          secondary: userPrefs.secondary,
          tertiary: userPrefs.tertiary
        });
        // Keep theme separate - it's global
        setGlobalTheme(userPrefs.theme || 'light');
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      // Set defaults for this user
      setLocalPreferences({
        user_id: userId,
        primary: { r: 54, g: 162, b: 235, a: 1 },
        secondary: { r: 255, g: 99, b: 132, a: 1 },
        tertiary: { r: 75, g: 192, b: 192, a: 1 }
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
      setLocalPreferences({
        user_id: preferences.user_id,
        primary: preferences.primary,
        secondary: preferences.secondary,
        tertiary: preferences.tertiary
      });
      setGlobalTheme(preferences.theme || 'light');
    }
  }, [preferences, selectedUserId, currentUserId]);

  // Handle color change
  const handleColorChange = (colorType, hexValue) => {
    if (!hexValue || hexValue.length < 7) return;
    
    const newRgba = hexToRgba(hexValue, localPreferences[colorType]?.a || 1);
    setLocalPreferences(prev => ({
      ...prev,
      [colorType]: newRgba
    }));
  };

  // Handle alpha change
  const handleAlphaChange = (colorType, alphaValue) => {
    const alpha = parseFloat(alphaValue) || 0;
    setLocalPreferences(prev => ({
      ...prev,
      [colorType]: {
        ...prev[colorType],
        a: Math.max(0, Math.min(1, alpha))
      }
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
        secondary: localPreferences.secondary,
        tertiary: localPreferences.tertiary,
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
          console.log('🎨 Color preferences saved - updating webpage colors and totals');
          // Add a small delay to ensure the API changes are fully saved
          setTimeout(async () => {
            try {
              // Update both transaction row colors and totals colors
              await Promise.all([
                updateUserColorStyles(users),
                updateUserTotalColors(users)
              ]);
              console.log('🎨 Transaction rows and totals colors updated successfully');
            } catch (error) {
              console.error('Error updating colors after save:', error);
            }
          }, 100);
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
      primary: { r: 54, g: 162, b: 235, a: 1 },
      secondary: { r: 255, g: 99, b: 132, a: 1 },
      tertiary: { r: 75, g: 192, b: 192, a: 1 }
    });
    setGlobalTheme('light');
  };

  // Cancel changes
  const handleCancel = () => {
    // Reset to original preferences
    if (selectedUserId && isOpen) {
      loadPreferencesForUser(selectedUserId);
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
        backgroundColor: 'white',
        padding: '16px', // Reduced from 24px to match other modals
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)', // Updated to match other modals
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
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '8px' // Reduced from 16px to match other modals
        }}>
          <h2 style={{
            margin: 0,
            color: '#1f2937',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Color Preferences{selectedUserId ? ` - ${getSelectedUserName()}` : ''}
          </h2>
          <button
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              color: '#6b7280',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseOut={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6b7280';
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
            color: '#6b7280',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            Customize color preferences for different users. Select a user below to edit their color preferences.
          </p>

          {/* User Selection */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
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
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                fontSize: '14px',
                color: '#374151',
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
              color: '#6b7280',
              fontSize: '14px'
            }}>
              Loading user preferences...
            </div>
          )}

          {/* Color Inputs */}
          {selectedUserId && !loadingUserPrefs && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}> {/* Reduced from 16px */}
            {['primary', 'secondary', 'tertiary'].map((colorType) => (
              <div key={colorType} style={{
                padding: '10px', // Reduced from 12px for tighter spacing
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '2px', // Reduced from 10px for tighter spacing
                  textTransform: 'capitalize'
                }}>
                  {colorType} Color
                </label>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px', // Reduced from 12px
                  flexWrap: 'wrap'
                }}>
                  {/* Color Preview */}
                  <div style={{
                    width: '50px',
                    height: '50px',
                    backgroundColor: `rgba(${localPreferences[colorType]?.r || 0}, ${localPreferences[colorType]?.g || 0}, ${localPreferences[colorType]?.b || 0}, ${localPreferences[colorType]?.a || 1})`,
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    flexShrink: 0
                  }} />
                  
                  {/* Color Picker */}
                  <input
                    type="color"
                    value={rgbaToHex(localPreferences[colorType])}
                    onChange={(e) => handleColorChange(colorType, e.target.value)}
                    style={{
                      width: '60px',
                      height: '40px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  />
                  
                  {/* Alpha Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '140px' }}>
                    <label style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      Opacity
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={localPreferences[colorType]?.a || 1}
                      onChange={(e) => handleAlphaChange(colorType, e.target.value)}
                      style={{
                        width: '100%' // Changed from 100px to 100% to use available space
                      }}
                    />
                    <span style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      textAlign: 'center'
                    }}>
                      {Math.round((localPreferences[colorType]?.a || 1) * 100)}%
                    </span>
                  </div>
                  
                  {/* RGB Values */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    <div>R: {localPreferences[colorType]?.r || 0}</div>
                    <div>G: {localPreferences[colorType]?.g || 0}</div>
                    <div>B: {localPreferences[colorType]?.b || 0}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Theme Selection */}
          <div style={{
            marginTop: '12px',
            padding: '10px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
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
                    border: '1px solid #d1d5db',
                    backgroundColor: globalTheme === themeOption.value ? '#e0e7ff' : 'white',
                    transition: 'all 0.2s',
                    minWidth: '120px',
                    justifyContent: 'flex-start'
                  }}
                  onMouseOver={e => {
                    if (globalTheme !== themeOption.value) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseOut={e => {
                    if (globalTheme !== themeOption.value) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={themeOption.value}
                    checked={globalTheme === themeOption.value}
                    onChange={(e) => {
                      setGlobalTheme(e.target.value);
                    }}
                    style={{
                      margin: 0,
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', color: '#6b7280' }}>
                    {themeOption.icon}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    color: '#374151',
                    fontWeight: globalTheme === themeOption.value ? '600' : '400'
                  }}>
                    {themeOption.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview Section */}
          <div style={{
            marginTop: '12px', // Reduced from 16px for tighter spacing
            padding: '10px', // Reduced from 12px for tighter spacing
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{
              margin: '0 0 8px 0', // Reduced from 10px for tighter spacing
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Preview
            </h3>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              {['primary', 'secondary', 'tertiary'].map((colorType) => (
                <div
                  key={colorType}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: `rgba(${localPreferences[colorType]?.r || 0}, ${localPreferences[colorType]?.g || 0}, ${localPreferences[colorType]?.b || 0}, ${localPreferences[colorType]?.a || 1})`,
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    textTransform: 'capitalize',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  {colorType}
                </div>
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
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
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
                color: '#374151',
                border: '1px solid #d1d5db',
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
