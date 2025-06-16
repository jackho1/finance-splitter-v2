# Smart Transaction Splitting Feature

## Overview
This feature allows you to automatically split a lump sum payment from your Personal Transactions based on filtered shared transactions. This is perfect for scenarios where you pay off your credit card with one large payment but want to categorize it into your personal savings buckets based on how you actually spent the money.

The system now uses **configurable split groups** that you can customize through the Settings interface, replacing the previous hardcoded category mappings.

## Prerequisites

### 1. Enable Personal Split Feature
- Go to **Personal Transactions** page
- Click the **Settings** button
- In the **Personal Split Configuration** section, check **"Enable personal split feature"**
- Configure your **default lookback days** (e.g., 7 days)

### 2. Configure Split Groups
- Click **"Configure"** next to the Personal Split Configuration setting
- Create custom split groups by mapping budget categories to personal savings buckets
- Each budget category can only be used in one split group (prevents conflicts)

#### Example Split Group Configuration:
| Split Group Name | Budget Categories | Personal Savings Bucket |
|------------------|-------------------|-------------------------|
| Bills Split      | Bills             | Bills                   |
| Gifts Split      | Gifts             | Gift Balance            |
| Holidays Split   | Holidays          | Holidays                |

## How to Use

### 1. Split Your Personal Transaction
- Go to your **Personal Transactions** page
- Find the lump sum transaction you want to split (e.g., your $500 credit card payment)
- Click the **Split Transaction** button

### 2. Use Smart Split Feature
- ✅ **Auto-populated date range**: The smart split will automatically suggest your configured default days as the date range
- ✅ **Modify dates if needed**: You can adjust the start date to match your actual spending period
- ✅ **End date auto-defaults**: You can clear the end date completely - when you click "Load Split", it will automatically use today's date
- ✅ **Auto-enabled if configured**: The "Use configured split groups" checkbox will be automatically checked if you have split groups configured
- Click **"Load Split"** button (this will work even if end date is empty!)

### 3. Review and Accept
- Review the proposed split breakdown showing your configured split groups
- The system shows you exactly how much will go to each of your configured personal savings buckets
- Click **"Save Splits"** to confirm

**No more need to set filters on the Transactions page first!** 🎉

## Configurable Category Mapping

The system uses your **custom split group configuration** instead of hardcoded rules:

### Split Groups Management
- **Create Groups**: Add new split groups with custom names
- **Map Categories**: Assign budget categories to each group (each category can only be used once)
- **Set Personal Buckets**: Choose which personal savings bucket each group maps to
- **Edit/Delete**: Modify existing groups or remove them entirely
- **Validation**: System prevents duplicate category usage across groups

### Advanced Features
- **Real-time Validation**: Categories already used in other groups are disabled and marked as "(already used)"
- **Unsaved Changes Protection**: Warning dialog when closing configuration without saving
- **Visual Feedback**: Selected categories are highlighted with colored chips
- **Conflict Resolution**: Clear error messages if trying to use conflicting categories

**Special Handling:**
- **Transaction Filtering**: Only includes transactions with label "Jack" or "Both" 
- **"Both" transactions**: Amount is divided by 2 when calculating Jack's portion
- **Transaction Exclusion**: Transactions with labels other than "Jack" or "Both" are completely excluded
- **Date ranges**: Fully inclusive (start and end dates included)
- **Display format**: Dates shown as "8th June to 15th June" instead of "2025-06-08 to 2025-06-15"

## Example Workflow

**Scenario:** You spent $500 over the week and want to pay off your credit card.

### Step 1: Configure Split Groups (One-time Setup)
1. Go to **Personal Transactions** → **Settings**
2. Enable personal split feature
3. Click **"Configure"** to set up split groups:
   - **Bills Group**: Maps "Bills" → "Bills" bucket
   - **Gifts Group**: Maps "Gifts" → "Gift Balance" bucket  
   - **Holidays Group**: Maps "Holidays" → "Holidays" bucket
   - **Monthly Expenditure**: Maps remaining categories → stays in original transaction

### Step 2: Use Smart Split
1. **Personal Page:** Add transaction: "Credit Card Payment" -$500
2. **Split the $500** using your configured groups:
   - $100 Bills transactions → "Bills" bucket (based on your Bills group configuration)
   - $350 Food/Monthly Expenditure transactions → Stay in original transaction
   - $50 Gift transactions → "Gift Balance" bucket (based on your Gifts group configuration)

**Result:** Your $500 payment becomes:
- Original transaction: $350 (Monthly Expenditure categories)
- Split 1: $100 to Bills bucket → **"Bills 9 Jun-15 Jun"**
- Split 2: $50 to Gift Balance bucket → **"Gifts 9 Jun-15 Jun"**

**Smart Split Preview shows your configured groups:**
- Monthly Expenditure: $350.00 (25 transactions) → Stays in original
- Bills: $100.00 (3 transactions) → Bills
- Gifts: $50.00 (2 transactions) → Gift Balance
- **Total: $500.00**

### 3. **Concise Weekly Descriptions**
Each split transaction includes a short date range, making it easy to identify which week's expenses each transaction represents:
- **"Bills 9 Jun-15 Jun"** - Bill payments for that week
- **"Gifts 9 Jun-15 Jun"** - Gift spending for that week  
- **"Holidays 9 Jun-15 Jun"** - Holiday spending for that week

Clean, concise descriptions that keep your transaction history organized without clutter.

## Technical Details

### Database Tables
- **`personal_split_groups`** - Stores custom split group configurations
- **`personal_split_mapping`** - Maps budget categories to split groups (many-to-many)
- **`personal_settings`** - Stores user preferences (enabled/disabled, default days)

### API Endpoints
- `GET /shared-transactions-filtered` - Returns aggregated data by configured split groups
- `GET /personal-split-groups/:userId` - Retrieves user's split group configuration
- `POST/PUT/DELETE /personal-split-groups` - Manage split groups
- `POST/DELETE /personal-split-mapping` - Manage category mappings

### Data Flow
1. User configures split groups in Settings
2. Smart split queries shared transactions with date filters
3. Backend groups transactions by user's configured split groups
4. Frontend displays breakdown based on user's personal category mappings
5. Split transactions are created using configured personal bucket names

## Benefits

1. **Fully Customizable** - Create your own split groups and category mappings
2. **Automated Categorization** - No manual calculation needed
3. **Accurate Budgeting** - Money goes to your configured savings buckets
4. **Time Saving** - One-time setup, then one-click splitting
5. **Preview Feature** - See the breakdown before committing
6. **Flexible** - Can still manually adjust splits if needed
7. **Data Integrity** - Prevents duplicate category usage across groups
8. **User-Friendly** - Visual feedback and validation throughout configuration

## Configuration Tips

1. **Start Simple**: Begin with basic groups like Bills, Gifts, Holidays
2. **One Category Per Group**: Each budget category can only be used in one split group
3. **Default Group**: Consider having one group that stays in the original transaction for miscellaneous expenses
4. **Regular Review**: Periodically review and adjust your split groups as spending patterns change
5. **Test First**: Use the preview feature to verify your configuration works as expected

## Future Enhancements

- ✅ **Custom Split Groups** - Implemented
- ✅ **Configurable Category Mappings** - Implemented  
- ✅ **User-Friendly Configuration Interface** - Implemented
- Integration with live Transaction page filters
- Bulk processing for multiple transactions
- Export/import of split configurations
- Split group templates for common use cases 