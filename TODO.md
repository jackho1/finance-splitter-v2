## Suggested Optimizations

- [x] **Refactor Totals Calculation Logic**:
   - Extract the totals calculation logic into a separate function to improve readability and maintainability.

- [ ] **Improve Error Handling**:
   - Enhance error handling in the `handleUpdate` function to provide more user-friendly messages and possibly implement retry logic for failed updates.

- [ ] **Optimize API Calls**:
   - Implement caching for API responses to reduce the number of requests made to the backend, especially for labels and transactions that do not change frequently.

- [x] **Add Loading Indicators**:
   - Introduce loading indicators while fetching data from the backend to enhance user experience during data loading.

- [ ] **Code Cleanup**:
   - Remove any unused imports and variables to keep the codebase clean and efficient.

- [x] **Unit Tests**:
   - Write unit tests for critical functions, especially for the totals calculation and filtering logic, to ensure reliability and facilitate future changes.

- [ ] **Accessibility Improvements**:
   - Review the UI components for accessibility compliance, ensuring that all interactive elements are keyboard navigable and screen reader friendly.

- [ ] **Styling Consistency**:
   - Ensure consistent styling across all components, possibly by using a CSS-in-JS solution or a CSS framework.

- [ ] **Performance Optimization**:
   - Analyze the performance of the application and identify any bottlenecks, especially in rendering large lists of transactions.

- [ ] **Documentation**:
   - Update the documentation to reflect any new features or changes made to the application.

- [x] **Integrate Python Script**:
   - Combine Python script to fetch transactions from PocketSmith API.

- [x] **Fix Bank Category Dropdown Values**:
   - Fix these values so they're hardcoded or fetched dynamically from another database.

- [ ] **Enable real-time synchronization**:
   - Enable real-time database synchronization so users do not need to manually refresh the webpage.

- [x] **Filter by Category Fix**:
   - Button is now broken, fix this.

- [x] **Open Total Spend Summary**:
   - Add the ability to click on a total spend column under Budgets and see what spend amount equates to that number.

- [x] **Fix Bank Category Filtering**:
   - When double-clicking on a bank_category cell, display all valid values, not just values valid in the past 30 days. Need to fetch from category_mapping table.

- [x] **Fix Total Calculations**:
   - Total calculation does not dynamically update based on table filters on the webpage.

- [ ] **Display editable cell pencil icon in Filtered Transactions table**:
   - Display editable cell pencil icon in Filtered Transactions table

- [WIP] **Create Transaction Data**:
   - Add the ability to create transactional data.

- [ ] **Add Jacks Buckets**:
   - Add the Jacks Buckets section to this webpage.

- [ ] **Add Total Balance**:
   - Add the Total Balance section to this webpage.

- [x] **Sort By Fix**:
   - Fix remaining Sort by functionality to work on other sorts.

- [x] **Default Help Text**:
   - Help texts to not show by default.

- [x] **Database Refresh**:
   - Add a button for PostgreSQL Database Refresh

- [x] **Remove Unlabelled Transactions from Graph View**:
   - Remove Unlabelled Transactions from Graph View OR add a separate filter for this only

- [x] **Fix Date Filtering**:
   - Fix date filtering such that it allows us to filter based on multiple months instead of just one month currently

- [x] **Test running shared_bank_feed.py**:
   - Run this python file to test.

- [ ] **Rename category_mapping table to shared_category**:
   - Rename it.

- [ ] **Add foreign key to shared_transaction table for bank_category**:
   - Link this to category_mapping table to ensure uniqueness. Errors exist today as it is currently not a F.K.