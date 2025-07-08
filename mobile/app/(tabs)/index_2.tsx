import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { 
  StyleSheet, 
  Dimensions, 
  RefreshControl, 
  ScrollView, 
  ActivityIndicator, 
  Platform, 
  View, 
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Constants from 'expo-constants';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';

// Get the screen dimensions
const screenWidth = Dimensions.get('window').width;

// Define transaction interface
interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  bank_category: string;
  category: string;
  label: string;
  [key: string]: any; // For other possible fields
}

// Interface for chart data by category
interface CategoryChartData {
  category: string;
  data: number[];
  color: string;
}

// Interface for chart data point
interface ChartDataPoint {
  label: string;
  value: number;
  month: number;
}

// Interface for selected segment info
interface SelectedSegment {
  category: string;
  amount: number;
  month: number;
  color: string;
}

// Get API base URL based on environment
const getApiBaseUrl = () => {
  // When running in development on an emulator/simulator
  if (__DEV__) {
    // For iOS simulator
    if (Platform.OS === 'ios') {
      return 'http://192.168.50.203:8080';
    }
    // For Android emulator - 10.0.2.2 is the special IP that connects to host machine
    if (Platform.OS === 'android') {
      return 'http://192.168.241.111:5000';
    }
    // For web
    return 'http://192.168.241.111:5000';
  }
  
  // Production URL
  return 'https://your-production-api-url.com'; // Replace with your actual production API URL
};

// Function to generate a random color
const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Predefined colors for better visual consistency - updated with financial-friendly colors
const categoryColors = [
  '#4361EE', '#3A0CA3', '#7209B7', '#F72585', '#4CC9F0', 
  '#4895EF', '#560BAD', '#B5179E', '#F15BB5', '#9D4EDD',
  '#06D6A0', '#118AB2', '#073B4C', '#FFD166', '#EF476F'
];

// Enhanced stacked bar chart component
const StackedBarChart: React.FC<{
  categoryData: CategoryChartData[];
  height: number;
  textColor: string;
}> = ({ categoryData, height, textColor }) => {
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const colorScheme = useColorScheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const currentMonth = new Date().getMonth(); // 0-indexed, January is 0
  
  // Check if any filters are active
  const hasActiveFilters = selectedCategories.length > 0;
  
  // Reset all filters
  const resetFilters = () => {
    setSelectedCategories([]);
    setSelectedSegment(null);
  };
  
  // Filter data based on selected categories or show all if none selected
  const filteredData = useMemo(() => {
    if (selectedCategories.length === 0) {
      return categoryData; // Show all categories if none selected
    }
    return categoryData.filter(category => selectedCategories.includes(category.category));
  }, [categoryData, selectedCategories]);
  
  // Toggle category selection for filtering
  const toggleCategoryFilter = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        // Remove category if already selected
        return prev.filter(c => c !== category);
      } else {
        // Add category if not selected
        return [...prev, category];
      }
    });
    // Clear any active tooltip when changing filters
    setSelectedSegment(null);
  };
  
  // Calculate monthly totals and find max value for scaling
  const monthlyTotals = Array(12).fill(0);
  filteredData.forEach(category => {
    category.data.forEach((value, monthIndex) => {
      monthlyTotals[monthIndex] += Math.abs(value);

    });
  });
  
  const maxValue = Math.max(...monthlyTotals, 1); // Ensure we don't divide by zero if all filtered out
  const chartHeight = height - 90; // Reserve more space for labels and tall bar totals
  
  // Scroll to current month when chart is rendered
  useEffect(() => {
    // Wait for layout to complete
    setTimeout(() => {
      // Determine where to scroll to show the current month at the right edge
      if (scrollViewRef.current) {
        // Estimate the position - each bar takes up 1/6 of the screen
        const barWidth = screenWidth / 6;
        // Position current month in the middle of visible bars
        const scrollPosition = Math.max(0, (currentMonth - 3) * barWidth);
        
        scrollViewRef.current.scrollTo({ x: scrollPosition, animated: true });
      }
    }, 500);
  }, []);
  
  return (
    <View style={styles.stackedBarChartContainer}>
      {/* Filter indicator and reset button */}
      {hasActiveFilters && (
        <View style={styles.filterStatusContainer}>
          <Text style={[styles.filterStatusText, { color: textColor }]}>
            {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
          </Text>
          <TouchableOpacity 
            style={[
              styles.resetButton, 
              { borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }
            ]} 
            onPress={resetFilters}
            activeOpacity={0.7}
          >
            <Text style={[styles.resetButtonText, { color: textColor }]}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {selectedSegment && (
        <View style={[
          styles.tooltipContainer, 
          { 
            backgroundColor: colorScheme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: colorScheme === 'dark' ? 'rgba(70, 70, 70, 0.5)' : 'rgba(230, 230, 230, 0.5)'
          }
        ]}>
          <View style={[styles.tooltipColorIndicator, { backgroundColor: selectedSegment.color }]} />
          <Text style={[styles.tooltipText, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}>
            {selectedSegment.category}: ${selectedSegment.amount.toFixed(2)} in {monthLabels[selectedSegment.month]}
          </Text>
          <TouchableOpacity 
            style={[
              styles.closeButton, 
              { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' }
            ]} 
            onPress={() => setSelectedSegment(null)}
          >
            <Text style={{color: colorScheme === 'dark' ? '#FFFFFF' : '#000000', fontSize: 12}}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scroll view for the chart */}
      <ScrollView 
        ref={scrollViewRef}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        decelerationRate="fast"
        snapToInterval={screenWidth / 6}
        snapToAlignment="center"
        pagingEnabled={false}
      >
        <View style={styles.chartArea}>
          {monthlyTotals.map((total, monthIndex) => {
            if (total === 0) return null; // Skip months with no data
            
            // Calculate bar height with improved scaling for outliers
            // For very tall bars, we apply a logarithmic scaling factor to prevent excessive height
            const normalizedTotal = total > maxValue * 0.7 
              ? maxValue * 0.7 + (total - maxValue * 0.7) * 0.3 // Compress values above 70% of max
              : total;
            const barHeight = Math.min((normalizedTotal / maxValue) * chartHeight, chartHeight - 30);
            
            let currentOffset = 0;
            
            // Highlight current month
            const isCurrentMonth = monthIndex === currentMonth;
            
            // Calculate if this is an outlier (significantly taller than average)
            const isOutlier = total > maxValue * 0.75;
            
            return (
              <View 
                key={monthIndex} 
                style={[
                  styles.barColumn,
                  isCurrentMonth && styles.currentMonthBar
                ]}
              >
                {/* Month total at the top */}
                <Text style={[
                  styles.barTotal, 
                  { color: textColor },
                  isOutlier && styles.outlierBarTotal
                ]}>
                  ${Math.round(total)}
                </Text>
                
                {/* Stacked bar segments */}
                <View style={[styles.stackedBar, { height: barHeight }]}>
                  {filteredData.map((category, categoryIndex) => {
                    const categoryValue = Math.abs(category.data[monthIndex]);
                    if (categoryValue === 0) return null;
                    
                    // Scale segment height proportionally
                    const segmentRatio = categoryValue / total;
                    const segmentHeight = segmentRatio * barHeight;
                    
                    const segmentStyle: {
                      height: number;
                      backgroundColor: string;
                      borderTopLeftRadius?: number;
                      borderTopRightRadius?: number;
                      shadowColor?: string;
                      shadowOffset?: {width: number, height: number};
                      shadowOpacity?: number;
                      shadowRadius?: number;
                      elevation?: number;
                    } = {
                      height: segmentHeight,
                      backgroundColor: category.color,
                    };
                    
                    // Only apply rounded corners to the top segment
                    if (currentOffset === 0) {
                      segmentStyle.borderTopLeftRadius = 4;
                      segmentStyle.borderTopRightRadius = 4;
                      
                      // Add subtle shadow to the top segment only, optimized for color scheme
                      segmentStyle.shadowColor = '#000';
                      segmentStyle.shadowOffset = { width: 0, height: 1 };
                      segmentStyle.shadowOpacity = colorScheme === 'dark' ? 0.3 : 0.1;
                      segmentStyle.shadowRadius = colorScheme === 'dark' ? 2 : 1.5;
                      segmentStyle.elevation = colorScheme === 'dark' ? 4 : 3;
                    }
                    
                    // Create the segment with the current offset
                    const segment = (
                      <TouchableOpacity
                        key={`${monthIndex}-${categoryIndex}`}
                        style={[styles.barSegment, segmentStyle]}
                        hitSlop={{ top: 5, bottom: 5, left: 0, right: 0 }}
                        onPress={() => {
                          setSelectedSegment({
                            category: category.category,
                            amount: categoryValue,
                            month: monthIndex,
                            color: category.color
                          });
                        }}
                        activeOpacity={0.7}
                      />
                    );
                    
                    // Update the offset for the next segment
                    currentOffset += segmentHeight;
                    
                    return segment;
                  })}
                </View>
                
                {/* Month label */}
                <Text style={[
                  styles.monthLabel, 
                  { color: textColor },
                  isCurrentMonth && styles.currentMonthLabel
                ]}>
                  {monthLabels[monthIndex]}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      
      {/* Legend with filtering capability */}
      <View style={[
        styles.legend, 
        { 
          borderTopColor: colorScheme === 'dark' ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)' 
        }
      ]}>
        <ScrollView 
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.legendScrollContainer}
          style={styles.legendScrollView}
          decelerationRate="fast"
        >
          {categoryData.map((category, index) => {
            const isSelected = selectedCategories.includes(category.category) || selectedCategories.length === 0;
            
            return (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.legendItemHorizontal,
                  isSelected ? null : styles.legendItemInactive
                ]}
                onPress={() => toggleCategoryFilter(category.category)}
                activeOpacity={0.7}
              >
                <View 
                  style={[
                    styles.legendColor, 
                    { 
                      backgroundColor: category.color,
                      shadowColor: colorScheme === 'dark' ? '#000' : '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: colorScheme === 'dark' ? 0.2 : 0.1,
                      shadowRadius: 1,
                      elevation: 1,
                      opacity: isSelected ? 1 : 0.3
                    }
                  ]} 
                />
                <Text style={[
                  styles.legendTextHorizontal, 
                  { color: textColor },
                  isSelected ? null : { opacity: 0.5 }
                ]}>
                  {category.category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

// Transaction Edit Modal Component
const TransactionEditModal: React.FC<{
  visible: boolean;
  transaction: Transaction | null;
  labels: string[];
  onClose: () => void;
  onSave: (transactionId: string, updates: Partial<Transaction>) => Promise<void>;
  colorScheme: 'light' | 'dark' | null;
}> = ({ visible, transaction, labels, onClose, onSave, colorScheme }) => {
  const [editedTransaction, setEditedTransaction] = useState<Partial<Transaction>>({});
  const [availableBankCategories, setAvailableBankCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBankCategoryPicker, setShowBankCategoryPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      setEditedTransaction({
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        bank_category: transaction.bank_category,
        label: transaction.label,
      });
    }
  }, [transaction]);

  // Fetch available bank categories
  useEffect(() => {
    const fetchBankCategories = async () => {
      try {
        const apiUrl = `${getApiBaseUrl()}/bank-categories`;
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          setAvailableBankCategories(data);
        }
      } catch (err) {
        console.error('Error fetching bank categories:', err);
      }
    };

    if (visible) {
      fetchBankCategories();
    }
  }, [visible]);

  const handleSave = async () => {
    if (!transaction) return;
    
    try {
      setIsLoading(true);
      await onSave(transaction.id, editedTransaction);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to update transaction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: keyof Transaction, value: string) => {
    setEditedTransaction(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Format date for display
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Get amount color based on positive/negative
  const getAmountColor = (amount: string) => {
    const numAmount = parseFloat(amount || '0');
    if (numAmount < 0) {
      return '#FF3B30'; // iOS red
    }
    return '#34C759'; // iOS green
  };

  if (!transaction) return null;

  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardColor = isDark ? '#2C2C2E' : '#F2F2F7';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const secondaryTextColor = isDark ? '#8E8E93' : '#6D6D70';
  const borderColor = isDark ? '#3A3A3C' : '#C6C6C8';

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modernModalContainer, { backgroundColor }]}>
          {/* Modern Header */}
          <View style={[styles.modernModalHeader, { borderBottomColor: borderColor }]}>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.modernCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modernCloseText, { color: '#007AFF' }]}>Cancel</Text>
            </TouchableOpacity>
            
            <Text style={[styles.modernModalTitle, { color: textColor }]}>
              Edit Transaction
            </Text>
            
            <TouchableOpacity 
              onPress={handleSave}
              style={[styles.modernSaveButton, isLoading && { opacity: 0.6 }]}
              disabled={isLoading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.modernSaveText}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modernModalContent} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modernScrollContent}
          >
            {/* Transaction Summary Card */}
            <View style={[styles.summaryCard, { backgroundColor: cardColor }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryAmount, { color: getAmountColor(editedTransaction.amount || '') }]}>
                  ${Math.abs(parseFloat(editedTransaction.amount || '0')).toFixed(2)}
                </Text>
                <View style={[styles.summaryBadge, { backgroundColor: '#007AFF20' }]}>
                  <Text style={[styles.summaryBadgeText, { color: '#007AFF' }]}>
                    {editedTransaction.label || 'No Label'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.summaryDescription, { color: secondaryTextColor }]} numberOfLines={2}>
                {editedTransaction.description || 'No description'}
              </Text>
            </View>

            {/* Edit Fields */}
            <View style={styles.fieldsContainer}>
              {/* Date Field */}
              <View style={[styles.modernFieldCard, { backgroundColor: cardColor }]}>
                <Text style={[styles.modernFieldLabel, { color: textColor }]}>Date</Text>
                <TouchableOpacity 
                  style={styles.modernFieldButton}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modernFieldValue, { color: textColor }]}>
                    {formatDateForDisplay(editedTransaction.date || '')}
                  </Text>
                  <Text style={[styles.modernFieldChevron, { color: secondaryTextColor }]}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Description Field */}
              <View style={[styles.modernFieldCard, { backgroundColor: cardColor }]}>
                <Text style={[styles.modernFieldLabel, { color: textColor }]}>Description</Text>
                <TextInput
                  style={[styles.modernTextInput, { 
                    color: textColor,
                    backgroundColor: 'transparent'
                  }]}
                  value={editedTransaction.description || ''}
                  onChangeText={(text) => handleFieldChange('description', text)}
                  placeholder="Enter description..."
                  placeholderTextColor={secondaryTextColor}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Amount Field */}
              <View style={[styles.modernFieldCard, { backgroundColor: cardColor }]}>
                <Text style={[styles.modernFieldLabel, { color: textColor }]}>Amount</Text>
                <TextInput
                  style={[styles.modernTextInput, { 
                    color: getAmountColor(editedTransaction.amount || ''),
                    backgroundColor: 'transparent',
                    fontSize: 20,
                    fontWeight: '600'
                  }]}
                  value={editedTransaction.amount || ''}
                  onChangeText={(text) => handleFieldChange('amount', text)}
                  placeholder="0.00"
                  placeholderTextColor={secondaryTextColor}
                  keyboardType="numeric"
                />
              </View>

              {/* Bank Category Field */}
              <View style={[styles.modernFieldCard, { backgroundColor: cardColor }]}>
                <Text style={[styles.modernFieldLabel, { color: textColor }]}>Bank Category</Text>
                <TouchableOpacity 
                  style={styles.modernFieldButton}
                  onPress={() => setShowBankCategoryPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modernFieldValue, { color: textColor }]}>
                    {editedTransaction.bank_category || 'Select category'}
                  </Text>
                  <Text style={[styles.modernFieldChevron, { color: secondaryTextColor }]}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Label Field */}
              <View style={[styles.modernFieldCard, { backgroundColor: cardColor }]}>
                <Text style={[styles.modernFieldLabel, { color: textColor }]}>Label</Text>
                <TouchableOpacity 
                  style={styles.modernFieldButton}
                  onPress={() => setShowLabelPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modernFieldValue, { color: textColor }]}>
                    {editedTransaction.label || 'Select label'}
                  </Text>
                  <Text style={[styles.modernFieldChevron, { color: secondaryTextColor }]}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modernActionsContainer}>
              <TouchableOpacity 
                style={[styles.modernActionButton, { backgroundColor: '#007AFF' }]}
                onPress={() => Alert.alert('Split Transaction', 'Feature coming soon!')}
                activeOpacity={0.8}
              >
                <Text style={styles.modernActionText}>📝 Split Transaction</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modernActionButton, { backgroundColor: '#34C759' }]}
                onPress={() => Alert.alert('Mark as Paid', 'Feature coming soon!')}
                activeOpacity={0.8}
              >
                <Text style={styles.modernActionText}>
                  {transaction.mark ? '❌ Mark as Unpaid' : '✅ Mark as Paid'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Simple Date Picker Alert for now */}
      {showDatePicker && (
        <Modal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerAlert, { backgroundColor }]}>
              <Text style={[styles.pickerAlertTitle, { color: textColor }]}>Date Picker</Text>
              <Text style={[styles.pickerAlertMessage, { color: secondaryTextColor }]}>
                iOS-style date picker will be implemented here
              </Text>
              <TouchableOpacity 
                style={[styles.pickerAlertButton, { backgroundColor: '#007AFF' }]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.pickerAlertButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Bank Category Picker */}
      {showBankCategoryPicker && (
        <Modal visible={showBankCategoryPicker} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContainer, { backgroundColor }]}>
              <View style={[styles.pickerHeader, { borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => setShowBankCategoryPicker(false)}>
                  <Text style={[styles.pickerButton, { color: '#007AFF' }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.pickerTitle, { color: textColor }]}>Bank Category</Text>
                <View style={{ width: 60 }} />
              </View>
              
              <ScrollView style={styles.pickerScroll}>
                <TouchableOpacity 
                  style={[styles.pickerOption, { backgroundColor: cardColor }]}
                  onPress={() => {
                    handleFieldChange('bank_category', '');
                    setShowBankCategoryPicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, { color: textColor }]}>None</Text>
                </TouchableOpacity>
                
                {availableBankCategories.map((category) => (
                  <TouchableOpacity 
                    key={category}
                    style={[styles.pickerOption, { backgroundColor: cardColor }]}
                    onPress={() => {
                      handleFieldChange('bank_category', category);
                      setShowBankCategoryPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, { color: textColor }]}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Label Picker */}
      {showLabelPicker && (
        <Modal visible={showLabelPicker} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContainer, { backgroundColor }]}>
              <View style={[styles.pickerHeader, { borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => setShowLabelPicker(false)}>
                  <Text style={[styles.pickerButton, { color: '#007AFF' }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.pickerTitle, { color: textColor }]}>Label</Text>
                <View style={{ width: 60 }} />
              </View>
              
              <ScrollView style={styles.pickerScroll}>
                <TouchableOpacity 
                  style={[styles.pickerOption, { backgroundColor: cardColor }]}
                  onPress={() => {
                    handleFieldChange('label', '');
                    setShowLabelPicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, { color: textColor }]}>None</Text>
                </TouchableOpacity>
                
                {labels.map((label) => (
                  <TouchableOpacity 
                    key={label}
                    style={[styles.pickerOption, { backgroundColor: cardColor }]}
                    onPress={() => {
                      handleFieldChange('label', label);
                      setShowLabelPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, { color: textColor }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

// Transaction List Component
const TransactionList: React.FC<{
  transactions: Transaction[];
  labels: string[];
  textColor: string;
  colorScheme: 'light' | 'dark' | null | undefined;
}> = ({ transactions, labels, textColor, colorScheme }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showModal, setShowModal] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Handle transaction save
  const handleTransactionSave = async (transactionId: string, updates: Partial<Transaction>) => {
    try {
      const apiUrl = `${getApiBaseUrl()}/transactions/${transactionId}`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update transaction');
      }

      // Here you would typically refresh the transaction list
      // For now, we'll just close the modal
      setShowModal(false);
      setSelectedTransaction(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  };

  // Handle transaction click
  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  // Get label-based background color similar to web app
  const getLabelStyle = (label: string) => {
    if (label === labels[0]) {
      // Ruby - light pink
      return {
        backgroundColor: colorScheme === 'dark' ? 'rgba(255, 99, 132, 0.08)' : 'rgba(255, 99, 132, 0.05)',
        borderLeftColor: 'rgba(255, 99, 132, 0.8)',
      };
    }
    if (label === labels[1]) {
      // Jack - light blue  
      return {
        backgroundColor: colorScheme === 'dark' ? 'rgba(54, 162, 235, 0.08)' : 'rgba(54, 162, 235, 0.05)',
        borderLeftColor: 'rgba(54, 162, 235, 0.8)',
      };
    }
    if (label === labels[2]) {
      // Both - light green
      return {
        backgroundColor: colorScheme === 'dark' ? 'rgba(75, 192, 95, 0.08)' : 'rgba(75, 192, 95, 0.05)',
        borderLeftColor: 'rgba(75, 192, 95, 0.8)',
      };
    }
    return {
      backgroundColor: 'transparent',
      borderLeftColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    };
  };

  // Format date like the web app
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
  };

  // Format amount like the web app
  const formatAmount = (amount: string) => {
    const numAmount = parseFloat(amount);
    if (numAmount < 0) {
      return `-$${Math.abs(numAmount)}`;
    }
    return `$${numAmount}`;
  };

  // Get amount color
  const getAmountColor = (amount: string) => {
    const numAmount = parseFloat(amount);
    if (numAmount < 0) {
      return '#dc3545'; // Red for negative
    }
    return '#28a745'; // Green for positive
  };

  // Filter transactions by current month and labels
  const filteredTransactions = transactions.filter(transaction => {
    // Filter out transactions without labels
    if (!transaction.label || transaction.label.trim() === '') {
      return false;
    }
    
    // Filter by month and year
    const transactionDate = new Date(transaction.date);
    return transactionDate.getMonth() === currentMonth && 
           transactionDate.getFullYear() === currentYear;
  });

  // Sort transactions by date (newest first) like web app default
  const sortedTransactions = [...filteredTransactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Animation helper function
  const animateMonthChange = (changeFunction: () => void, direction: 'next' | 'prev') => {
    const screenWidth = Dimensions.get('window').width;
    const slideOutValue = direction === 'next' ? -screenWidth : screenWidth;
    const slideInValue = direction === 'next' ? screenWidth : -screenWidth;
    
    // Slide out current content
    Animated.timing(slideAnim, {
      toValue: slideOutValue,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Change month
      changeFunction();
      // Reset position for slide in with a small delay to ensure state update completes
      slideAnim.setValue(slideInValue);
      
      // Use requestAnimationFrame to ensure React has time to process the state change
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Slide in new content
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        });
      });
    });
  };

  // Month navigation functions
  const handlePrevMonth = () => {
    animateMonthChange(() => {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    }, 'prev');
  };

  const handleNextMonth = () => {
    animateMonthChange(() => {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }, 'next');
  };

  const getMonthYearString = () => {
    const date = new Date(currentYear, currentMonth);
    return date.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric'
    });
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return currentMonth === now.getMonth() && currentYear === now.getFullYear();
  };

  if (sortedTransactions.length === 0) {
    return (
      <View style={[styles.transactionListContainer, { 
        backgroundColor: colorScheme === 'dark' ? 'rgba(30, 30, 30, 0.3)' : 'rgba(255, 255, 255, 0.8)',
        borderColor: colorScheme === 'dark' ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'
      }]}>
        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity 
            style={[styles.navButton, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}
            onPress={handlePrevMonth}
          >
            <Text style={[styles.navButtonText, { color: textColor }]}>‹</Text>
          </TouchableOpacity>
          
          <Animated.View style={[styles.monthYearContainer, { transform: [{ translateX: slideAnim }] }]}>
            <Text style={[styles.monthYearText, { color: textColor }]}>
              {getMonthYearString()}
            </Text>
            {isCurrentMonth() && (
              <Text style={[styles.currentMonthIndicator, { color: textColor, opacity: 0.6 }]}>
                Current
              </Text>
            )}
          </Animated.View>
          
          <TouchableOpacity 
            style={[styles.navButton, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}
            onPress={handleNextMonth}
          >
            <Text style={[styles.navButtonText, { color: textColor }]}>›</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.emptyState, { transform: [{ translateX: slideAnim }] }]}>
          <ThemedText style={[styles.emptyStateText, { color: textColor }]}>
            No transactions for {getMonthYearString()}
          </ThemedText>
          <ThemedText style={[styles.emptyStateSubtext, { color: textColor, opacity: 0.7 }]}>
            Try a different month or check if transactions have labels
          </ThemedText>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.transactionListContainer, { 
      backgroundColor: colorScheme === 'dark' ? 'rgba(30, 30, 30, 0.3)' : 'rgba(255, 255, 255, 0.8)',
      borderColor: colorScheme === 'dark' ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'
    }]}>
      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity 
          style={[styles.navButton, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}
          onPress={handlePrevMonth}
        >
          <Text style={[styles.navButtonText, { color: textColor }]}>‹</Text>
        </TouchableOpacity>
        
        <Animated.View style={[styles.monthYearContainer, { transform: [{ translateX: slideAnim }] }]}>
          <Text style={[styles.monthYearText, { color: textColor }]}>
            {getMonthYearString()}
          </Text>
          <Text style={[styles.transactionCount, { color: textColor, opacity: 0.7 }]}>
            {sortedTransactions.length} transactions
          </Text>
          {isCurrentMonth() && (
            <Text style={[styles.currentMonthIndicator, { color: textColor, opacity: 0.6 }]}>
              Current
            </Text>
          )}
        </Animated.View>
        
        <TouchableOpacity 
          style={[styles.navButton, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}
          onPress={handleNextMonth}
        >
          <Text style={[styles.navButtonText, { color: textColor }]}>›</Text>
        </TouchableOpacity>
      </View>
      
      <Animated.View style={[styles.transactionContainer, { 
        transform: [{ translateX: slideAnim }]
      }]}>
        {sortedTransactions.map((transaction) => {
          const labelStyle = getLabelStyle(transaction.label);
          
          return (
            <TouchableOpacity
              key={transaction.id}
              style={[
                styles.compactTransactionItem,
                labelStyle,
                {
                  borderColor: colorScheme === 'dark' ? 'rgba(80, 80, 80, 0.2)' : 'rgba(200, 200, 200, 0.2)',
                }
              ]}
              onPress={() => handleTransactionClick(transaction)}
              activeOpacity={0.7}
            >
              {/* Compact transaction layout */}
              <View style={styles.compactTransactionContent}>
                {/* Left side: Date and Amount */}
                <View style={styles.compactLeftSection}>
                  <Text style={[styles.compactDate, { color: textColor }]}>
                    {formatDate(transaction.date)}
                  </Text>
                  <Text style={[
                    styles.compactAmount, 
                    { color: getAmountColor(transaction.amount) }
                  ]}>
                    {formatAmount(transaction.amount)}
                  </Text>
                </View>
                
                {/* Right side: Description and Tags */}
                <View style={styles.compactRightSection}>
                  <Text 
                    style={[styles.compactDescription, { color: textColor }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {transaction.description}
                  </Text>
                  <View style={styles.compactTags}>
                    <Text style={[styles.compactCategory, { 
                      color: textColor, 
                      opacity: 0.7,
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
                    }]}>
                      {transaction.bank_category || 'No Cat'}
                    </Text>
                    <Text style={[styles.compactLabel, { 
                      color: textColor,
                      backgroundColor: labelStyle.borderLeftColor + '25'
                    }]}>
                      {transaction.label}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
      
      {/* Transaction Edit Modal */}
             <TransactionEditModal
         visible={showModal}
         transaction={selectedTransaction}
         labels={labels}
         onClose={() => {
           setShowModal(false);
           setSelectedTransaction(null);
         }}
         onSave={handleTransactionSave}
         colorScheme={colorScheme || null}
       />
    </View>
  );
};

export default function HomeScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const colorScheme = useColorScheme();
  const categoryColorsRef = useRef<Record<string, string>>({});
  
  // Reset color cache when component mounts to ensure color changes take effect
  useEffect(() => {
    categoryColorsRef.current = {};
  }, []);
  
  useEffect(() => {
    fetchTransactions();
    fetchLabels();
  }, []);
  
  const fetchLabels = async () => {
    try {
      const apiUrl = `${getApiBaseUrl()}/labels`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch labels: ${response.status}`);
      }
      
      const data = await response.json();
      setLabels(data);
    } catch (err) {
      console.error('Error fetching labels:', err);
      // Don't show error to user for labels, just use empty array
      setLabels([]);
    }
  };
  
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // Use the same API endpoint as the web app
      const apiUrl = `${getApiBaseUrl()}/transactions`;
      console.log('Fetching transactions from:', apiUrl);
      
      // Using fetch API instead of axios
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      setTransactions(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchTransactions(), fetchLabels()]);
  };
  
  // Force chart to update when category colors change
  const colorVersion = useMemo(() => categoryColors.join('-'), [categoryColors]);
  
  // Prepare data for the stacked chart by category
  const prepareCategoryChartData = useCallback((): CategoryChartData[] => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Filter transactions: only include those with labels and exclude transfers
    const filteredTransactions = transactions.filter(transaction => {
      // Filter out unlabelled transactions
      if (!transaction.label) {
        return false;
      }
      
      // Skip positive transfer transactions
      if (transaction.bank_category === "Transfer" && parseFloat(transaction.amount) > 0) {
        return false;
      }
      
      return true;
    });

    // Get unique categories
    const uniqueCategories = [...new Set(
      filteredTransactions
        .map(transaction => transaction.category)
        .filter(category => category !== null && category !== undefined && category !== '')
    )].sort();

    // Clear existing color assignments to apply any new colors
    categoryColorsRef.current = {};
    
    // Assign colors to categories
    uniqueCategories.forEach((category, index) => {
      categoryColorsRef.current[category] = categoryColors[index % categoryColors.length] || getRandomColor();
    });

    const categoryData: CategoryChartData[] = [];

    uniqueCategories.forEach(category => {
      const monthlyData = Array(12).fill(0);
      let hasData = false;

      filteredTransactions.forEach(transaction => {
        if (transaction.category === category) {
          const month = new Date(transaction.date).getMonth();
          const amount = parseFloat(transaction.amount) || 0;
          
          // For visualization: add negative amounts, subtract positive amounts
          if (amount < 0) {
            monthlyData[month] += Math.abs(amount);
          } else {
            monthlyData[month] -= amount;
          }
          hasData = true;
        }
      });

      // Only include categories with data
      if (hasData) {
        categoryData.push({
          category,
          data: monthlyData,
          color: categoryColorsRef.current[category]
        });
      }
    });

    return categoryData;
  }, [transactions, colorVersion]);
  
  const categoryChartData = prepareCategoryChartData();
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colorScheme === 'dark' ? '#A1CEDC' : '#1D3D47']}
            tintColor={colorScheme === 'dark' ? '#A1CEDC' : '#1D3D47'}
          />
        }
      >
        {/* commented out for the time being
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={{ textAlign: 'center', width: '100%' }}>Finance Dashboard</ThemedText>
        </ThemedView>
        */}
        <ThemedView style={styles.chartContainer}>
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#A1CEDC' : '#1D3D47'} />
          ) : error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : categoryChartData.length > 0 ? (
            <View style={styles.chartWrapper}>
              <StackedBarChart 
                categoryData={categoryChartData} 
                height={280} 
                textColor={textColor}
              />
            </View>
          ) : (
            <ThemedText style={styles.noDataText}>No transaction data available</ThemedText>
          )}
        </ThemedView>

        {/* Transaction List */}
        {!loading && !error && (
          <TransactionList 
            transactions={transactions}
            labels={labels}
            textColor={textColor}
            colorScheme={colorScheme}
          />
        )}
        
        <ThemedView style={styles.infoContainer}>
          <ThemedText type="subtitle" style={{ textAlign: 'center', width: '100%' }}>Shared Transactions</ThemedText>
          <ThemedText>
            This chart shows your monthly spending broken down by category. Each color represents a different spending category, and the height shows the total amount. Pull down to refresh.
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  chartContainer: {
    marginBottom: 16,
    padding: 8,
    paddingTop: 0,
    borderRadius: 16,
    gap: 8,
  },
  chartWrapper: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 8,
    paddingTop: 8,
  },
  stackedBarChartContainer: {
    width: '100%',
    position: 'relative',
    minHeight: 290,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    paddingHorizontal: 4,
    paddingTop: 20,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    height: 220,
    marginBottom: 20,
    paddingTop: 20,
    paddingHorizontal: 2,
  },
  barColumn: {
    alignItems: 'center',
    width: screenWidth / 6 - 6,
    marginHorizontal: 3,
  },
  currentMonthBar: {
    // Subtle highlight for current month
    backgroundColor: 'rgba(120, 120, 255, 0.05)', 
    borderRadius: 8,
    paddingVertical: 4,
  },
  currentMonthLabel: {
    fontWeight: '700',
  },
  barTotal: {
    fontSize: 10,
    marginBottom: 4,
    fontWeight: '600',
    position: 'absolute',
    top: -18,
    width: '100%',
    textAlign: 'center',
    zIndex: 5,
  },
  outlierBarTotal: {
    top: -24, // Position higher but without special styling
    fontWeight: '700',
  },
  stackedBar: {
    width: '65%', // Slimmer bars for modern look
    justifyContent: 'flex-end',
    borderRadius: 4,
  },
  barSegment: {
    width: '100%',
  },
  monthLabel: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    marginVertical: 4,
  },
  legendItemInactive: {
    opacity: 0.6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  infoContainer: {
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 16,
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  tooltipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
  },
  tooltipColorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  tooltipText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  filterStatusText: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  legendScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  legendScrollView: {
    flexDirection: 'row',
  },
  legendItemHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  legendTextHorizontal: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 2,
  },
  // Transaction List Styles
  transactionListContainer: {
    marginBottom: 16,
    marginHorizontal: 0,
    borderRadius: 0,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    overflow: 'hidden',
  },
  transactionContainer: {
    paddingBottom: 8,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  navButton: {
    padding: 8,
    borderRadius: 12,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  monthYearContainer: {
    alignItems: 'center',
    flex: 1,
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentMonthIndicator: {
    fontSize: 12,
    fontWeight: '500',
  },
  transactionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactTransactionItem: {
    marginHorizontal: 0,
    marginVertical: 4,
    borderRadius: 0,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderRightWidth: 0,
    overflow: 'hidden',
  },
  compactTransactionContent: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  compactLeftSection: {
    width: 80,
    alignItems: 'flex-start',
  },
  compactDate: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  compactAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactRightSection: {
    flex: 1,
    marginLeft: 12,
  },
  compactDescription: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  compactTags: {
    flexDirection: 'row',
    gap: 6,
  },
  compactCategory: {
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  compactLabel: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  modernModalContainer: {
    width: '100%',
    maxWidth: 400,
    height: '90%',
    maxHeight: 700,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  modernModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  modernCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modernCloseText: {
    fontSize: 16,
    fontWeight: '400',
  },
  modernModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  modernModalContent: {
    flex: 1,
  },
  modernScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '600',
  },
  summaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryDescription: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  fieldsContainer: {
    marginBottom: 16,
  },
  modernFieldCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  modernFieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  modernFieldButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  modernFieldValue: {
    fontSize: 16,
    flex: 1,
  },
  modernFieldChevron: {
    fontSize: 16,
    marginLeft: 8,
  },
  modernTextInput: {
    fontSize: 16,
    paddingVertical: 4,
    minHeight: 22,
  },
  modernActionsContainer: {
    gap: 12,
  },
  modernActionButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modernActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerAlert: {
    width: '80%',
    maxHeight: '80%',
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  pickerAlertTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerAlertMessage: {
    fontSize: 14,
    fontWeight: '500',
  },
  pickerAlertButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickerAlertButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    width: '80%',
    maxHeight: '80%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    modernSaveButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    modernSaveText: {
      color: '#007AFF',
      fontSize: 16,
      fontWeight: '600',
    },
   pickerButton: {
     fontSize: 16,
     fontWeight: '500',
   },
   pickerTitle: {
     fontSize: 18,
     fontWeight: '600',
   },
   pickerScroll: {
     maxHeight: 300,
     padding: 10,
   },
   pickerOption: {
     padding: 16,
     marginVertical: 4,
     borderRadius: 8,
     marginHorizontal: 10,
   },
   pickerOptionText: {
     fontSize: 16,
     fontWeight: '500',
   },
});

