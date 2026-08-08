/**
 * Industry-standard income & expense categories for manufacturing/inventory businesses.
 * Use these as defaults in your frontend dropdowns or seeding scripts.
 */

export const INCOME_CATEGORIES = [
  // Revenue
  'Sales Revenue',
  'Service Revenue',
  'Product Sales',
  'Wholesale Revenue',
  'Export Revenue',
  'Commission Income',
  'Rental Income',
  'Interest Income',
  'Dividend Income',
  'Refund Received',
  'Advance Received',
  'Other Income',
] as const;

export const EXPENSE_CATEGORIES = [
  // Cost of Goods
  'Raw Material Purchase',
  'Finished Goods Purchase',
  'Packaging Materials',
  'Import Cost',
  'Freight & Logistics',

  // Operating Expenses
  'Salary & Wages',
  'Staff Overtime',
  'Utilities - Electricity',
  'Utilities - Gas',
  'Utilities - Water',
  'Office Rent',
  'Factory Rent',
  'Equipment Maintenance',
  'Vehicle Fuel',
  'Vehicle Maintenance',
  'Internet & Phone',

  // Admin
  'Stationery & Office Supplies',
  'Printing & Photocopying',
  'Postage & Courier',
  'Bank Charges',
  'Mobile Banking Charges',
  'Professional Fees',
  'Audit Fees',
  'Legal Fees',

  // Marketing
  'Advertising & Marketing',
  'Trade Fair / Exhibition',
  'Promotional Gifts',

  // Tax & Compliance
  'VAT Payment',
  'Income Tax',
  'Trade License Fee',
  'Government Fees',

  // Miscellaneous
  'Entertainment',
  'Petty Cash',
  'Staff Welfare',
  'Advance Payment',
  'Loan Repayment',
  'Other Expense',
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];