"""
Base Bank Feed Module for PocketSmith API Integration

This module provides a base class and configuration-driven approach for fetching
and storing transactions from PocketSmith API to PostgreSQL database.
"""

import requests
from datetime import datetime, timedelta
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import cursor as psycopg2_cursor
import os
from dotenv import load_dotenv
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Tuple

class BaseBankFeed(ABC):
    """
    Abstract base class for bank feed implementations.
    Provides common functionality for fetching and storing transactions.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the bank feed with configuration.
        
        Args:
            config: Configuration dictionary containing account details and settings
        """
        # Load environment variables
        load_dotenv()
        
        # Common configuration
        self.api_key = os.getenv('POCKETSMITH_API_KEY')
        self.days_to_fetch = int(os.getenv('DAYS_TO_FETCH', 30))
        
        # Database config
        self.db_config = {
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
            'host': os.getenv('DB_HOST'),
            'database': os.getenv('DB_NAME'),
            'port': os.getenv('DB_PORT')
        }
        
        # Account-specific configuration
        self.account_id = config['account_id']
        self.account_name = config['account_name']
        self.table_name = config['table_name']
        self.transaction_fields = config['transaction_fields']
        self.additional_processing = config.get('additional_processing', False)
        
        # Fields that should always be updated from API
        self.api_update_fields = config.get('api_update_fields', ['date', 'description'])
        
        # Fields that should be preserved from database
        self.preserve_fields = config.get('preserve_fields', [])
    
    def fetch_transactions(self, start_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch transactions from PocketSmith API with pagination.
        
        Args:
            start_date: Start date for fetching transactions (YYYY-MM-DD format)
            
        Returns:
            List of transaction dictionaries
        """
        page = 1
        all_transactions = []
        
        while True:
            url = f"https://api.pocketsmith.com/v2/accounts/{self.account_id}/transactions"
            params = {
                'page': page,
                'start_date': start_date,
                'end_date': datetime.now().isoformat()
            }
            
            headers = {
                "accept": "application/json", 
                "X-Developer-Key": self.api_key
            }
            
            print(f"Fetching {self.account_name} transactions from PocketSmith API - Page {page}...")
            
            try:
                response = requests.get(url, headers=headers, params=params)
                
                if response.status_code == 200:
                    transactions = response.json()
                    
                    if not transactions:  # No more transactions (empty page)
                        print(f"✅ Reached end of transactions at page {page}")
                        break
                    
                    # Process each transaction using the specific implementation
                    for tx in transactions:
                        processed_tx = self.process_transaction(tx)
                        if processed_tx:
                            all_transactions.append(processed_tx)
                    
                    page += 1
                elif response.status_code == 404 and page > 1:
                    # This is likely just the end of pagination
                    print(f"✅ Reached end of transactions at page {page}")
                    break
                else:
                    # This is an actual error
                    print(f"⚠️  API request failed with status {response.status_code}: {response.text}")
                    break
                
            except requests.RequestException as e:
                print(f"❌ Error fetching transactions: {e}")
                break
        
        return all_transactions
    
    @abstractmethod
    def process_transaction(self, transaction: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process a single transaction from the API response.
        Must be implemented by subclasses to handle account-specific processing.
        
        Args:
            transaction: Raw transaction data from API
            
        Returns:
            Processed transaction dictionary or None to skip
        """
        pass
    
    def get_existing_transactions(self, transaction_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetch existing transaction data from database.
        
        Args:
            transaction_ids: List of transaction IDs to fetch
            
        Returns:
            Dictionary mapping transaction ID to existing data
        """
        existing_data = {}
        
        try:
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor() as cursor:
                    # Build dynamic query based on transaction fields
                    field_names = ', '.join(self.transaction_fields.keys())
                    query = f"SELECT {field_names} FROM {self.table_name} WHERE id = ANY(%s)"
                    
                    cursor.execute(query, (transaction_ids,))
                    
                    for row in cursor.fetchall():
                        # Map row data to field names
                        row_data = dict(zip(self.transaction_fields.keys(), row))
                        existing_data[row_data['id']] = row_data
                        
        except Exception as e:
            print(f"Error fetching existing transactions: {e}")
        
        return existing_data
    
    def build_upsert_query(self) -> Tuple[str, List[str]]:
        """
        Build dynamic upsert query based on transaction fields configuration.
        
        Returns:
            Tuple of (SQL query string, list of field names for parameter binding)
        """
        field_names = list(self.transaction_fields.keys())
        placeholders = ', '.join(['%s'] * len(field_names))
        
        # Build INSERT clause
        insert_fields = ', '.join(field_names)
        
        # Build UPDATE SET clause for conflict resolution
        update_clauses = []
        
        # Always update these fields from API
        for field in self.api_update_fields:
            if field in field_names:
                update_clauses.append(f"{field} = EXCLUDED.{field}")
        
        # Preserve existing values for other fields
        for field in field_names:
            if field not in self.api_update_fields:
                if field in self.preserve_fields:
                    update_clauses.append(f"{field} = COALESCE({self.table_name}.{field}, EXCLUDED.{field})")
        
        update_set = ', '.join(update_clauses)
        
        # Build WHERE clause for conditional updates
        where_conditions = []
        for field in self.api_update_fields:
            if field in field_names:
                if field == 'closing_balance':
                    where_conditions.append(f"{self.table_name}.{field} IS DISTINCT FROM EXCLUDED.{field}")
                else:
                    where_conditions.append(f"{self.table_name}.{field} != EXCLUDED.{field}")
        
        where_clause = ' OR '.join(where_conditions) if where_conditions else 'TRUE'
        
        query = f"""
            INSERT INTO {self.table_name} ({insert_fields})
            VALUES ({placeholders})
            ON CONFLICT (id) DO UPDATE SET
                {update_set}
            WHERE {where_clause}
        """
        
        return query, field_names
    
    def insert_transactions(self, transactions: List[Dict[str, Any]]) -> None:
        """
        Insert or update transactions in the database.
        
        Args:
            transactions: List of processed transactions to insert/update
        """
        try:
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor() as cursor:
                    query, field_names = self.build_upsert_query()
                    
                    for tx in transactions:
                        # Prepare values in the correct order
                        values = []
                        for field_name in field_names:
                            if field_name in tx:
                                values.append(tx[field_name])
                            else:
                                # Use default value from configuration
                                default_value = self.transaction_fields[field_name].get('default', None)
                                values.append(default_value)
                        
                        cursor.execute(query, values)
                    
                    conn.commit()
                    
                    # Generate statistics
                    self.print_statistics(cursor, [tx['id'] for tx in transactions])
                    
        except Exception as e:
            print(f"❌ Error inserting/updating transactions: {e}")
            raise
    
    def print_statistics(self, cursor: psycopg2_cursor, transaction_ids: List[str]) -> None:
        """
        Print processing statistics for the transactions.
        
        Args:
            cursor: Database cursor
            transaction_ids: List of processed transaction IDs
        """
        # Build dynamic statistics query
        stat_queries = []
        
        if 'category' in self.transaction_fields:
            stat_queries.append("COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as categorized")
        
        if 'label' in self.transaction_fields:
            stat_queries.append("COUNT(CASE WHEN label IS NOT NULL THEN 1 END) as labeled")
        
        if 'bank_category' in self.transaction_fields:
            stat_queries.append("COUNT(CASE WHEN bank_category IS NOT NULL THEN 1 END) as bank_categorized")
        
        if 'has_split' in self.transaction_fields:
            stat_queries.append("COUNT(CASE WHEN has_split = TRUE THEN 1 END) as split")
        
        stat_queries.append("COUNT(*) as total")
        
        stats_query = f"""
            SELECT {', '.join(stat_queries)}
            FROM {self.table_name}
            WHERE id = ANY(%s)
        """
        
        cursor.execute(stats_query, (transaction_ids,))
        stats = cursor.fetchone()
        
        print(f"✅ Successfully processed {len(transaction_ids)} {self.account_name} transactions:")
        
        # Print relevant statistics
        i = 0
        if 'category' in self.transaction_fields:
            print(f"   - {stats[i]} categorized")
            i += 1
        if 'label' in self.transaction_fields:
            print(f"   - {stats[i]} labeled")
            i += 1
        if 'bank_category' in self.transaction_fields:
            print(f"   - {stats[i]} bank categorized")
            i += 1
        if 'has_split' in self.transaction_fields:
            print(f"   - {stats[i]} split transactions")
            i += 1
        print(f"   - {stats[i]} total in database")
    
    def run(self) -> None:
        """
        Main execution method to fetch, process and store transactions.
        """
        start_date = (datetime.now() - timedelta(days=self.days_to_fetch)).strftime('%Y-%m-%d')
        end_date = datetime.now().strftime('%Y-%m-%d')
        
        print(f"📅 Fetching {self.account_name} transactions from {start_date} to {end_date} (spans {self.days_to_fetch} days)")
        
        # Fetch transactions from API
        transactions = self.fetch_transactions(start_date)
        print(f"📥 Fetched {len(transactions)} transactions from PocketSmith API")
        
        if not transactions:
            print("ℹ️  No transactions found for the specified date range.")
            return
        
        # Perform additional processing if specified
        if self.additional_processing:
            transactions = self.additional_transaction_processing(transactions)
        
        # Insert/update transactions in database
        self.insert_transactions(transactions)
    
    def additional_transaction_processing(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Override this method for account-specific additional processing.
        
        Args:
            transactions: List of transactions to process
            
        Returns:
            List of processed transactions
        """
        return transactions


class BankFeedFactory:
    """
    Factory class for creating bank feed instances based on configuration.
    """
    
    @staticmethod
    def create_bank_feed(config: Dict[str, Any], feed_class) -> BaseBankFeed:
        """
        Create a bank feed instance with the specified configuration.
        
        Args:
            config: Configuration dictionary
            feed_class: Bank feed class to instantiate
            
        Returns:
            Configured bank feed instance
        """
        return feed_class(config)


# Configuration templates for different account types
ACCOUNT_CONFIGS = {
    'shared': {
        'account_name': 'shared',
        'table_name': 'shared_transactions',
        'transaction_fields': {
            'id': {'type': 'text', 'primary_key': True},
            'date': {'type': 'date'},
            'description': {'type': 'text'},
            'amount': {'type': 'numeric'},
            'bank_category': {'type': 'text', 'nullable': True},
            'label': {'type': 'text', 'nullable': True},
            'has_split': {'type': 'boolean', 'default': False},
            'split_from_id': {'type': 'text', 'nullable': True, 'default': None}
        },
        'api_update_fields': ['date', 'description'],
        'preserve_fields': ['amount', 'bank_category', 'label', 'has_split', 'split_from_id'],
        'additional_processing': True
    },
    
    'personal': {
        'account_name': 'personal',
        'table_name': 'personal_transactions',
        'transaction_fields': {
            'id': {'type': 'text', 'primary_key': True},
            'date': {'type': 'date'},
            'description': {'type': 'text'},
            'amount': {'type': 'numeric'},
            'category': {'type': 'text', 'nullable': True, 'default': None},
            'closing_balance': {'type': 'numeric', 'nullable': True},
            'has_split': {'type': 'boolean', 'default': False},
            'split_from_id': {'type': 'text', 'nullable': True, 'default': None}
        },
        'api_update_fields': ['date', 'description', 'closing_balance'],
        'preserve_fields': ['amount', 'category', 'has_split', 'split_from_id'],
        'additional_processing': False
    },
    
    'offset': {
        'account_name': 'offset',
        'table_name': 'offset_transactions',
        'transaction_fields': {
            'id': {'type': 'text', 'primary_key': True},
            'date': {'type': 'date'},
            'description': {'type': 'text'},
            'amount': {'type': 'numeric'},
            'category': {'type': 'text', 'nullable': True, 'default': None},
            'label': {'type': 'text', 'nullable': True, 'default': None},
            'closing_balance': {'type': 'numeric', 'nullable': True},
            'has_split': {'type': 'boolean', 'default': False},
            'split_from_id': {'type': 'text', 'nullable': True, 'default': None}
        },
        'api_update_fields': ['date', 'description', 'closing_balance'],
        'preserve_fields': ['amount', 'category', 'label', 'has_split', 'split_from_id'],
        'additional_processing': False
    }
}
