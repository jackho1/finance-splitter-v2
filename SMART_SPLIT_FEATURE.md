# Smart Transaction Splitting Feature

## Overview
This feature allows you to automatically split a lump sum payment from your Personal Transactions based on filtered shared transactions. This is perfect for scenarios where you pay off your credit card with one large payment but want to categorize it into your personal savings buckets based on how you actually spent the money.

## How to Use

### 1. Split Your Personal Transaction
- Go to your **Personal Transactions** page
- Find the lump sum transaction you want to split (e.g., your $500 credit card payment)
- Click the **Split Transaction** button

### 2. Use Smart Split Feature
- ✅ **Auto-populated date range**: The smart split will automatically suggest the last 7 days as the date range
- ✅ **Modify dates if needed**: You can adjust the start date to match your actual spending period
- ✅ **End date auto-defaults**: You can clear the end date completely - when you click "Load Split", it will automatically use today's date
- Click **"Split based on shared transactions"** checkbox
- Click **"Load Split"** button (this will work even if end date is empty!)

### 3. Review and Accept
- Review the proposed split breakdown showing your different spending categories
- The system shows you exactly how much will go to Bills, Gifts, Holidays, and Monthly Expenditure buckets
- Click **"Save Splits"** to confirm

**No more need to set filters on the Transactions page first!** 🎉

## Category Mapping

The system automatically groups budget categories and maps them to personal savings buckets:

| Category Group | Budget Categories Included | Personal Savings Bucket |
|----------------|---------------------------|--------------------------|
| Monthly Expenditure | Vehicle, Entertainment, Food, Home, Medical, Personal Items, Travel, Other | Remains in original transaction |
| Bills          | Bills                     | Bills                  |
| Gifts          | Gifts                     | Gift Balance           |
| Holidays       | Holidays                  | Holidays               |

**Note**: Only Bills, Gifts, and Holidays are split out into separate buckets.

**Special Handling:**
- **Transaction Filtering**: Only includes transactions with label "Jack" or "Both" 
- **"Both" transactions**: Amount is divided by 2 when calculating Jack's portion
- **Transaction Exclusion**: Transactions with labels other than "Jack" or "Both" are completely excluded
- **Date ranges**: Fully inclusive (start and end dates included)
- **Display format**: Dates shown as "8th June to 15th June" instead of "2025-06-08 to 2025-06-15"

## Example Workflow

**Scenario:** You spent $500 over the week and want to pay off your credit card.

1. **Transactions Page:** Filter dates 9th June to 15th June, see $500 total
2. **Personal Page:** Add transaction: "Credit Card Payment" -$500
3. **Split the $500:**
   - $100 Bills transactions → "Bills" bucket
   - $350 Food/Monthly Expenditure transactions → Stay in original transaction  
   - $50 Gift transactions → "Gift Balance" bucket

**Result:** Your $500 payment becomes:
- Original transaction: $350 (Food/Monthly Expenditure)
- Split 1: $100 to Bills bucket → **"Bills 9 Jun-15 Jun"**
- Split 2: $50 to Gift Balance bucket → **"Gifts 9 Jun-15 Jun"**

**Smart Split Preview shows:**
- Monthly Expenditure: $350.00 (25 transactions) → Stays in original
- Bills: $100.00 (3 transactions) → Bills
- Gifts: $50.00 (2 transactions) → Gift Balance
- **Total: $500.00**

### 4. **Concise Weekly Descriptions**
Each split transaction includes a short date range, making it easy to identify which week's expenses each transaction represents:
- **"Food 9 Jun-15 Jun"** - Food expenses for that week
- **"Bills 9 Jun-15 Jun"** - Bill payments for that week  
- **"Holidays 9 Jun-15 Jun"** - Holiday spending for that week

Clean, concise descriptions that keep your transaction history organized without clutter.

## Technical Details

### API Endpoint
- `GET /shared-transactions-filtered`
- Query parameters: `startDate`, `endDate`, `user` (defaults to 'Jack')
- Returns aggregated data by budget category

### Database Tables Used
- `shared_transactions_generalized` - For filtered transaction data
- `personal_transactions` - For split transaction creation

## Benefits

1. **Automated Categorization** - No manual calculation needed
2. **Accurate Budgeting** - Money goes to the right savings buckets
3. **Time Saving** - One click instead of manual splitting
4. **Preview Feature** - See the breakdown before committing
5. **Flexible** - Can still manually adjust splits if needed

## Future Enhancements

- Integration with live Transaction page filters
- Custom category mapping rules
- Bulk processing for multiple transactions
- Export/import of split configurations 