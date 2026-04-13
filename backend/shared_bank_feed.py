"""
Shared Bank Feed Implementation

This module implements the bank feed for shared credit card transactions. In other words, it is used to fetch transactions from PocketSmith API and store them in the database upon clicking the "Refresh Bank Feeds" button.
Inherits from BaseBankFeed and adds specific categorization and labeling logic.
"""

import os
from typing import Dict, List, Optional, Any
from base_bank_feed import BaseBankFeed, BankFeedFactory, ACCOUNT_CONFIGS
from logging_config import get_logger

# Get logger using the new logging system
logger = get_logger(__name__)


class SharedBankFeed(BaseBankFeed):
    """
    Bank feed implementation for shared credit card transactions.
    Includes automatic categorization and labeling based on transaction categories.
    """
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        
        # Shared-specific configuration
        self.people = os.getenv('PEOPLE', '').split(',')
    
    def process_transaction(self, transaction: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process a single shared transaction from the API.
        
        Args:
            transaction: Raw transaction data from API
            
        Returns:
            Processed transaction dictionary
        """
        # Extract category information
        if transaction.get('category') and 'title' in transaction['category']:
            category_title = transaction['category']['title']
        else:
            category_title = ""
        
        return {
            'id': transaction['id'],
            'date': transaction['date'],
            'description': transaction['payee'],
            'bank_category': category_title,
            'amount': transaction['amount'],
            'mark': False  # Default value for new transactions
        }
    
    def auto_label_bank_category(self, bank_category: str) -> Optional[str]:
        """
        Automatically label transactions based on bank category.
        
        DISABLED: Auto labeling system has been disabled in favor of manual 
        split configuration through the UI using the new split config system.
        
        Args:
            bank_category: The bank category from the transaction
            
        Returns:
            None (auto labeling disabled)
        """
        # Auto labeling system disabled - users will manually assign labels/splits through UI
        return None
        
        # Legacy auto labeling logic (disabled):
        # no_label_categories = ["Dining", "Transfers"]
        # first_person_categories = [
        #     "Personal Items", "Personal Care", "Hobbies", 
        #     "Entertainment/Recreation", "Vehicle", "Gym", "Fuel"
        # ]
        # 
        # if not bank_category or bank_category in no_label_categories:
        #     return None
        # elif bank_category in first_person_categories:
        #     return self.people[0] if self.people else None
        # else:
        #     return "Both"
    
    def categorize_and_label_transactions(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Categorize and label transactions based on existing data and API information.
        
        Args:
            transactions: List of transactions to categorize
            
        Returns:
            List of categorized and labeled transactions
        """
        # Get existing transaction data
        transaction_ids = [tx['id'] for tx in transactions]
        existing_data = self.get_existing_transactions(transaction_ids)
        
        categorized_transactions = []
        
        for tx in transactions:
            description = tx['description']
            amount = tx['amount']
            date = tx['date']
            api_bank_category = tx['bank_category']  # This is from the API
            
            # Check if this transaction already exists
            if tx['id'] in existing_data:
                existing = existing_data[tx['id']]
                # Preserve existing mark value if it exists
                mark = existing.get('mark', False)
                # Preserve existing label if it exists
                if existing.get('label') is not None:
                    label = existing['label']
                else:
                    # Auto-assign a label using the EXISTING bank_category (not the API one)
                    # If existing bank_category is None/empty, fall back to API bank_category
                    category_for_labeling = existing.get('bank_category') or api_bank_category
                    label = self.auto_label_bank_category(category_for_labeling)
                
                # Preserve existing bank_category if it exists
                if existing.get('bank_category') is not None and existing.get('bank_category') != '':
                    bank_category = existing['bank_category']
                else:
                    # Use API bank_category only if there's no existing value
                    bank_category = api_bank_category
            else:
                # New transaction - use API values and auto-assign label
                bank_category = api_bank_category
                label = self.auto_label_bank_category(bank_category)
                mark = False  # Default value for new transactions
            
            categorized_transactions.append({
                'id': tx['id'],
                'date': date,
                'description': description,
                'amount': amount,
                'bank_category': bank_category,
                'label': label,
                'has_split': False,  # Default value
                'split_from_id': None,  # Default value
                'mark': mark  # Preserve existing or set default
            })
        
        return categorized_transactions
    
    def additional_transaction_processing(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Perform shared-specific transaction processing (categorization and labeling).
        
        Args:
            transactions: List of transactions to process
            
        Returns:
            List of processed transactions
        """
        return self.categorize_and_label_transactions(transactions)


def main():
    """
    Main function to run the shared bank feed.
    """
    # Get configuration and add account-specific settings
    config = ACCOUNT_CONFIGS['shared'].copy()
    config['account_id'] = os.getenv('ULTIMATE_AWARDS_CC_ID')
    
    if not config['account_id']:
        logger.error("❌ Error: ULTIMATE_AWARDS_CC_ID environment variable not set")
        return
    
    # Create and run the bank feed
    bank_feed = BankFeedFactory.create_bank_feed(config, SharedBankFeed)
    bank_feed.run()


if __name__ == "__main__":
    main()
