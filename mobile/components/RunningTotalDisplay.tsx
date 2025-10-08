import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

interface Transaction {
  id: string;
  amount: string;
  [key: string]: any;
}

interface User {
  id: number;
  username: string;
  display_name: string;
  is_active: boolean;
}

interface SplitAllocation {
  id: number;
  split_id: number;
  user_id: number;
  amount: string;
  percentage: string | null;
  created_at: string;
  updated_at: string;
  username: string;
  display_name: string;
  split_type_code: string;
  split_type_label: string;
}

interface RunningTotalDisplayProps {
  transactions: Transaction[];
  users: User[];
  splitAllocations: Record<string, SplitAllocation[]>;
  isDark: boolean;
  selectedUsers?: string[];
}

export const RunningTotalDisplay: React.FC<RunningTotalDisplayProps> = ({
  transactions,
  users,
  splitAllocations,
  isDark,
  selectedUsers = [],
}) => {
  const totals = useMemo(() => {
    const userTotals: Record<string, number> = {};
    
    if (!users || !Array.isArray(users) || users.length === 0) {
      return userTotals;
    }

    const activeUsers = users.filter(user => user.username !== 'default' && user.is_active);
    
    // Initialize totals for all active users
    activeUsers.forEach(user => {
      userTotals[user.display_name] = 0;
    });

    // Calculate totals from split allocations
    transactions.forEach(transaction => {
      const allocations = splitAllocations[transaction.id];
      if (!allocations || allocations.length === 0) return;

      const transactionAmount = Math.abs(parseFloat(transaction.amount) || 0);
      
      allocations.forEach(allocation => {
        const user = users.find(u => u.id === allocation.user_id);
        if (user && user.display_name in userTotals) {
          const allocationAmount = parseFloat(allocation.amount) || 0;
          userTotals[user.display_name] += Math.abs(allocationAmount);
        }
      });
    });

    return userTotals;
  }, [transactions, users, splitAllocations]);

  const totalSpend = useMemo(() => {
    return Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  }, [totals]);

  const theme = useMemo(() => ({
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    text: isDark ? '#ffffff' : '#000000',
    secondaryText: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    positiveColor: '#10b981',
    negativeColor: '#ef4444',
    cardBg: isDark ? '#1c1c1e' : '#ffffff',
  }), [isDark]);

  const activeUsers = useMemo(() => 
    users.filter(user => user.username !== 'default' && user.is_active),
    [users]
  );
  
  // Determine which users to display
  const usersToDisplay = useMemo(() => 
    selectedUsers.length > 0 && !selectedUsers.includes('Both')
      ? activeUsers.filter(user => selectedUsers.includes(user.display_name))
      : activeUsers,
    [activeUsers, selectedUsers]
  );
  
  if (usersToDisplay.length === 0 || Object.keys(totals).length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>Running Total</Text>
      
      <View style={styles.totalsContainer}>
        {usersToDisplay.map(user => {
          const amount = totals[user.display_name] || 0;
          return (
            <View key={user.id} style={styles.userTotal}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {user.display_name}
              </Text>
              <Text
                style={[
                  styles.userAmount,
                  { color: amount >= 0 ? theme.positiveColor : theme.negativeColor }
                ]}
              >
                ${amount.toFixed(2)}
              </Text>
            </View>
          );
        })}
        
        {usersToDisplay.length >= 2 && (
          <View style={[styles.totalSpend, { borderTopColor: theme.border }]}>
            <Text style={[styles.totalSpendLabel, { color: theme.text }]}>
              Total Spend
            </Text>
            <Text
              style={[
                styles.totalSpendAmount,
                { color: totalSpend >= 0 ? theme.positiveColor : theme.negativeColor }
              ]}
            >
              ${totalSpend.toFixed(2)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  totalsContainer: {
    gap: 8,
  },
  userTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
  },
  userAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalSpend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  totalSpendLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalSpendAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
});
