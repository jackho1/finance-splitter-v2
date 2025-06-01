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

- [ ] **Test Add Transaction Functionality**:
   - Fully test this functionality and amend it if it is broken

- [x] **Split Transactions Functionality**:
   - Add the ability to split an existing transaction down further

- [x] **Refactor Naming Labels**:
   - Refactor naming labels so they're not "hardcoded"

- [x] **Display Summarized Category Data for Personal Webpage**:
   - Add personal transaction data grouped by category

- [x] **Show All Related Transactions**:
   - When double-clicking on a savings buckets, show all transactions for that category

- [x] **Consistent Styling**:
   - Ensure consistency of styling across all three webpages. Currently, they're all very inconsistent

- [ ] **Rename Tabbings**:
   - Transactions, Monthly Budget, Personal Savings

- [ ] **Start Date Incorrect**:
   - When filtering transactions with start date, it does not include transactions on that exact start date itself.

- [ ] **Consider alterantive to userConfig.js file**:
   - Fetching user label names should be fetched from the DB, not "hardcoded" in the src/config/userConfig.js file still.


- [ ] **Minor Split Transaction View Fix**:
   - Some UI consistency on this pop up window can be made, particularly with the category field.

- [x] **Add progress bar on Budgets**:
   - Able to view budget spend amounts at a glance

- [ ] **Clean  up files**:
   - Refactor file location so it is more maintainable, especially frontend/src

- [x] **See which transactions are split**:
   - Add indicator to see which transactions have been split and which it has been split to.

- [x] **Fix Total Budgets calculation**:
   - Currently, it is incorrectly calculated

- [ ] **Make Transactions table colors more prominent**:
   - Currently, it makes it a little bit difficult to read, need to compare results.

- [x] **Center Transaction Table Values**:
   - Center all Transaction Rows including headers except for the description rows.

- [ ] **Database Operation Enhancements**:
   - If a cell was being edit has no changes made, do not perform an update database operation

- [ ] **Transfer Savings Bucket**:
   - Add functionality so users can transfer amounts from one savings bucket to another

- [ ] **Table Filter Bug**:
   - Fix a bug in our table filters such that if the results are small or empty, the filtering options are cut-off.

- [ ] **Total Monthly Spend Carry Forward**:
   - Add a feature that calculates total monthly spend, and have that number carry forward.

- [ ] **Add Gift & Holiday Saving Buckets**:
   - Add these two categories within the Personal webpage. 

- [ ] **Auto Monthly Bucket Distribution**:
   - Within the Personal webpage, add an auto distribution feature to allocate certain amount of money from one bucket to multiple other buckets. This should be in a form of a button where these list of auto distribution can be added/updated/deleted. This will enable users to  distribute monthly salaries into Gift & Holiday saving buckets for example. A database operation where it will split transactions will be performed automatically in the backend.

- [ ] **Offset Balance Buckets (Front-end)**:
   - Create an offset balance webpage where it categorizes different spending into different buckets. The best way forward to this is to fetch the total balance of the offset, and then create "dummy" transactions to create the initial buckets, similar to how the personal transaction buckets were created.   

- [ ] **Offset Balance Buckets (Back-end)**:
   - Create an offset balance database table, similar to the personal transactions table. Then create a category table for these buckets. They can include additional personal savings on offset, extra mortgage repayments (all users), family member #1 contributions, family member #2 contribution, additional secondary person savings on offset.

- [ ] **Fix dropdown menu sizing**:
   - Fix it so the dropdown menu sizing is consistent with the table cell length.
