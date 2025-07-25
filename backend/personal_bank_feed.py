"""
Personal Bank Feed Implementation

This module implements the bank feed for personal debit account transactions. In other words, it is used to fetch transactions from PocketSmith API and store them in the database upon clicking the "Refresh Bank Feeds" button.
Inherits from BaseBankFeed with minimal customization needed.
"""

import os
from typing import Dict, Optional, Any
from base_bank_feed import BaseBankFeed, BankFeedFactory, ACCOUNT_CONFIGS
from logging_config import get_logger

# Get logger using the new logging system
logger = get_logger(__name__)


class PersonalBankFeed(BaseBankFeed):
    """
    Bank feed implementation for personal debit account transactions.
    Simple implementation that extracts basic transaction data including closing balance.
    """
    
    def process_transaction(self, transaction: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process a single personal transaction from the API.
        
        Args:
            transaction: Raw transaction data from API
            
        Returns:
            Processed transaction dictionary
        """
        return {
            'id': transaction['id'],
            'date': transaction['date'],
            'description': transaction['payee'],
            'amount': transaction['amount'],
            'closing_balance': transaction.get('closing_balance', None),
            'category': None,  # Will be manually populated later
            'has_split': False,  # Default value
            'split_from_id': None  # Default value
        }


def main():
    """
    Main function to run the personal bank feed.
    """
    # Get configuration and add account-specific settings
    config = ACCOUNT_CONFIGS['personal'].copy()
    config['account_id'] = os.getenv('DEBIT_ID')
    
    if not config['account_id']:
        logger.error("❌ Error: DEBIT_ID environment variable not set")
        return
    
    # Create and run the bank feed
    bank_feed = BankFeedFactory.create_bank_feed(config, PersonalBankFeed)
    bank_feed.run()


if __name__ == "__main__":
    main()
