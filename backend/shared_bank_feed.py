import requests
from datetime import datetime, timedelta
import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Access environment variables
POCKETSMITH_API_KEY = os.getenv('POCKETSMITH_API_KEY')
ULTIMATE_AWARDS_CC_ID = os.getenv('ULTIMATE_AWARDS_CC_ID')
DAYS_TO_FETCH = int(os.getenv('DAYS_TO_FETCH', 30))
PEOPLE = os.getenv('PEOPLE', '').split(',')

# Database config
DB_CONFIG = {
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'host': os.getenv('DB_HOST'),
    'database': os.getenv('DB_NAME'),
    'port': os.getenv('DB_PORT')
}

# Function to fetch bank feed transactions from PocketSmith API
def fetch_transactions(start_date=None):
    page = 1
    all_transactions = []

    while True:
        url = f"https://api.pocketsmith.com/v2/accounts/{ULTIMATE_AWARDS_CC_ID}/transactions?page={page}&start_date={start_date}&end_date={datetime.now()}"
        
        headers = {"accept": "application/json", "X-Developer-Key": POCKETSMITH_API_KEY}

        print(f"Fetching transactions from PocketSmith API - Page {page}...")
        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            return all_transactions

        transactions = response.json()

        if not transactions:  # If there are no transactions, we stop fetching
            break
        
        # Parse transactions to match our format
        for tx in transactions:
            if tx.get('category') and 'title' in tx['category']:
                category_title = tx['category']['title']
            else:
                category_title = ""
            all_transactions.append({
                'id': tx['id'],
                'date': tx['date'],
                'description': tx['payee'],
                'bank_category': category_title,
                'amount': tx['amount']
            })

        page += 1  # Move to the next page for the next iteration
    return all_transactions

# Function to auto-label bank categories
def auto_label_bank_category(bank_category):
    """
    Automatically label transactions based on bank category.
    
    Returns the appropriate person label from PEOPLE list or None for shared/unlabeled categories.
    """
    no_label_categories = ["Dining", "Transfers", ]
    first_person_categories = ["Personal Items", "Personal Care", "Hobbies", 
                              "Entertainment/Recreation", "Vehicle", "Gym", "Fuel"]
    
    if not bank_category or bank_category in no_label_categories:
        return None
    elif bank_category in first_person_categories:
        return PEOPLE[0]
    else:
        return "Both"

# Function to categorize and label transactions
def categorize_and_label_transactions(transactions):
    categorized_transactions = []
    
    # Get all existing transaction data
    existing_data = {}
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Query to get existing transaction IDs and their current values
        cursor.execute("""
            SELECT id, label, bank_category, category, date, description, amount
            FROM shared_transactions_generalized
        """)
        for row in cursor.fetchall():
            existing_data[row[0]] = {
                'label': row[1],
                'bank_category': row[2], 
                'category': row[3],
                'date': row[4],
                'description': row[5],
                'amount': row[6]
            }
            
    except Exception as e:
        print(f"Error fetching existing transactions: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
    
    for tx in transactions:
        description = tx['description']
        amount = tx['amount']
        date = tx['date']
        api_bank_category = tx['bank_category']  # This is from the API
        
        # Check if this transaction already exists
        if tx['id'] in existing_data:
            existing = existing_data[tx['id']]
            
            # Preserve existing label if it exists
            if existing['label'] is not None:
                label = existing['label']
            else:
                # Auto-assign a label using the EXISTING bank_category (not the API one)
                # If existing bank_category is None/empty, fall back to API bank_category
                category_for_labeling = existing['bank_category'] or api_bank_category
                label = auto_label_bank_category(category_for_labeling)
            
            # Preserve existing bank_category if it exists
            if existing['bank_category'] is not None and existing['bank_category'] != '':
                bank_category = existing['bank_category']
            else:
                # Use API bank_category only if there's no existing value
                bank_category = api_bank_category
                
        else:
            # New transaction - use API values and auto-assign label
            bank_category = api_bank_category
            label = auto_label_bank_category(bank_category)

        categorized_transactions.append({
            'id': tx['id'],
            'date': date,
            'description': description,
            'amount': amount,
            'bank_category': bank_category,
            'label': label
        })
    
    return categorized_transactions

# Function to insert/update transactions into PostgreSQL database
def insert_transactions(transactions):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        for tx in transactions:
            # Simplified approach: Only update date and description from API
            # All other fields are preserved if they already exist in the database
            insert_query = sql.SQL("""
                INSERT INTO shared_transactions (id, date, description, amount, bank_category, label, has_split, split_from_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    -- Only these fields are always updated from the API
                    date = EXCLUDED.date,
                    description = EXCLUDED.description,
                    
                    -- All other fields are preserved if they exist in the database
                    amount = COALESCE(shared_transactions.amount, EXCLUDED.amount),
                    bank_category = COALESCE(NULLIF(shared_transactions.bank_category, ''), EXCLUDED.bank_category),
                    label = COALESCE(shared_transactions.label, EXCLUDED.label),
                    has_split = COALESCE(shared_transactions.has_split, EXCLUDED.has_split),
                    split_from_id = COALESCE(shared_transactions.split_from_id, EXCLUDED.split_from_id)
                WHERE 
                    -- Only update if any of these fields have changed
                    shared_transactions.date != EXCLUDED.date OR
                    shared_transactions.description != EXCLUDED.description
            """)
            
            cursor.execute(insert_query, (
                tx['id'],
                tx['date'],
                tx['description'],
                tx['amount'],
                tx['bank_category'],
                tx['label'],
                False,  # has_split default
                None    # split_from_id default
            ))
        conn.commit()
        
        # Enhanced logging: Verify transaction counts and provide detailed feedback
        cursor.execute("""
            SELECT 
                COUNT(CASE WHEN bank_category IS NOT NULL THEN 1 END) as categorized,
                COUNT(CASE WHEN label IS NOT NULL THEN 1 END) as labeled,
                COUNT(CASE WHEN has_split = TRUE THEN 1 END) as split,
                COUNT(*) as total
            FROM shared_transactions 
            WHERE id = ANY(%s)
        """, ([tx['id'] for tx in transactions],))
        
        stats = cursor.fetchone()
        print(f"✅ Successfully processed {len(transactions)} shared transactions:")
        print(f"   - {stats[0]} categorized")
        print(f"   - {stats[1]} labeled")
        print(f"   - {stats[2]} split transactions")
        print(f"   - {stats[3]} total in database")

    except Exception as e:
        print(f"❌ Error inserting/updating transactions: {e}")
        conn.rollback()
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Main function to fetch, categorize, and save transactions
def main():
    start_date = (datetime.now() - timedelta(days=DAYS_TO_FETCH)).strftime('%Y-%m-%d')
    print(f"📅 Fetching transactions from {start_date} to {datetime.now().strftime('%Y-%m-%d')} (spans {DAYS_TO_FETCH} days)")

    # Fetch transactions from API
    transactions = fetch_transactions(start_date)
    print(f"📥 Fetched {len(transactions)} transactions from PocketSmith API")
    
    if not transactions:
        print("ℹ️  No transactions found for the specified date range.")
        return
    
    categorized_transactions = categorize_and_label_transactions(transactions)
    
    # Insert/update transactions in database
    insert_transactions(categorized_transactions)

if __name__ == "__main__":
    main()