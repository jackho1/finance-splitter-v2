import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { ChevronDown, TrendingUp, Clock } from 'lucide-react-native';

export type SortOption = 'amount-desc' | 'date-desc';

interface SortDropdownProps {
  selectedSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  isDark: boolean;
}

const sortOptions = [
  {
    value: 'date-desc' as SortOption,
    label: 'Most Recent',
    icon: Clock,
  },
  {
    value: 'amount-desc' as SortOption,
    label: 'Highest Amount',
    icon: TrendingUp,
  },
];

export const SortDropdown: React.FC<SortDropdownProps> = ({
  selectedSort,
  onSortChange,
  isDark,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = sortOptions.find(option => option.value === selectedSort) || sortOptions[0];
  
  // Dynamic width based on selected option
  const getTriggerWidth = () => {
    if (selectedSort === 'date-desc') {
      return 160; // Medium width for "Most Recent"
    }
    return 180; // Longer width for "Highest Amount"
  };

  const theme = {
    background: isDark ? '#1c1c1e' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    text: isDark ? '#ffffff' : '#000000',
    secondaryText: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    accent: isDark ? '#007AFF' : '#007AFF',
    selectedBg: isDark ? 'rgba(0,122,255,0.2)' : 'rgba(0,122,255,0.1)',
    hoverBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  };

  const handleOptionSelect = (option: typeof sortOptions[0]) => {
    onSortChange(option.value);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.trigger,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
            width: getTriggerWidth(),
          }
        ]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <View style={styles.triggerContent}>
          {selectedOption.icon && (
            <selectedOption.icon
              size={14}
              color={selectedSort === 'amount-desc' ? theme.accent : theme.secondaryText}
              style={styles.triggerIcon}
            />
          )}
          <Text
            style={[
              styles.triggerText,
              { color: selectedSort === 'amount-desc' ? theme.accent : theme.text }
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selectedOption.label}
          </Text>
        </View>
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
              width: getTriggerWidth(),
            }
          ]}>
            {sortOptions.map((option) => {
            const isSelected = option.value === selectedSort;
            const IconComponent = option.icon;
            
            return (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: isSelected 
                      ? theme.selectedBg 
                      : pressed 
                      ? theme.hoverBg 
                      : 'transparent',
                  }
                ]}
                onPress={() => handleOptionSelect(option)}
              >
                <IconComponent
                  size={14}
                  color={isSelected ? theme.accent : theme.secondaryText}
                  style={styles.optionIcon}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: isSelected ? theme.accent : theme.text,
                      fontWeight: isSelected ? '600' : '500',
                    }
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 999,
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
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  triggerIcon: {
    marginRight: 6,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    minHeight: 36,
  },
  optionIcon: {
    marginRight: 6,
  },
  optionLabel: {
    fontSize: 14,
    flex: 1,
  },
});
