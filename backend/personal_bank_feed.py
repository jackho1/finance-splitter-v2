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
        
        # Parse transactions to match our format
        for tx in transactions:
            all_transactions.append({
                'id': tx['id'],
                'date': tx['date'],
                'description': tx['payee'],
                'amount': tx['amount'],
                'closing_balance': tx.get('closing_balance', None)  # New field
            })

        page += 1  # Move to the next page for the next iteration
    
    return all_transactions

# Function to insert transactions into PostgreSQL database
def insert_transactions(transactions):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        for tx in transactions:
            insert_query = sql.SQL("""
                INSERT INTO personal_transactions (id, date, description, amount, category, closing_balance, has_split, split_from_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
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
        print(f"Successfully processed {len(transactions)} personal transactions.")

    except Exception as e:
        print(f"Error inserting transactions: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

# Main function to fetch and save transactions
def main():
    start_date = (datetime.now() - timedelta(days=DAYS_TO_FETCH)).strftime('%Y-%m-%d')
    print(f"Fetching personal transactions from {start_date} to {datetime.now().strftime('%Y-%m-%d')} (spans {DAYS_TO_FETCH} days).")

    transactions = fetch_transactions(start_date)
    
    if transactions:
        insert_transactions(transactions)
        print(f"Processed {len(transactions)} personal transactions.")
    else:
        print("No transactions found to process.")

if __name__ == "__main__":
    main()