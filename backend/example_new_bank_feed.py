"""
Example: Creating a New Bank Feed

This example demonstrates how to create a new bank feed for a savings account
using the abstracted base framework. Very minimal code required!
"""

import os
from typing import Dict, Optional, Any
from base_bank_feed import BaseBankFeed, BankFeedFactory
from logging_config import get_logger

# Get logger using the new logging system
logger = get_logger(__name__)


class SavingsBankFeed(BaseBankFeed):
    """
    Bank feed implementation for savings account transactions.
    Demonstrates how easy it is to create a new bank feed.
    """
    
    def process_transaction(self, transaction: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process a single savings transaction from the API.
        Only need to define how to transform the API response to your desired format.
        """
        # Extract interest rate if available (custom field example)
        interest_rate = None
        if 'memo' in transaction and 'interest' in transaction['memo'].lower():
            # Custom logic to extract interest rate from memo
            # This is just an example - implement your own logic
            try:
                words = transaction['memo'].split()
                for i, word in enumerate(words):
                    if 'rate' in word.lower() and i + 1 < len(words):
                        interest_rate = float(words[i + 1].replace('%', ''))
                        break
            except (ValueError, IndexError):
                pass
        
        return {
            'id': transaction['id'],
            'date': transaction['date'],
            'description': transaction['payee'],
            'amount': transaction['amount'],
            'closing_balance': transaction.get('closing_balance', None),
            'transaction_type': self.categorize_savings_transaction(transaction),
            'interest_rate': interest_rate,
            'has_split': False,
            'split_from_id': None
        }
    
    def categorize_savings_transaction(self, transaction: Dict[str, Any]) -> str:
        """
        Custom categorization logic for savings transactions.
        """
        description = transaction.get('payee', '').lower()
        amount = transaction.get('amount', 0)
        
        if amount > 0:
            if 'interest' in description:
                return 'Interest Credit'
            elif 'transfer' in description:
                return 'Transfer In'
            else:
                return 'Deposit'
        else:
            if 'fee' in description:
                return 'Bank Fee'
            elif 'transfer' in description:
                return 'Transfer Out'
            else:
                return 'Withdrawal'


# Configuration for the new savings account
SAVINGS_CONFIG = {
    'account_name': 'savings',
    'table_name': 'savings_transactions',
    'transaction_fields': {
        'id': {'type': 'text', 'primary_key': True},
        'date': {'type': 'date'},
        'description': {'type': 'text'},
        'amount': {'type': 'numeric'},
        'closing_balance': {'type': 'numeric', 'nullable': True},
        'transaction_type': {'type': 'text', 'nullable': True},
        'interest_rate': {'type': 'numeric', 'nullable': True},
        'has_split': {'type': 'boolean', 'default': False},
        'split_from_id': {'type': 'text', 'nullable': True, 'default': None}
    },
    'api_update_fields': ['date', 'description', 'closing_balance'],
    'preserve_fields': ['amount', 'transaction_type', 'interest_rate', 'has_split', 'split_from_id'],
    'additional_processing': False
}


def main():
    """
    Main function to run the savings bank feed.
    """
    # Add account-specific settings
    config = SAVINGS_CONFIG.copy()
    config['account_id'] = os.getenv('SAVINGS_ACCOUNT_ID')
    
    if not config['account_id']:
        logger.error("❌ Error: SAVINGS_ACCOUNT_ID environment variable not set")
        return
    
    # Create and run the bank feed - that's it!
    bank_feed = BankFeedFactory.create_bank_feed(config, SavingsBankFeed)
    bank_feed.run()


if __name__ == "__main__":
    main()
