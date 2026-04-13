import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ChevronDown, Check, X } from 'lucide-react-native';

interface UserFilterDropdownProps {
  users: Array<{
    id: number;
    username: string;
    display_name: string;
    is_active: boolean;
  }>;
  splitAllocations: Record<string, any[]>;
  transactions: any[];
  selectedUsers: string[];
  onSelectionChange: (selectedUsers: string[]) => void;
  isDark: boolean;
}

export const UserFilterDropdown: React.FC<UserFilterDropdownProps> = ({
  users,
  splitAllocations,
  transactions,
  selectedUsers,
  onSelectionChange,
  isDark,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const availableLabels = useMemo(() => {
    if (!users || !Array.isArray(users) || users.length === 0) {
      return [];
    }

    const activeUsers = users.filter(user => user.username !== 'default' && user.is_active);
    const labelOptions = new Set<string>();

    // Add individual user display names
    activeUsers.forEach(user => {
      labelOptions.add(user.display_name);
    });

    const allOptions = Array.from(labelOptions);
    const individualUsers = allOptions.filter(option => option !== 'Both' && option !== 'All users').sort();
    const collectiveOptions = [];

    // Always show "Both" if there are at least 2 active users
    if (activeUsers.length >= 2) {
      collectiveOptions.push('Both');
    }

    // Always show "All users" if there are at least 3 active users
    if (activeUsers.length >= 3) {
      collectiveOptions.push('All users');
    }

    return [...individualUsers, ...collectiveOptions];
  }, [users]);

  const handleToggleOption = useCallback((label: string) => {
    const newSelection = selectedUsers.includes(label)
      ? selectedUsers.filter(u => u !== label)
      : [...selectedUsers, label];
    
    onSelectionChange(newSelection);
  }, [selectedUsers, onSelectionChange]);

  const handleClearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  const getDisplayText = () => {
    if (selectedUsers.length === 0) {
      return 'All Users';
    } else if (selectedUsers.length === 1) {
      return selectedUsers[0];
    } else if (selectedUsers.length === availableLabels.length) {
      return 'All Users';
    } else {
      return `${selectedUsers.length} Users`;
    }
  };

  const theme = {
    background: isDark ? '#1c1c1e' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    text: isDark ? '#ffffff' : '#000000',
    secondaryText: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    accent: isDark ? '#007AFF' : '#007AFF',
    selectedBg: isDark ? 'rgba(0,122,255,0.2)' : 'rgba(0,122,255,0.1)',
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.trigger,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
          }
        ]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selectedUsers.length > 0 ? theme.accent : theme.text }
          ]}
          numberOfLines={1}
        >
          {getDisplayText()}
        </Text>
        <ChevronDown
          size={16}
          color={theme.secondaryText}
          style={[
            styles.chevron,
            isOpen && styles.chevronRotated
          ]}
        />
      </Pressable>

      {isOpen && (
        <View style={[
            styles.dropdown,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              shadowColor: isDark ? '#000' : '#000',
            }
          ]}>
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
            {selectedUsers.length > 0 && (
              <Pressable
                style={[styles.option, styles.clearOption]}
                onPress={handleClearAll}
              >
                <X size={14} color={theme.accent} />
                <Text style={[styles.clearText, { color: theme.accent }]}>
                  Clear All
                </Text>
              </Pressable>
            )}
            
            {availableLabels.map((label) => {
              const isSelected = selectedUsers.includes(label);
              return (
                <Pressable
                  key={label}
                  style={[
                    styles.option,
                    isSelected && {
                      backgroundColor: theme.selectedBg,
                    }
                  ]}
                  onPress={() => handleToggleOption(label)}
                >
                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: isSelected ? theme.accent : theme.text,
                          fontWeight: isSelected ? '600' : '400',
                        }
                      ]}
                    >
                      {label}
                    </Text>
                    {isSelected && (
                      <Check size={14} color={theme.accent} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
    minWidth: 120,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  chevron: {
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 200,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
  },
  scrollView: {
    maxHeight: 200,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    minHeight: 40,
  },
  clearOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
});
