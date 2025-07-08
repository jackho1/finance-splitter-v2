import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { 
  StyleSheet, 
  Dimensions, 
  RefreshControl, 
  ScrollView, 
  ActivityIndicator, 
  Platform, 
  View, 
  Text,
  TextInput,
  Modal,
  Alert,
  Pressable,
  FlatList,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';

// Constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHART_HEIGHT = 280;
const BAR_WIDTH = SCREEN_WIDTH / 6;

// Types
interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  bank_category: string;
  category: string;
  label: string;
  mark?: boolean;
}

interface DateHeader {
  type: 'date';
  date: string;
  id: string;
}

interface TransactionWithType extends Transaction {
  type: 'transaction';
}

type ListItem = DateHeader | TransactionWithType;

interface CategoryData {
  category: string;
  data: number[];
  color: string;
}

interface CategoryTotal {
  category: string;
  total: number;
  color: string;
  percentage: number;
}

interface SelectedSegment {
  category: string;
  amount: number;
  month: number;
  color: string;
}

// API Configuration
const API_CONFIG = {
  development: {
    ios: 'http://192.168.50.203:8080',
    android: 'http://192.168.241.111:5000',
    web: 'http://192.168.241.111:5000',
  },
  production: 'https://your-production-api-url.com',
};

const getApiBaseUrl = (): string => {
  if (__DEV__) {
    return API_CONFIG.development[Platform.OS as keyof typeof API_CONFIG.development] || API_CONFIG.development.web;
  }
  return API_CONFIG.production;
};

// Color palette for categories
const CATEGORY_COLORS = [
  '#4361EE', '#3A0CA3', '#7209B7', '#F72585', '#4CC9F0', 
  '#4895EF', '#560BAD', '#B5179E', '#F15BB5', '#9D4EDD',
  '#06D6A0', '#118AB2', '#073B4C', '#FFD166', '#EF476F'
];

// User color themes - compatible with light and dark modes
const USER_COLORS = {
  // Ruby - Red theme
  ruby: {
    light: {
      background: 'rgba(255, 99, 132, 0.1)',
      border: 'rgba(255, 99, 132, 0.3)',
      accent: '#e53935'
    },
    dark: {
      background: 'rgba(255, 99, 132, 0.15)',
      border: 'rgba(255, 99, 132, 0.4)',
      accent: '#ff6b6b'
    }
  },
  // Jack - Blue theme
  jack: {
    light: {
      background: 'rgba(54, 162, 235, 0.1)',
      border: 'rgba(54, 162, 235, 0.3)',
      accent: '#1976d2'
    },
    dark: {
      background: 'rgba(54, 162, 235, 0.15)',
      border: 'rgba(54, 162, 235, 0.4)',
      accent: '#42a5f5'
    }
  },
  // Both - Green theme
  both: {
    light: {
      background: 'rgba(75, 192, 95, 0.1)',
      border: 'rgba(75, 192, 95, 0.3)',
      accent: '#388e3c'
    },
    dark: {
      background: 'rgba(75, 192, 95, 0.15)',
      border: 'rgba(75, 192, 95, 0.4)',
      accent: '#66bb6a'
    }
  }
};

// Month labels
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Helper function to get user colors based on label and theme
const getUserColors = (label: string, isDark: boolean) => {
  const theme = isDark ? 'dark' : 'light';
  const normalizedLabel = label?.toLowerCase();
  
  if (normalizedLabel === 'ruby') {
    return USER_COLORS.ruby[theme];
  } else if (normalizedLabel === 'jack') {
    return USER_COLORS.jack[theme];
  } else if (normalizedLabel === 'both') {
    return USER_COLORS.both[theme];
  }
  
  // Default colors for unlabeled transactions
  return {
    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    accent: isDark ? '#666' : '#999'
  };
};

// Helper function to get category from bank_category using mappings (like frontend)
const getCategoryFromMapping = (bankCategory: string | null | undefined, categoryMappings: Record<string, string>): string | null => {
  if (!bankCategory) return null;
  // Only return a value if it exists in the mappings
  return categoryMappings[bankCategory] || null;
};

// Helper function to determine the actual category for a transaction
const getTransactionCategory = (transaction: Transaction, categoryMappings: Record<string, string>): string => {
  // First check if the transaction already has a category set
  if (transaction.category) {
    return transaction.category;
  }
  
  // If no category is set, try to get it from the bank_category mapping
  const mappedCategory = getCategoryFromMapping(transaction.bank_category, categoryMappings);
  
  // If the bank_category is not mapped or is empty, it's unknown
  if (!mappedCategory) {
    return 'Unknown';
  }
  
  return mappedCategory;
};

// Memoized Components
const ChartBar = memo<{
  month: number;
  segments: Array<{ category: string; value: number; color: string }>;
  maxValue: number;
  height: number;
  onSegmentPress: (segment: SelectedSegment) => void;
}>(({ month, segments, maxValue, height, onSegmentPress }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const currentMonth = new Date().getMonth();
  const isCurrentMonth = month === currentMonth;
  
  const monthTotal = segments.reduce((sum, seg) => sum + seg.value, 0);
  const scaledHeight = (monthTotal / maxValue) * height;
  
  return (
    <View style={styles.barContainer}>
      <View style={[
        styles.bar,
        { height: scaledHeight },
        isCurrentMonth && styles.currentMonthBar
      ]}>
        {segments.map((segment, index) => {
          const segmentHeight = (segment.value / monthTotal) * scaledHeight;
          return (
            <Pressable
              key={`${segment.category}-${index}`}
              style={[
                styles.barSegment,
                { 
                  height: segmentHeight,
                  backgroundColor: segment.color,
                }
              ]}
              onPress={() => onSegmentPress({
                category: segment.category,
                amount: segment.value,
                month,
                color: segment.color
              })}
            />
          );
        })}
      </View>
      
      <Text style={[
        styles.monthLabel,
        { color: isDark ? '#fff' : '#000' },
        isCurrentMonth && styles.currentMonthLabel
      ]}>
        {MONTH_LABELS[month]}
      </Text>
      
      {monthTotal > 0 && (
        <Text style={[
          styles.barTotal,
          { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }
        ]}>
          ${Math.round(monthTotal)}
        </Text>
      )}
    </View>
  );
});

const DateHeader = memo<{
  date: string;
  colorScheme: 'light' | 'dark';
}>(({ date, colorScheme }) => {
  const isDark = colorScheme === 'dark';
  
  const formatDateHeader = (dateString: string) => {
    if (!dateString) return { dateText: 'Unknown Date', relativeText: '' };
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    // Calculate days difference
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Format the main date (left side)
    const isCurrentYear = date.getFullYear() === today.getFullYear();
    const dateText = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: isCurrentYear ? undefined : 'numeric'
    });
    
    // Format relative time (right side)
    let relativeText = '';
    if (isToday) {
      relativeText = 'Today';
    } else if (isYesterday) {
      relativeText = 'Yesterday';
    } else if (diffDays > 0) {
      relativeText = `${diffDays} days ago`;
    } else {
      relativeText = 'Future';
    }
    
    return {
      dateText,
      relativeText
    };
  };
  
  const dateInfo = formatDateHeader(date);
  
  return (
    <View style={[
      styles.dateHeader,
      { borderBottomColor: isDark ? '#333' : '#e1e5e9' }
    ]}>
      <View style={styles.dateHeaderContent}>
        <Text style={[
          styles.dateHeaderText,
          { color: isDark ? '#fff' : '#000' }
        ]}>
          {dateInfo.dateText}
        </Text>
        {dateInfo.relativeText && (
          <Text style={[
            styles.dateHeaderSubText,
            { color: isDark ? '#888' : '#666' }
          ]}>
            {dateInfo.relativeText}
          </Text>
        )}
      </View>
    </View>
  );
});

const TransactionItem = memo<{
  transaction: Transaction;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
  categoryMappings: Record<string, string>;
}>(({ transaction, onPress, colorScheme, categoryMappings }) => {
  const isDark = colorScheme === 'dark';
  
  // Use the same category determination logic for consistent coloring
  const actualCategory = getTransactionCategory(transaction, categoryMappings);
  const categoryColor = useMemo(() => 
    CATEGORY_COLORS[actualCategory.charCodeAt(0) % CATEGORY_COLORS.length],
    [actualCategory]
  );
  
  const userColors = useMemo(() => 
    getUserColors(transaction.label, isDark),
    [transaction.label, isDark]
  );
  
  return (
    <Pressable
      style={({ pressed }) => [
        styles.transactionItem,
        {
          backgroundColor: userColors.background,
          borderColor: userColors.border,
          opacity: pressed ? 0.7 : 1,
        }
      ]}
      onPress={onPress}
    >
      <View style={styles.transactionRow}>
        <View style={styles.transactionContent}>
          <View style={styles.transactionHeader}>
            <Text 
              style={[styles.transactionDescription, { color: isDark ? '#fff' : '#000' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {transaction.description || 'No description'}
            </Text>
            <Text style={[styles.transactionAmount, { color: userColors.accent }]}>
              {parseFloat(transaction.amount || '0') < 0 ? '-' : ''}${Math.abs(parseFloat(transaction.amount || '0')).toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.transactionTags}>
            {transaction.bank_category && (
              <View style={[styles.categoryTag, { backgroundColor: categoryColor + '20' }]}>
                <Text style={[styles.categoryTagText, { color: categoryColor }]}>
                  {transaction.bank_category}
                </Text>
              </View>
            )}
            
            {transaction.label && (
              <View style={[styles.labelTag, { 
                backgroundColor: userColors.accent + '20',
                borderWidth: 1,
                borderColor: userColors.accent + '40'
              }]}>
                <Text style={[styles.labelTagText, { color: userColors.accent }]}>
                  {transaction.label}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// Main Component
export default function FinanceDashboard() {
  // Hooks
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollViewRef = useRef<ScrollView>(null);
  
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [lastPressTime, setLastPressTime] = useState<number>(0);
  
  // Category filtering state
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  
  // Helper function to get bank categories for a given category
  const getBankCategoriesForCategory = useCallback((category: string): string[] => {
    return Object.entries(categoryMappings)
      .filter(([_, mappedCategory]) => mappedCategory === category)
      .map(([bankCategory, _]) => bankCategory);
  }, [categoryMappings]);
  
  // Modal animation
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  
  // Computed values
  const categoryData = useMemo(() => {
    if (!transactions || !transactions.length) return [];
    
    // Filter transactions: only include those with labels and exclude transfers (matching index.tsx)
    const filteredTransactions = transactions.filter(transaction => {
      // Filter out unlabelled transactions (like index.tsx)
      if (!transaction.label) {
        return false;
      }
      
      // Skip positive transfer transactions (deposits)
      if (transaction.bank_category === "Transfer" && parseFloat(transaction.amount) > 0) {
        return false;
      }
      
      return true;
    });
    
    // Get unique categories using the enhanced category determination
    const uniqueCategories = [...new Set(
      filteredTransactions
        .map(transaction => getTransactionCategory(transaction, categoryMappings))
        .filter(category => category !== null && category !== undefined && category !== '' && category !== 'Unknown')
    )].sort();
    
    const categories = new Map<string, number[]>();
    const categoryColorMap = new Map<string, string>();
    
    // Assign colors to categories
    uniqueCategories.forEach((category, index) => {
      categories.set(category, new Array(12).fill(0));
      categoryColorMap.set(category, CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
    });
    
    filteredTransactions.forEach((transaction) => {
      // Use the enhanced category determination
      const category = getTransactionCategory(transaction, categoryMappings);
      
      if (categories.has(category)) {
        const { date, amount } = transaction;
        const month = new Date(date || new Date()).getMonth();
        const numAmount = parseFloat(amount || '0');
        
        // Use the same calculation logic as index.tsx:
        // For visualization: add negative amounts, subtract positive amounts
        const monthData = categories.get(category)!;
        if (numAmount < 0) {
          monthData[month] += Math.abs(numAmount);
        } else {
          monthData[month] -= numAmount;
        }
      }
    });
    
    // Only include categories with data
    const result = Array.from(categories.entries())
      .map(([category, data]) => ({
        category,
        data,
        color: categoryColorMap.get(category)!,
      }))
      .filter(categoryData => {
        // Check if category has any non-zero data
        return categoryData.data.some(value => value !== 0);
      });
    
    return result;
  }, [transactions, categoryMappings]);
  
  const filteredCategoryData = useMemo(() => {
    if (selectedCategories.length === 0 && selectedCategoryFilters.length === 0) return categoryData;
    
    let filtered = categoryData;
    
    // Filter by selected categories from chart legend
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(cat => selectedCategories.includes(cat.category));
    }
    
    // Filter by selected categories from category summary
    if (selectedCategoryFilters.length > 0) {
      filtered = filtered.filter(cat => selectedCategoryFilters.includes(cat.category));
    }
    
    return filtered;
  }, [categoryData, selectedCategories, selectedCategoryFilters]);
  
  const monthlyTransactions = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (!t.date) return false;
      const transactionDate = new Date(t.date);
      
      // Filter by month and year
      if (transactionDate.getMonth() !== displayMonth || 
          transactionDate.getFullYear() !== currentYear) {
        return false;
      }
      
      // Filter by selected categories if any are selected
      if (selectedCategoryFilters.length > 0) {
        // Use the same category determination logic
        const transactionCategory = getTransactionCategory(t, categoryMappings);
        return selectedCategoryFilters.includes(transactionCategory);
      }
      
      return true;
    });
    
    return filtered;
  }, [transactions, displayMonth, currentYear, selectedCategoryFilters, categoryMappings]);
  
  // Group transactions by date and create flat array with date headers
  const groupedTransactions = useMemo((): ListItem[] => {
    const groupedByDate = new Map<string, Transaction[]>();
    
    // Group transactions by date
    monthlyTransactions.forEach(transaction => {
      const dateStr = transaction.date;
      if (!groupedByDate.has(dateStr)) {
        groupedByDate.set(dateStr, []);
      }
      groupedByDate.get(dateStr)!.push(transaction);
    });
    
    // Sort dates in descending order (newest first)
    const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
    
    // Create flat array with date headers and transactions
    const result: ListItem[] = [];
    sortedDates.forEach(dateStr => {
      // Add date header
      result.push({
        type: 'date',
        date: dateStr,
        id: `date-${dateStr}`
      });
      
      // Add transactions for this date
      const transactionsForDate = groupedByDate.get(dateStr)!;
      transactionsForDate.forEach(transaction => {
        result.push({
          ...transaction,
          type: 'transaction'
        });
      });
    });
    
    return result;
  }, [monthlyTransactions]);
  
  // Calculate unfiltered monthly transactions for category totals
  const unfileredMonthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return false;
      const transactionDate = new Date(t.date);
      
      // Only filter by month and year (no category filtering)
      return transactionDate.getMonth() === displayMonth && 
             transactionDate.getFullYear() === currentYear;
    });
  }, [transactions, displayMonth, currentYear]);

  const categoryTotals = useMemo((): CategoryTotal[] => {
    const totals = new Map<string, { total: number; color: string }>();
    
    // Use unfiltered monthly transactions to show all categories
    unfileredMonthlyTransactions.forEach(transaction => {
      // Skip transactions without labels (only show labeled transactions in summary)
      if (!transaction.label) {
        return;
      }
      
      // Use the same category determination logic for consistency
      const category = getTransactionCategory(transaction, categoryMappings);
      const amount = Math.abs(parseFloat(transaction.amount || '0'));
      const existing = totals.get(category) || { total: 0, color: '' };
      
      totals.set(category, {
        total: existing.total + amount,
        color: existing.color || CATEGORY_COLORS[totals.size % CATEGORY_COLORS.length]
      });
    });
    
    const totalAmount = Array.from(totals.values()).reduce((sum, cat) => sum + cat.total, 0);
    
    const result = Array.from(totals.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        color: data.color,
        percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
    
    return result;
  }, [unfileredMonthlyTransactions, categoryMappings]);
  
  // API calls
  const fetchTransactions = useCallback(async () => {
    try {
      const apiUrl = `${getApiBaseUrl()}/initial-data`;
      console.log('Fetching initial data from:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract data from the response
      const { transactions, categoryMappings } = data.data;
      
      setTransactions(transactions);
      setCategoryMappings(categoryMappings);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  const updateTransaction = useCallback(async (transaction: Transaction) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction),
      });
      
      if (!response.ok) throw new Error('Failed to update transaction');
      
      await fetchTransactions();
      setSelectedTransaction(null);
      Alert.alert('Success', 'Transaction updated successfully');
    } catch (error) {
      console.error('Error updating transaction:', error);
      Alert.alert('Error', 'Failed to update transaction. Please try again.');
    }
  }, [fetchTransactions]);
  
  const deleteTransaction = useCallback(async (id: string) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${getApiBaseUrl()}/transactions/${id}`, {
                method: 'DELETE',
              });
              
              if (!response.ok) throw new Error('Failed to delete transaction');
              
              await fetchTransactions();
              setSelectedTransaction(null);
              Alert.alert('Success', 'Transaction deleted successfully');
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction. Please try again.');
            }
          }
        }
      ]
    );
  }, [fetchTransactions]);
  
  // Event handlers
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTransactions();
  }, [fetchTransactions]);
  
  const toggleCategoryFilter = useCallback((category: string) => {
    // Add haptic feedback for better user interaction
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
    setSelectedSegment(null);
  }, []);
  
  const resetFilters = useCallback(() => {
    // Add haptic feedback for better user interaction
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setSelectedCategories([]);
    setSelectedSegment(null);
    setSelectedCategoryFilters([]);
  }, []);
  
  const handleCategorySummaryClick = useCallback((category: string) => {
    // Add haptic feedback for better user interaction
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (selectedCategoryFilters.includes(category)) {
      // If the category is already selected, remove it
      setSelectedCategoryFilters(prev => prev.filter(c => c !== category));
    } else {
      // Add the category to the filters
      setSelectedCategoryFilters(prev => [...prev, category]);
    }
  }, [selectedCategoryFilters]);
  
  // Modal animation functions
  const showModal = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    modalScale.setValue(0.3);
    modalOpacity.setValue(0);
    
    Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [modalScale, modalOpacity]);
  
  const hideModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 0.3,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedTransaction(null);
    });
  }, [modalScale, modalOpacity]);
  
  const splitTransaction = useCallback(async (transaction: Transaction) => {
    hideModal();
    // TODO: Implement split transaction functionality
    Alert.alert('Split Transaction', 'Split transaction functionality coming soon!');
  }, [hideModal]);
  
  const toggleTransactionMark = useCallback(async (transaction: Transaction) => {
    try {
      const updatedTransaction = {
        ...transaction,
        mark: !transaction.mark
      };
      
      const response = await fetch(`${getApiBaseUrl()}/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTransaction),
      });
      
      if (!response.ok) throw new Error('Failed to update transaction');
      
      await fetchTransactions();
      hideModal();
      Alert.alert('Success', `Transaction marked as ${updatedTransaction.mark ? 'paid' : 'unpaid'}`);
    } catch (error) {
      console.error('Error updating transaction mark:', error);
      Alert.alert('Error', 'Failed to update transaction. Please try again.');
    }
  }, [fetchTransactions, hideModal]);
  
  const updateTransactionWithModal = useCallback(async (transaction: Transaction) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction),
      });
      
      if (!response.ok) throw new Error('Failed to update transaction');
      
      await fetchTransactions();
      hideModal();
      Alert.alert('Success', 'Transaction updated successfully');
    } catch (error) {
      console.error('Error updating transaction:', error);
      Alert.alert('Error', 'Failed to update transaction. Please try again.');
    }
  }, [fetchTransactions, hideModal]);
  
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setDisplayMonth(prev => {
      if (direction === 'prev') {
        return prev === 0 ? 11 : prev - 1;
      } else {
        return prev === 11 ? 0 : prev + 1;
      }
    });
  }, []);
  
  const handleMonthPress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 400; // 400ms for double press detection
    
    if (now - lastPressTime < DOUBLE_PRESS_DELAY) {
      // Double press detected - navigate to current month
      const currentMonth = new Date().getMonth();
      setDisplayMonth(currentMonth);
      
      // Add haptic feedback for double press
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setLastPressTime(now);
  }, [lastPressTime]);
  
  // Effects
  useEffect(() => {
    fetchTransactions();
  }, []);
  
  useEffect(() => {
    // Scroll to current month in chart
    if (scrollViewRef.current) {
      const currentMonth = new Date().getMonth();
      const scrollPosition = Math.max(0, (currentMonth - 3) * BAR_WIDTH);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: scrollPosition, animated: true });
      }, 500);
    }
  }, [categoryData]);
  
  // Render functions
  const renderChart = () => {
    const monthlyTotals = Array(12).fill(0);
    
    filteredCategoryData.forEach(category => {
      category.data.forEach((value, monthIndex) => {
        monthlyTotals[monthIndex] += value;
      });
    });
    
    const maxValue = Math.max(...monthlyTotals, 1);
    
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <ThemedText type="subtitle">Shared Transactions</ThemedText>
          
          {(selectedCategories.length > 0 || selectedCategoryFilters.length > 0) && (
            <Pressable 
              style={({ pressed }) => [
                styles.resetButton,
                { opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={resetFilters}
            >
              <Text style={[styles.resetButtonText, { color: isDark ? '#fff' : '#000' }]}>
                Reset ({selectedCategories.length + selectedCategoryFilters.length})
              </Text>
            </Pressable>
          )}
        </View>
        
        {selectedSegment && (
          <View style={[
            styles.tooltip,
            { backgroundColor: isDark ? '#2c2c2c' : '#fff' }
          ]}>
            <View style={[styles.tooltipDot, { backgroundColor: selectedSegment.color }]} />
            <Text style={[styles.tooltipText, { color: isDark ? '#fff' : '#000' }]}>
              {selectedSegment.category}: ${selectedSegment.amount.toFixed(2)}
            </Text>
            <Pressable onPress={() => setSelectedSegment(null)}>
              <Text style={styles.tooltipClose}>×</Text>
            </Pressable>
          </View>
        )}
        
        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chartScrollContent}
        >
          {Array.from({ length: 12 }, (_, month) => {
            const segments = filteredCategoryData
              .filter(cat => cat.data[month] > 0)
              .map(cat => ({
                category: cat.category,
                value: cat.data[month],
                color: cat.color
              }));
            
            return (
              <ChartBar
                key={month}
                month={month}
                segments={segments}
                maxValue={maxValue}
                height={CHART_HEIGHT - 60}
                onSegmentPress={setSelectedSegment}
              />
            );
          })}
        </ScrollView>
        
        {/* Category Legend */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.legendContainer}
        >
          {categoryData.map(cat => (
            <Pressable
              key={cat.category}
              style={({ pressed }) => [
                styles.legendItem,
                selectedCategories.includes(cat.category) && styles.legendItemSelected,
                { opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => toggleCategoryFilter(cat.category)}
            >
              <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
              <Text style={[
                styles.legendText,
                { color: isDark ? '#fff' : '#000' },
                selectedCategories.includes(cat.category) && styles.legendTextSelected
              ]}>
                {cat.category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };
  
  const renderTransactionListHeader = () => {
    return (
      <View style={[
        styles.listContainer,
        { backgroundColor: isDark ? '#121212' : '#f5f5f5' }
      ]}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <Pressable 
            style={({ pressed }) => [
              styles.navButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={() => navigateMonth('prev')}
          >
            <Text style={[styles.navButtonText, { color: isDark ? '#fff' : '#000' }]}>
              ‹
            </Text>
          </Pressable>
          
          <View style={styles.monthDisplay}>
            <Pressable 
              style={styles.monthTextPressable}
              onPress={handleMonthPress}
            >
              {({ pressed }) => (
                <Text style={[
                  styles.monthText, 
                  { 
                    color: isDark ? '#fff' : '#000',
                    opacity: pressed ? 0.5 : 1 
                  }
                ]}>
                  {MONTH_LABELS[displayMonth]} {currentYear}
                </Text>
              )}
            </Pressable>
            
            <Pressable 
              style={styles.transactionCountPressable}
              onPress={handleMonthPress}
            >
              {({ pressed }) => (
                <Text style={[
                  styles.transactionCount, 
                  { 
                    color: isDark ? '#999' : '#666',
                    opacity: pressed ? 0.5 : 1 
                  }
                ]}>
                  {monthlyTransactions.length} transactions
                  {selectedCategoryFilters.length > 0 && (
                    <Text style={[styles.filterIndicator, { color: isDark ? '#0A84FF' : '#007AFF' }]}>
                      {' '}• {selectedCategoryFilters.join(', ')}
                    </Text>
                  )}
                </Text>
              )}
            </Pressable>
          </View>
          
          <Pressable 
            style={({ pressed }) => [
              styles.navButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={() => navigateMonth('next')}
          >
            <Text style={[styles.navButtonText, { color: isDark ? '#fff' : '#000' }]}>
              ›
            </Text>
          </Pressable>
        </View>
        
        {/* Category Summary */}
        {categoryTotals.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categorySummary}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {categoryTotals.map((cat, index) => {
              return (
                <Pressable 
                  key={cat.category}
                  style={({ pressed }) => [
                    styles.categoryCard,
                    { backgroundColor: isDark ? '#1c1c1c' : '#fff' },
                    selectedCategoryFilters.includes(cat.category) && styles.categoryCardSelected,
                    selectedCategoryFilters.includes(cat.category) && { 
                      borderColor: cat.color,
                      borderWidth: 2,
                      backgroundColor: isDark ? cat.color + '20' : cat.color + '10'
                    },
                    { opacity: pressed ? 0.7 : 1 }
                  ]}
                  onPress={() => {
                    handleCategorySummaryClick(cat.category);
                  }}
                >
              
                <View style={[styles.categoryIndicator, { backgroundColor: cat.color }]} />
                <Text style={[
                  styles.categoryName, 
                  { color: isDark ? '#fff' : '#000' },
                  selectedCategoryFilters.includes(cat.category) && { fontWeight: '700' }
                ]}>
                  {cat.category}
                </Text>
                <Text style={[styles.categoryAmount, { color: cat.color }]}>
                  ${cat.total.toFixed(0)}
                </Text>
                <Text style={[styles.categoryPercent, { color: isDark ? '#666' : '#999' }]}>
                  {cat.percentage.toFixed(0)}%
                </Text>
                </Pressable>
              );
            })}
            </ScrollView>
        )}
      </View>
    );
  };
  
  const renderTransactionModal = () => {
    if (!selectedTransaction) return null;
    
    return (
      <Modal
        visible={!!selectedTransaction}
        animationType="none"
        transparent
        onRequestClose={hideModal}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={hideModal}
        >
          <Animated.View
            style={[
              styles.modalContent,
              { 
                backgroundColor: isDark ? '#1c1c1c' : '#fff',
                transform: [{ scale: modalScale }],
                opacity: modalOpacity,
              }
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1a1a1a' }]}>
                  Edit Transaction
                </Text>
                <Pressable 
                  style={({ pressed }) => [
                    styles.modalCloseButton,
                    { 
                      backgroundColor: isDark ? '#333' : '#f5f5f5',
                      opacity: pressed ? 0.7 : 1
                    }
                  ]}
                  onPress={hideModal}
                >
                  <Text style={[styles.modalCloseIcon, { color: isDark ? '#ccc' : '#666' }]}>
                    ×
                  </Text>
                </Pressable>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Transaction fields */}
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: isDark ? '#aaa' : '#666' }]}>
                    Description
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { 
                        color: isDark ? '#fff' : '#1a1a1a',
                        backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                        borderColor: isDark ? '#444' : '#e1e5e9'
                      }
                    ]}
                    value={selectedTransaction.description}
                    onChangeText={text => 
                      setSelectedTransaction({ ...selectedTransaction, description: text })
                    }
                    placeholder="Enter description"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                  />
                </View>
                
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: isDark ? '#aaa' : '#666' }]}>
                    Amount
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { 
                        color: isDark ? '#fff' : '#1a1a1a',
                        backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                        borderColor: isDark ? '#444' : '#e1e5e9'
                      }
                    ]}
                    value={selectedTransaction.amount}
                    onChangeText={text => 
                      setSelectedTransaction({ ...selectedTransaction, amount: text })
                    }
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    keyboardType="decimal-pad"
                  />
                </View>
                
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: isDark ? '#aaa' : '#666' }]}>
                    Category
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { 
                        color: isDark ? '#fff' : '#1a1a1a',
                        backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                        borderColor: isDark ? '#444' : '#e1e5e9'
                      }
                    ]}
                    value={selectedTransaction.category}
                    onChangeText={text => 
                      setSelectedTransaction({ ...selectedTransaction, category: text })
                    }
                    placeholder="Enter category"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                  />
                </View>
                
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: isDark ? '#aaa' : '#666' }]}>
                    Label
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { 
                        color: isDark ? '#fff' : '#1a1a1a',
                        backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                        borderColor: isDark ? '#444' : '#e1e5e9'
                      }
                    ]}
                    value={selectedTransaction.label}
                    onChangeText={text => 
                      setSelectedTransaction({ ...selectedTransaction, label: text })
                    }
                    placeholder="Enter label"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                  />
                </View>
                
                {/* Category Mapping Information - Read Only */}
                <View style={[styles.modalField, styles.mappingInfoField]}>
                  <Text style={[styles.modalLabel, { color: isDark ? '#aaa' : '#666' }]}>
                    Category Mapping (Info)
                  </Text>
                  <View style={[
                    styles.mappingInfoContainer,
                    { 
                      backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
                      borderColor: isDark ? '#333' : '#ddd'
                    }
                  ]}>
                    <Text style={[styles.mappingInfoText, { color: isDark ? '#ccc' : '#555' }]}>
                      Subcategory: {selectedTransaction.bank_category || 'None'}
                    </Text>
                    <Text style={[styles.mappingArrow, { color: isDark ? '#888' : '#999' }]}>
                      ↓
                    </Text>
                    <Text style={[styles.mappingInfoText, { color: isDark ? '#ccc' : '#555' }]}>
                      Main Category: {getTransactionCategory(selectedTransaction, categoryMappings)}
                    </Text>
                    {!getCategoryFromMapping(selectedTransaction.bank_category, categoryMappings) && (
                      <Text style={[styles.mappingNoteText, { color: isDark ? '#888' : '#777' }]}>
                        No automatic mapping available
                      </Text>
                    )}
                  </View>
                </View>
                
                {/* Action buttons */}
                <View style={styles.modalActions}>
                  {/* Primary Actions Row - Split and Mark */}
                  <View style={styles.primaryActions}>
                    <Pressable 
                      style={({ pressed }) => [
                        styles.actionButton, 
                        styles.splitButton,
                        { 
                          backgroundColor: isDark ? '#5E5CE6' : '#5856D6',
                          opacity: pressed ? 0.8 : 1
                        }
                      ]}
                      onPress={() => splitTransaction(selectedTransaction)}
                    >
                      <Text style={styles.splitButtonText}>Split Transaction</Text>
                    </Pressable>
                    
                    <Pressable 
                      style={({ pressed }) => [
                        styles.actionButton, 
                        styles.markButton,
                        { 
                          backgroundColor: selectedTransaction.mark 
                            ? (isDark ? '#34C759' : '#34C759') 
                            : (isDark ? '#FF9F0A' : '#FF9500'),
                          opacity: pressed ? 0.8 : 1
                        }
                      ]}
                      onPress={() => toggleTransactionMark(selectedTransaction)}
                    >
                      <Text style={styles.markButtonText}>
                        {selectedTransaction.mark ? 'Mark as Unpaid' : 'Mark as Paid'}
                      </Text>
                    </Pressable>
                  </View>
                  
                  {/* Secondary Actions Row - Save and Delete */}
                  <View style={styles.secondaryActions}>
                    <Pressable 
                      style={({ pressed }) => [
                        styles.actionButton, 
                        styles.saveButton,
                        { 
                          backgroundColor: isDark ? '#0A84FF' : '#007AFF',
                          opacity: pressed ? 0.8 : 1
                        }
                      ]}
                      onPress={() => updateTransactionWithModal(selectedTransaction)}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                    
                    <Pressable 
                      style={({ pressed }) => [
                        styles.actionButton, 
                        styles.deleteButton,
                        { 
                          backgroundColor: isDark ? '#FF453A' : '#FF3B30',
                          opacity: pressed ? 0.8 : 1
                        }
                      ]}
                      onPress={() => deleteTransaction(selectedTransaction.id)}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#121212' : '#fff' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
          <ThemedText style={styles.loadingText}>Loading transactions...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render function for list items
  const renderListItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'date') {
      return (
        <DateHeader
          date={item.date}
          colorScheme={colorScheme || 'light'}
        />
      );
    } else {
      return (
        <TransactionItem
          transaction={item}
          onPress={() => showModal(item)}
          colorScheme={colorScheme || 'light'}
          categoryMappings={categoryMappings}
        />
      );
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#121212' : '#fff' }]}>
      <FlatList
        data={groupedTransactions}
        keyExtractor={item => item.id}
        renderItem={renderListItem}
        ListHeaderComponent={
          <View>
            {renderChart()}
            {renderTransactionListHeader()}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No transactions found</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Transactions for {MONTH_LABELS[displayMonth]} will appear here
            </ThemedText>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={isDark ? '#fff' : '#000'}
          />
        }
      />
      
      {renderTransactionModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  
  // Chart styles
  chartContainer: {
    paddingVertical: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartScrollContent: {
    paddingHorizontal: 16,
  },
  barContainer: {
    width: BAR_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: CHART_HEIGHT,
    paddingHorizontal: 8,
  },
  bar: {
    width: '80%',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  currentMonthBar: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  barSegment: {
    width: '100%',
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  currentMonthLabel: {
    fontWeight: '700',
  },
  barTotal: {
    fontSize: 10,
    marginTop: 4,
  },
  
  // Legend styles
  legendContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    maxHeight: 40,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  legendItemSelected: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderColor: '#007AFF',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  legendTextSelected: {
    fontWeight: '600',
  },
  
  // Tooltip styles
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  tooltipText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  tooltipClose: {
    fontSize: 24,
    fontWeight: '300',
    paddingLeft: 8,
  },
  
  // Transaction list styles
  listContainer: {
    flex: 1,
    marginTop: 24,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  monthTextPressable: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  monthText: {
    fontSize: 20,
    fontWeight: '600',
  },
  transactionCountPressable: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  transactionCount: {
    fontSize: 12,
    marginTop: 2,
  },
  filterIndicator: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Category summary styles
  categorySummary: {
    paddingVertical: 12,
  },
  categoryCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 80, // Ensure minimum touch target size
  },
  categoryCardSelected: {
    transform: [{ scale: 1.02 }],
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryPercent: {
    fontSize: 10,
  },
  
  // Date header styles
  dateHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  dateHeaderContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  dateHeaderSubText: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
  },
  
  // Transaction item styles
  transactionItem: {
    marginHorizontal: 16,
    marginVertical: 3,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden'
  },
  transactionRow: {
    flexDirection: 'row',
    padding: 10,
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  transactionTags: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  
  // List content at the bottom of the screen
  listContent: {
    paddingBottom: 60,
  },
  
  // Empty state
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    maxHeight: SCREEN_HEIGHT * 0.75,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  modalCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseIcon: {
    fontSize: 20,
    fontWeight: '400',
  },
  modalBody: {
    padding: 18,
  },
  modalField: {
    marginBottom: 18,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  modalInput: {
    fontSize: 15,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  modalActions: {
    marginTop: 16,
    gap: 12,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  saveButton: {
    // backgroundColor will be set inline for theme support
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    // backgroundColor will be set inline for theme support
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  splitButton: {
    // backgroundColor will be set inline for theme support
  },
  splitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  markButton: {
    // backgroundColor will be set inline for theme support
  },
  markButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    // backgroundColor and borderColor will be set inline for theme support
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Category mapping info styles
  mappingInfoField: {
    marginBottom: 18,
  },
  mappingInfoContainer: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  mappingInfoText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 2,
  },
  mappingArrow: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 4,
  },
  mappingNoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
});