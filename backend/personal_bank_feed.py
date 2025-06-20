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
DEBIT_ID = os.getenv('DEBIT_ID')
DAYS_TO_FETCH = int(os.getenv('DAYS_TO_FETCH', 30))

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
        url = f"https://api.pocketsmith.com/v2/accounts/{DEBIT_ID}/transactions?page={page}&start_date={start_date}&end_date={datetime.now()}"
        
        headers = {"accept": "application/json", "X-Developer-Key": POCKETSMITH_API_KEY}

        print(f"Fetching personal transactions from PocketSmith API - Page {page}...")
        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            return all_transactions

        transactions = response.json()

        if not transactions:  # If there are no transactions, we stop fetching
            break
        
        for tx in transactions:
            all_transactions.append({
                'id': tx['id'],
                'date': tx['date'],
                'description': tx['payee'],
                'amount': tx['amount'],
                'closing_balance': tx.get('closing_balance', None)
            })

        page += 1  # Move to the next page for the next iteration
    
    return all_transactions

# Function to insert/update transactions into PostgreSQL database
def insert_transactions(transactions):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        for tx in transactions:
            # Simplified approach: Only update date, description, and closing_balance from API
            # All other fields are preserved if they already exist in the database
            insert_query = sql.SQL("""
                INSERT INTO personal_transactions (id, date, description, amount, category, closing_balance, has_split, split_from_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    -- Only these fields are always updated from the API
                    date = EXCLUDED.date,
                    description = EXCLUDED.description,
                    closing_balance = EXCLUDED.closing_balance,
                    
                    -- All other fields are preserved if they exist in the database
                    amount = COALESCE(personal_transactions.amount, EXCLUDED.amount),
                    category = COALESCE(personal_transactions.category, EXCLUDED.category),
                    has_split = COALESCE(personal_transactions.has_split, EXCLUDED.has_split),
                    split_from_id = COALESCE(personal_transactions.split_from_id, EXCLUDED.split_from_id)
                WHERE 
                    -- Only update if any of these fields have changed
                    personal_transactions.date != EXCLUDED.date OR
                    personal_transactions.description != EXCLUDED.description OR
                    personal_transactions.closing_balance IS DISTINCT FROM EXCLUDED.closing_balance
            """)
            
            cursor.execute(insert_query, (
                tx['id'],
                tx['date'],
                tx['description'],
                tx['amount'],
                None,  # Category will be manually populated later
                tx['closing_balance'],  # New field
                False,  # has_split default
                None    # split_from_id default
            ))

        conn.commit()
        
        # Enhanced logging: Count actual updates/inserts
        cursor.execute("""
            SELECT 
                COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as categorized,
                COUNT(CASE WHEN category IS NULL THEN 1 END) as uncategorized,
                COUNT(CASE WHEN has_split = TRUE THEN 1 END) as split,
                COUNT(*) as total
            FROM personal_transactions 
            WHERE id = ANY(%s)
        """, ([tx['id'] for tx in transactions],))
        
        stats = cursor.fetchone()
        print(f"✅ Successfully processed {len(transactions)} personal transactions:")
        print(f"   - {stats[0]} categorized")
        print(f"   - {stats[1]} uncategorized") 
        print(f"   - {stats[2]} split transactions")
        print(f"   - {stats[3]} total in database")

    except Exception as e:
        print(f"❌ Error inserting/updating transactions: {e}")
        if 'conn' in locals():
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
    print(f"📅 Fetching personal transactions from {start_date} to {datetime.now().strftime('%Y-%m-%d')} (spans {DAYS_TO_FETCH} days)")

    # Fetch transactions from API
    transactions = fetch_transactions(start_date)
    print(f"📥 Fetched {len(transactions)} transactions from PocketSmith API")
    
    if not transactions:
        print("ℹ️  No transactions found for the specified date range.")
        return
    
    # Insert/update transactions in database
    insert_transactions(transactions)

if __name__ == "__main__":
    main()