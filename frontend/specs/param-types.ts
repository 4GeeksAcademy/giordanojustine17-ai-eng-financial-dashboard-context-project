/**
 * Query parameter types for the financial metrics API endpoints.
 * Source of truth: backend FastAPI OpenAPI schema (/openapi.json),
 * parameter definitions in backend/app/routes.py.
 */

import {
  type OperationType,
  type BusinessType,
  type Category,
} from "./api-types";

/** Grouping period for time-series data. */
export type GroupBy = "day" | "week" | "month";

/**
 * Common date range filter used across multiple endpoints.
 * Both dates are optional ISO 8601 date strings (YYYY-MM-DD).
 * Either, both, or neither can be provided; one-sided filtering is supported.
 */
export interface DateRangeFilter {
  /**
   * Start of the date range, inclusive. If omitted, queries from dataset minimum.
   * ISO 8601 format: YYYY-MM-DD (e.g., "2026-01-15").
   */
  start_date?: string;
  /**
   * End of the date range, inclusive. If omitted, queries to dataset maximum.
   * ISO 8601 format: YYYY-MM-DD (e.g., "2026-12-31").
   */
  end_date?: string;
}

/**
 * Query parameters for GET /api/metrics/alerts.
 * Retrieves outcome-spike anomalies based on a threshold and time grouping.
 * Supports filtering by date range and business type.
 */
export interface AlertsParams extends DateRangeFilter {
  /**
   * Relative increase threshold that triggers an alert, as a decimal fraction.
   * Backend accepts: any number >= 0, default 0.3.
   * Frontend constraint: 0.01 to 1.0, default 0.3.
   * Example: 0.3 = alert when outcome exceeds baseline by >30%;
   *          0.5 = alert when outcome exceeds baseline by >50%.
   */
  threshold?: number;
  /**
   * Time-series grouping for period labels and calculations.
   * Default: "month". Valid: "day" | "week" | "month".
   * Affects the period label format in alert responses:
   * - "day": YYYY-MM-DD (e.g., "2026-01-15")
   * - "week": YYYY-Www (ISO week, e.g., "2026-W03")
   * - "month": YYYY-MM (e.g., "2026-01")
   */
  group_by?: GroupBy;
  /**
   * Optional: filter to transactions of a specific business type.
   * Values: "B2B" | "B2C".
   * If omitted, alerts include all business types.
   */
  business_type?: BusinessType;
}

/**
 * Query parameters for GET /api/metrics/categories/top.
 * Retrieves ranked category totals for a given operation type.
 * Supports filtering by date range and business type.
 */
export interface TopCategoriesParams extends DateRangeFilter {
  /**
   * Operation type to rank categories for.
   * Default: "outcome". Valid: "income" | "outcome".
   * Determines which categories appear in results.
   */
  operation_type?: OperationType;
  /**
   * Maximum number of top categories to return.
   * Backend constraints: integer, 1 ≤ limit ≤ 20, default 5.
   * Results are sorted by total_amount descending.
   */
  limit?: number;
  /**
   * Optional: filter to transactions of a specific business type.
   * Values: "B2B" | "B2C".
   * If omitted, top categories include all business types.
   */
  business_type?: BusinessType;
}

/**
 * Query parameters for GET /api/metrics/summary.
 * Retrieves time-series income/outcome summaries with rich filtering.
 * Useful for comparing totals across business types, categories, and time periods.
 */
export interface SummaryParams extends DateRangeFilter {
  /**
   * Time-series grouping for period labels and calculations.
   * Default: "month". Valid: "day" | "week" | "month".
   * Affects the period label format in summary responses:
   * - "day": YYYY-MM-DD (e.g., "2026-01-15")
   * - "week": YYYY-Www (ISO week, e.g., "2026-W03")
   * - "month": YYYY-MM (e.g., "2026-01")
   */
  group_by?: GroupBy;
  /**
   * Optional: filter to transactions of a specific business type.
   * Values: "B2B" | "B2C".
   * Useful for comparing income/outcome between business segments (e.g., B2B vs B2C).
   * If omitted, summary includes all business types.
   */
  business_type?: BusinessType;
  /**
   * Optional: filter to transactions of a specific category.
   * Values: "suppliers" | "sales" | "operational" | "administrative" | "others".
   * If omitted, summary aggregates all categories.
   */
  category?: Category;
  /**
   * Optional: filter to a specific operation type.
   * Values: "income" | "outcome".
   * If omitted, response includes both income and outcome totals per period.
   */
  operation_type?: OperationType;
}
