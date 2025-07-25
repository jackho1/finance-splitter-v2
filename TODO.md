## Suggested Optimizations

- [x] **Refactor Totals Calculation Logic**:

  - Extract the totals calculation logic into a separate function to improve readability and maintainability.

- [x] **Improve Error Handling**:

  - Enhance error handling in the `handleUpdate` function to provide more user-friendly messages and possibly implement retry logic for failed updates.

- [x] **Optimize API Calls**:

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

- [x] **Add foreign key to shared_transaction table for bank_category**:

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

- [x] **Minor Split Transaction View Fix**:

  - Some UI consistency on this pop up window can be made, particularly with the category field.

- [x] **Add progress bar on Budgets**:

  - Able to view budget spend amounts at a glance

- [ ] **Clean up files**:

  - Refactor file location so it is more maintainable, especially frontend/src

- [x] **See which transactions are split**:

  - Add indicator to see which transactions have been split and which it has been split to.

- [x] **Fix Total Budgets calculation**:

  - Currently, it is incorrectly calculated

- [x] **Make Transactions table colors more prominent**:

  - Currently, it makes it a little bit difficult to read, need to compare results.

- [x] **Center Transaction Table Values**:

  - Center all Transaction Rows including headers except for the description rows.

- [x] **Database Operation Enhancements**:

  - If a cell was being edit has no changes made, do not perform an update database operation

- [ ] **Transfer Savings Bucket**:

  - Add functionality so users can transfer amounts from one savings bucket to another. Intuitively, users should be able to just drag and drop one savings bucket to another and it will give a pop up window that asks how much to transfer over.

- [ ] **Table Filter Bug**:

  - Fix a bug in our table filters such that if the results are small or empty, the filtering options are cut-off.

- [x] **Total Monthly Spend Carry Forward**:

  - Add a feature that calculates total monthly spend, and have that number carry forward. Implement this logic for bills as well, and ideally have this automated somehow.

- [x] **Add Gift & Holiday Saving Buckets**:

  - Add these two categories within the Personal webpage.

- [x] **Auto Monthly Bucket Distribution (front-end implementation only)**:

  - Within the Personal webpage, add an auto distribution feature to allocate certain amount of money from one bucket to multiple other buckets. This should be in a form of a button where these list of auto distribution can be added/updated/deleted. This will enable users to distribute monthly salaries into Gift & Holiday saving buckets for example. A database operation where it will split transactions will be performed automatically in the backend.

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

- [x] **Fix category order column value fetch in DB**:

  - Currently hardcoded to specific values. If users decide to change category name, this value is not updated in this column name under personal_settings table.

- [x] **Ensure manual label change is not overwritten automatically**:

  - In the shared transactions webpage, ensure any manual label change is not overwritten by any automated scripts.

- [x] **Add the ability to store bucket ordering for offset webpage**:

  - Replicate behavior in personal webpage where category order is saved in DB, but for the offset webpage. This involves setting up new tables in psql.

- [x] **Fix deprecated packages/modules when npm install**:

  - dule is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
  - npm warn deprecated abab@2.0.6: Use your platform's native atob() and btoa() methods instead
  - npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
  - npm warn deprecated domexception@4.0.0: Use your platform's native DOMException instead

- [x] **Fix "Filter by Category" button**:

  - It appears after some table category updates in psql, this filter is broken now.

- [ ] **Add initializer psql code"**:

  - Upon running this program for the first time, there should be code to ensure all psql tables are set up correctly. This means any new modifications made to these tables will also need to amend this initializer function/file. Currently this is only partially implemented e.g., ensureSplitColumnsExist in index.js.

- [x] **Fix logs occuring twice**:

  - When switching to personal webpage, log statements appear twice, which indicate something is being triggered twice when it should only trigger once. "No changes detected for user settings default, skipping database update". Update: This is the expected behaviour for dev builds and is called twice for testing purposes.

- [x] **Update offset category table**:

  - Currently its primary key is the name of the category, fix this so the primary key is an id and category is just a name that is easily interchangeable.

- [x] **Update Budget Filtering**:

  - Currently, when users click on chart data for a different month, the Transactions webpage does not reflect the selected months data. Instead it shows data on the current month which is incorrect.

- [x] **index.js errors**:

  - Fix "sorry, too many clients already" bug relating to labelling. Possibly related to the split transaction bug as well.

- [ ] **Re-test all functionality**:

  - Consider adding unit tests to test every single functionality and their expected behaviour.

- [ ] **Productionize code**:

  - Productionize this app.

- [ ] **Note: New PSQL Tables are Generated**:

  - When new tables are generated using data that can come externally or from a u ser, create an id column as the primary key and use "INTEGER BY DEFAULT AS IDENTITY PRIMARY KEY.
  - DEFAULT ensures the external endpoint can update this id column automatically or if no id is supplied, PostgreSQL will auto-generate one using the sequence.
  - AS IDENTITY ensures its generates a new id value when new records are inserted without an id populated.
  - PRIMARY KEY is self-explanatory.

- [ ] **Address failed unit tests**:

  - Fix all failed unit tests when running npm test in frontend/

- [ ] **Add the ability to create new webpages + tables**:

  - Through a single button, add the ability to create a brand new webpage when brand new PSQL tables. It should replicate the table beahviour of personal and offset tables.

- [ ] **Add category history table**:

  - add this for an audit trail

- [ ] **Add ability to rename existing saving buckets**:

  - Add.

- [ ] **Add ability to create new saving buckets**:

  - Add.

- [x] **Integrate Sort By Feature to Column Titles**:

  - Remove the Sort By dropdown menu and integrate it into a double-click for each title instead.

- [ ] **Consistent CSS Styling**:

  - Need to ensure consistent styling such as titles, section locations are all aligned between different webpages.

- [ ] **Refactor codebase**:

  - Refactor codebase so it is more cleaner. Currently, all files are added everywhere with no properly file structure.

- [x] **Remove zero categories from chart**:

  - Within the App.jsx webpage, remove categories in the chart where that category is set to zero. It adds unnecessary clutter.

- [x] **Refactor split transaction pop up window**:

  - Personal and offset webpages need to be updated similar to the transactions webpage.

- [x] **Update offset & personal webpage bucket load**:

  - Update both pages such that it retrieves the save buckets ordering from the database before loading the savings bucket to the user. This is to ensure the buckets are shown in the actual order that is stored in the database.

- [ ] **Add offset_settings table**:

  - Add this table, similar to personal webpage table to save all settings (removes need for persistent local storage), and category order.

- [x] **Fix hardcoded auto split transactions**:

  - Currently it is hardcoded. Fix this so new psql tables are set up to ensure this automation can be configured easily.
    Users should be able to create M2M relationships for automated budget categories and saving bucket relationships
  - personal_split_groups - stores custom group names displays ordering of groups,
  - personal_split_mapping - multiple budget categories map to one savings bucket, can be added or deleted
  - personal_settings (existing) - Users should be able to enable/disable auto split functionality. Stores user preference for default days e.g., 7, default user to split against, and users to include from shared transactions e.g., include jack and both/2 and exclude other users.

- [ ] **Add table for label names**:

  - Add table to store label names.

- [ ] **Add projected savings**:

  - This likely requires some additional tables to be created to store monthly saving amounts for each bucket

- [ ] **Create audit history logs for shared_transactions**:

  - Triggers to be performed in the psql tables directly and not in python.

- [x] **Refactor PocketSmith API fetch from the 3 \_bank_feed.py files**:

  - Abstract all duplicate code into a base and config file to reduce overhead in maintainenance.

- [ ] **Workaround fix for id changing based on transaction description name change (pending > fulfilled)**:

  - Currently, there are some transactions in pending state with one primary key id, but when it updates its description name into a processed state, the primary key id is also changed. This needs to be accounted for.

- [x] **Use logger.xx for print statemnets**:

  - Replace all print statements to use logging instead.

- [x] **Fix dropdown menu options**:

  - Date option is cut-off and we can remove the redundant "Apply" button. We can also reduce whitespacing and font sizes slightly as well to make it more concise.

- [x] **Reorder the transaction dates based on the JSON data sequence (primary key)**:

  - Add above.

- [x] **Table filter scroll fix**:

  - Fix an issue when selecting a table dropdown filter option, the webpage is scrolled to the top automatically.
  - Fix issue with label column dropdown menu being excessively large
  - Potentially move the dropdown menu option cancel/clear button to left-align only
  - Expand bank category dropdown menu to be slightly larger to fit large texts.

- [x] **Budgets progress bar color**:

  - Update the budgets progress bar color to change depending on the % spent. ideally it is a smooth transition change, however incremental changes e.g., 50%, 75% would also suffice.

- [x] **Color management system**:

  - Create a proper color management system so that user color preferences can be stored and is associated with selected users. Current solution simply arbitrarily selects a hardcoded color.

- [ ] **Advanced Split System**:

  - Add a more advanced transaction split system.

- [ ] **Add offset_settings table**:

  - Add this table and have it aligned somewhat simialarly to personal_settings table (likely with less features overall)

- [x] **Budgets webpage is broken**:

  - Fix the budgets page to use the updated user management system. Currently it is not being updated at all.

- [ ] **Display icons for each transaction in mobile app view**:

  - Use icons instead of category names. When users open the transaction record, we can display the category name there instead (displays both sub and main category)

- [x] **App.jsx labelling is broken**:

  - Fix the labelling behaviour. Upon page refresh, the label value is not retained.
