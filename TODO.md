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
   - When double-clicking on a bank_category cell, display all valid values, not just values valid in the past 30 days. Need to fetch from shared_category table.

- [x] **Fix Total Calculations**:
   - Total calculation does not dynamically update based on table filters on the webpage.

- [ ] **Display editable cell pencil icon in Filtered Transactions table**:
   - Display editable cell pencil icon in Filtered Transactions table

- [WIP] **Create Transaction Data**:
   - Add the ability to create transactional data.

- [x] **Add Jacks Buckets**:
   - Add the Jacks Buckets section to this webpage.

- [x] **Add Total Balance**:
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

- [x] **Rename category_mapping table to shared_category**:
   - Rename it.

- [ ] **Add foreign key to shared_transaction table for bank_category**:
   - Link this to shared_category table to ensure uniqueness. Errors exist today as it is currently not a F.K.

- [x] **Test Add Transaction Functionality**:
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

- [x] **Start Date Incorrect**:
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
   - Add a feature that calculates total monthly spend, and have that number carry forward. Implement this logic for bills as well, and ideally have this automated somehow. 

- [x] **Add Gift & Holiday Saving Buckets**:
   - Add these two categories within the Personal webpage. 

- [x] **Auto Monthly Bucket Distribution (front-end implementation only)**:
   - Within the Personal webpage, add an auto distribution feature to allocate certain amount of money from one bucket to multiple other buckets. This should be in a form of a button where these list of auto distribution can be added/updated/deleted. This will enable users to  distribute monthly salaries into Gift & Holiday saving buckets for example. A database operation where it will split transactions will be performed automatically in the backend. 

- [x] **Offset Balance Buckets (Front-end)**:
   - Create an offset balance webpage where it categorizes different spending into different buckets. The best way forward to this is to fetch the total balance of the offset, and then create "dummy" transactions to create the initial buckets, similar to how the personal transaction buckets were created.   

- [x] **Offset Balance Buckets (Back-end)**:
   - Create an offset balance database table, similar to the personal transactions table. Then create a category table for these buckets. They can include additional personal savings on offset, extra mortgage repayments (all users), family member #1 contributions, family member #2 contribution, additional secondary person savings on offset.

- [ ] **Fix dropdown menu sizing**:
   - Fix it so the dropdown menu sizing is consistent with the table cell length.

- [x] **Implement solution for inactive savings buckets under Personal webpage**:
   - Find a solution to deal with savings buckets that are not in use or have $0 in them. Simplest solution is to add another column under the personal_category table and have it set to a true/false boolean. The backend api will then fetch only active buckets. Albeit, there are also other solutions available.

- [x] **Fix categories sum calculation**:
   - There is a common case where buckets will go into the negative (such as high bill periods, or spending more money than usual on gifts e.g., Christmas, or general monthly expenditure is high for a certain month). As such, this calculation would need to be accounted for in the "Categories Sum" section so that it aligns with the actual current balance. To do this, consider deducting any negative buckets from a selected bucket e.g., Salary Bucket. This ensures the categories sum and current balance is ALWAYS aligned even if a certain bucket goes into the negative. 

- [x] **Add Settings option**:
   - Add a settings option to enable/disable various functionality

- [x] **Reduce whitespacing in settings**:
   - Reduce whitespacing for each settings option

- [ ] **Replicate auto monthly distribution rules to offset page**:
   - low priority as not really required atm

- [ ] **Abstract Dupe Front-End Functionality**:
   - Functionality such as CSS, error handling, common components/utilities (help text, loading spinner), hooks directory, reusable UI components, API services, and notification systen can be abstracted into separate files for ease of use and readability.

- [x] **Fix hardcoded budget amounts**:
   - Currently hardcoded into this code. Fix this so a new table is created to store these budget amounts. New backend api endpoints would be required to update these values from the front-end by the user. 

- [ ] **Different method to fetch closing balance**:
   - Research pocketsmitsh API to find a way to fetch closing balance. Issue with current approach is it fetches closing balance from the latest transaction. The issue with this approach is that the closing balance may have changed since then and there are no new recent transactions to update this field e.g., in the event of a pending transaction being fulfilled fully. 

- [ ] **Fix category order column value fetch in DB**:
   - Currently hardcoded to specific values. If users decide to change category name, this value is not updated in this column name under personal_settings table. 

- [x] **Ensure manual label change is not overwritten automatically**:
   - In the shared transactions webpage, ensure any manual label change is not overwritten by any automated scripts. 

- [x] **Add the ability to store bucket ordering for offset webpage**:
   - Replicate behavior in personal webpage where category order is saved in DB, but for the offset webpage. This involves setting up new tables in psql. 

- [ ] **Fix deprecated packages/modules when npm install**:
   - dule is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
   - npm warn deprecated abab@2.0.6: Use your platform's native atob() and btoa() methods instead
   - npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
   - npm warn deprecated domexception@4.0.0: Use your platform's native DOMException instead