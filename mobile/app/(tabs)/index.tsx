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
  Alert,
  Pressable,
  FlatList,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';

// Lucide React Native icons
import { 
  Receipt, 
  Gamepad2, 
  UtensilsCrossed, 
  Gift, 
  Plane, 
  Home as HomeIcon, 
  Heart, 
  House, 
  ShoppingBag, 
  PiggyBank, 
  MapPin, 
  Car,
  HelpCircle,
  Edit3,
  X,
  Trash2,
  Split,
  Bookmark,
  User
} from 'lucide-react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';

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

// Category to icon mapping using Lucide React Native
const CATEGORY_ICONS = {
  'Bills': Receipt,
  'Entertainment': Gamepad2,
  'Food': UtensilsCrossed,
  'Gifts': Gift,
  'Holidays': Plane,
  'Home': HomeIcon,
  'Medical': Heart,
  'Mortgage': House,
  'Other': HelpCircle,
  'Personal Items': ShoppingBag,
  'Savings': PiggyBank,
  'Travel': MapPin,
  'Vehicle': Car,
};

// Month labels
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Helper function to format date to "17th July, 2025" style
const formatDateWithOrdinal = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  
  // Add ordinal suffix
  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  return `${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
};

// Helper function to format date in "17th July, 2025" format (for display)
const formatDateDisplay = (dateString: string): string => {
  if (!dateString) return 'Unknown Date';
  
  const date = new Date(dateString);
  
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  
  // Add ordinal suffix to day
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  return `${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
};

// Helper function to get category icon
const getCategoryIcon = (category: string) => {
  return CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || HelpCircle;
};

// Helper function to get bottom sheet theme
const getBottomSheetTheme = (isDark: boolean) => ({
  backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
  handleColor: isDark ? '#48484a' : '#c6c6c8',
  textColor: isDark ? '#ffffff' : '#000000',
  subtitleColor: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  cardBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
  buttonBg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
});

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
  onPress: (event: any) => void;
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
  
  // Enhanced bottom sheet state
  const [isEditing, setIsEditing] = useState(false);
  const [editedTransaction, setEditedTransaction] = useState<Transaction | null>(null);
  
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
  
  // Bottom sheet ref
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

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
  
  // Bottom sheet functions
  const handleTransactionPress = useCallback((transaction: Transaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTransaction(transaction);
    setTimeout(() => {
      bottomSheetModalRef.current?.present();
    }, 0);
  }, []);
  
  const hideBottomSheet = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    setSelectedTransaction(null);
    setIsEditing(false);
    setEditedTransaction(null);
  }, []);

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
              hideBottomSheet();
              Alert.alert('Success', 'Transaction deleted successfully');
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction. Please try again.');
            }
          }
        }
      ]
    );
  }, [fetchTransactions, hideBottomSheet]);
  
  // Bottom sheet helper components
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );
  
  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: isDark ? '#aaa' : '#666' }]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: isDark ? '#fff' : '#000' }]}>
        {value || 'N/A'}
      </Text>
    </View>
  );
  

  
  const handleEditTransaction = useCallback(() => {
    setIsEditing(!isEditing);
    if (!isEditing && selectedTransaction) {
      setEditedTransaction({ ...selectedTransaction });
    }
  }, [isEditing, selectedTransaction]);
  
  const splitTransaction = useCallback(async (transaction: Transaction) => {
    hideBottomSheet();
    // TODO: Implement split transaction functionality
    Alert.alert('Split Transaction', 'Split transaction functionality coming soon!');
  }, [hideBottomSheet]);
  
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
      hideBottomSheet();
      Alert.alert('Success', `Transaction marked as ${updatedTransaction.mark ? 'paid' : 'unpaid'}`);
    } catch (error) {
      console.error('Error updating transaction mark:', error);
      Alert.alert('Error', 'Failed to update transaction. Please try again.');
    }
  }, [fetchTransactions, hideBottomSheet]);
  
  const updateTransactionWithDropdown = useCallback(async (transaction: Transaction) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction),
      });
      
      if (!response.ok) throw new Error('Failed to update transaction');
      
      await fetchTransactions();
      hideBottomSheet();
      Alert.alert('Success', 'Transaction updated successfully');
    } catch (error) {
      console.error('Error updating transaction:', error);
      Alert.alert('Error', 'Failed to update transaction. Please try again.');
    }
  }, [fetchTransactions, hideBottomSheet]);

  const saveTransactionChanges = useCallback(async () => {
    if (!editedTransaction) return;
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/transactions/${editedTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedTransaction),
      });
      
      if (!response.ok) throw new Error('Failed to update transaction');
      
      await fetchTransactions();
      setIsEditing(false);
      setEditedTransaction(null);
      Alert.alert('Success', 'Transaction updated successfully');
    } catch (error) {
      console.error('Error updating transaction:', error);
      Alert.alert('Error', 'Failed to update transaction. Please try again.');
    }
  }, [editedTransaction, fetchTransactions]);
  
  // Handler functions for bottom sheet actions
  const handleSplitTransaction = useCallback(() => {
    if (selectedTransaction) {
      splitTransaction(selectedTransaction);
    }
  }, [selectedTransaction, splitTransaction]);
  
  const handleMarkAsPaid = useCallback(() => {
    if (selectedTransaction) {
      toggleTransactionMark(selectedTransaction);
    }
  }, [selectedTransaction, toggleTransactionMark]);
  
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
          onPress={() => handleTransactionPress(item)}
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
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={['40%', '85%']} // Reduced from 60% to 40% for thumb-reachable default size
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.5}
            pressBehavior="close"
          />
        )}
        backgroundStyle={{
          backgroundColor: getBottomSheetTheme(isDark).backgroundColor,
        }}
        handleIndicatorStyle={{
          backgroundColor: getBottomSheetTheme(isDark).handleColor,
          width: 36,
          height: 5,
        }}
        enablePanDownToClose
        enableDynamicSizing={false}
        onDismiss={hideBottomSheet}
      >
        <BottomSheetScrollView 
          style={styles.bottomSheetContent}
          contentContainerStyle={styles.bottomSheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <Text style={[
              styles.bottomSheetTitle,
              { color: getBottomSheetTheme(isDark).textColor }
            ]}>
              Transaction Details
            </Text>
            <Pressable
              style={[styles.editButton, { backgroundColor: getBottomSheetTheme(isDark).buttonBg }]}
              onPress={handleEditTransaction}
            >
              {isEditing ? (
                <X size={16} color={getBottomSheetTheme(isDark).textColor} />
              ) : (
                <Edit3 size={16} color={getBottomSheetTheme(isDark).textColor} />
              )}
            </Pressable>
          </View>

          {selectedTransaction && (
            <View style={styles.transactionDetailsContainer}>
              {/* Transaction Card */}
              <View style={[
                styles.transactionCard,
                {
                  backgroundColor: getBottomSheetTheme(isDark).cardBg,
                  borderWidth: 1,
                  borderColor: getBottomSheetTheme(isDark).borderColor,
                }
              ]}>
                <View style={styles.transactionRow}>
                  <View style={[
                    styles.categoryIconContainer,
                    { 
                      backgroundColor: isDark 
                        ? 'rgba(99,102,241,0.15)' 
                        : 'rgba(99,102,241,0.1)' 
                    }
                  ]}>
                    {(() => {
                      const CategoryIcon = getCategoryIcon(
                        getTransactionCategory(selectedTransaction, categoryMappings)
                      );
                      return (
                        <CategoryIcon 
                          size={20} 
                          color={isDark ? '#a78bfa' : '#6366f1'} 
                        />
                      );
                    })()}
                  </View>
                  
                  <View style={styles.transactionInfo}>
                    {isEditing ? (
                      <TextInput
                        style={[
                          styles.editableDescription,
                          {
                            color: getBottomSheetTheme(isDark).textColor,
                            backgroundColor: getBottomSheetTheme(isDark).buttonBg,
                            borderColor: getBottomSheetTheme(isDark).borderColor,
                          }
                        ]}
                        value={editedTransaction?.description || ''}
                        onChangeText={(text) => 
                          setEditedTransaction(prev => prev ? { ...prev, description: text } : null)
                        }
                        placeholder="Transaction description"
                        placeholderTextColor={getBottomSheetTheme(isDark).subtitleColor}
                        multiline
                      />
                    ) : (
                      <Text style={[styles.merchantName, { color: getBottomSheetTheme(isDark).textColor }]}>
                        {selectedTransaction.description}
                      </Text>
                    )}
                    
                    <View style={styles.transactionMeta}>
                      <Text style={[
                        styles.categoryName,
                        { color: getBottomSheetTheme(isDark).subtitleColor }
                      ]}>
                        {getTransactionCategory(selectedTransaction, categoryMappings)}
                      </Text>
                      {selectedTransaction.label && (
                        <>
                          <Text style={[
                            styles.metaSeparator,
                            { color: getBottomSheetTheme(isDark).subtitleColor }
                          ]}>
                            •
                          </Text>
                          <Text style={[
                            styles.userLabel,
                            { color: getBottomSheetTheme(isDark).subtitleColor }
                          ]}>
                            {selectedTransaction.label}
                          </Text>
                        </>
                      )}
                    </View>
                    
                    <Text style={[
                      styles.transactionDate,
                      { color: getBottomSheetTheme(isDark).subtitleColor }
                    ]}>
                      {formatDateDisplay(selectedTransaction.date)}
                    </Text>
                  </View>
                </View>

                <Text style={[
                  styles.amountDisplay,
                  { 
                    color: selectedTransaction.amount.startsWith('-') 
                      ? '#ef4444' 
                      : '#10b981',
                  }
                ]}>
                  {selectedTransaction.amount}
                </Text>
              </View>

              {/* Edit Fields - Only shown when editing */}
              {isEditing && (
                <View style={styles.editSection}>
                  <View style={styles.editField}>
                    <Text style={[styles.fieldLabel, { color: getBottomSheetTheme(isDark).subtitleColor }]}>
                      CATEGORY
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          color: getBottomSheetTheme(isDark).textColor,
                          backgroundColor: getBottomSheetTheme(isDark).buttonBg,
                          borderColor: getBottomSheetTheme(isDark).borderColor,
                        }
                      ]}
                      value={editedTransaction?.category || ''}
                      onChangeText={(text) => 
                        setEditedTransaction(prev => prev ? { ...prev, category: text } : null)
                      }
                      placeholder="Enter category"
                      placeholderTextColor={getBottomSheetTheme(isDark).subtitleColor}
                    />
                  </View>

                  <View style={styles.editField}>
                    <Text style={[styles.fieldLabel, { color: getBottomSheetTheme(isDark).subtitleColor }]}>
                      LABEL
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          color: getBottomSheetTheme(isDark).textColor,
                          backgroundColor: getBottomSheetTheme(isDark).buttonBg,
                          borderColor: getBottomSheetTheme(isDark).borderColor,
                        }
                      ]}
                      value={editedTransaction?.label || ''}
                      onChangeText={(text) => 
                        setEditedTransaction(prev => prev ? { ...prev, label: text } : null)
                      }
                      placeholder="Enter label"
                      placeholderTextColor={getBottomSheetTheme(isDark).subtitleColor}
                    />
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {isEditing ? (
                  <Pressable
                    style={[styles.actionButton, styles.saveButton]}
                    onPress={saveTransactionChanges}
                  >
                    <Text style={styles.actionButtonText}>Save Changes</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable 
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => selectedTransaction && deleteTransaction(selectedTransaction.id)}
                    >
                      <Trash2 size={14} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </Pressable>
                    
                    <Pressable style={[styles.actionButton, styles.splitButton]}>
                      <Split size={14} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Split</Text>
                    </Pressable>
                    
                    <Pressable style={[
                      styles.actionButton, 
                      selectedTransaction.mark ? styles.unmarkButton : styles.markButton
                    ]}>
                      <Bookmark size={14} color="#ffffff" />
                      <Text style={styles.actionButtonText}>
                        {selectedTransaction.mark ? 'Unmark' : 'Mark'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
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
  
  // Dropdown styles
  dropdownContainer: {
    position: 'absolute',
    zIndex: 1000,
  },
  dropdownContent: {
    maxWidth: 380,
    maxHeight: SCREEN_HEIGHT * 0.6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dropdownCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownCloseIcon: {
    fontSize: 20,
    fontWeight: '400',
  },
  dropdownBody: {
    padding: 18,
  },
  dropdownField: {
    marginBottom: 18,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  dropdownInput: {
    fontSize: 15,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  dropdownActions: {
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
  
  // Enhanced Bottom Sheet Styles
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 30,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 12,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Transaction Details Container
  transactionDetailsContainer: {
    flex: 1,
  },
  transactionCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },
  transactionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  },
  editableDescription: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    textAlignVertical: 'top',
    minHeight: 38,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaSeparator: {
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 6,
  },
  userLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 11,
    fontWeight: '400',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  userText: {
    fontSize: 11,
    fontWeight: '400',
  },
  amountDisplay: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  
  // Edit Fields
  editSection: {
    marginBottom: 16,
  },
  editField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontSize: 14,
    fontWeight: '400',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 40,
  },
  
  // Action Buttons
  actionsContainer: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  splitButton: {
    backgroundColor: '#f59e0b',
  },
  markButton: {
    backgroundColor: '#6366f1',
  },
  unmarkButton: {
    backgroundColor: '#10b981',
  },
  
  // Legacy bottom sheet styles (keeping for compatibility)
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 13,
    marginBottom: 4,
    opacity: 0.6,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  bottomSheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  bottomSheetActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  bottomSheetSecondaryButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  bottomSheetPrimaryButton: {
    backgroundColor: '#007AFF',
  },
  bottomSheetActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },


});