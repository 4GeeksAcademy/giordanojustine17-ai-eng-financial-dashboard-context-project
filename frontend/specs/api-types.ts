/**
 * API response types for the financial metrics endpoints.
 * Source of truth: backend FastAPI OpenAPI schema (/openapi.json),
 * models in backend/app/routes.py.
 */

/** Direction of a financial movement. */
export type OperationType = "income" | "outcome";

/** Business segment a movement belongs to. */
export type BusinessType = "B2B" | "B2C";

/** Classification of a financial movement. */
export type Category =
  | "suppliers"
  | "sales"
  | "operational"
  | "administrative"
  | "others";

/**
 * Response of GET /api/metrics/facets.
 * Describes the distinct values available in the dataset, for building filters.
 */
export interface FacetsResponse {
  /** Distinct operation types present in the data, sorted alphabetically. Values: "income" | "outcome". */
  operation_types: OperationType[];
  /** Distinct business types present in the data, sorted alphabetically. Values: "B2B" | "B2C". */
  business_types: BusinessType[];
  /** Distinct categories present in the data, sorted alphabetically. Values: "suppliers" | "sales" | "operational" | "administrative" | "others". */
  categories: Category[];
  /** Earliest movement date in the dataset, ISO 8601 date string (YYYY-MM-DD). */
  min_date: string;
  /** Latest movement date in the dataset, ISO 8601 date string (YYYY-MM-DD). */
  max_date: string;
}

/**
 * One outcome-spike alert, an element of the GET /api/metrics/alerts response.
 * Produced when a period's outcome exceeds the average of all earlier periods
 * by more than the requested threshold.
 */
export interface AlertEntry {
  /**
   * Period label, determined by the `group_by` query parameter:
   * "YYYY-MM-DD" (day), "YYYY-Www" e.g. "2026-W07" (ISO week), or "YYYY-MM" (month).
   */
  period: string;
  /** Total outcome (expenses) for this period, rounded to 2 decimals. Non-negative. */
  outcome_total: number;
  /** Average outcome of all preceding periods, rounded to 2 decimals. Always greater than 0 for returned alerts. */
  baseline_average: number;
  /**
   * Relative increase over the baseline, as a fraction (0.5 = +50%), rounded to 4 decimals:
   * (outcome_total - baseline_average) / baseline_average.
   * Always greater than the request's `threshold` (default 0.3).
   */
  increase_ratio: number;
}

/**
 * Response of GET /api/metrics/alerts.
 * A bare JSON array (not wrapped in an object), in chronological order.
 * Empty when no period exceeds the threshold.
 */
export type AlertsResponse = AlertEntry[];

/**
 * One ranked category total, an element of the GET /api/metrics/categories/top response.
 */
export interface CategoryEntry {
  /**
   * Category being totalled. Schema allows "suppliers" | "sales" | "operational" |
   * "administrative" | "others"; in practice outcome results never include "sales".
   */
  category: Category;
  /** Operation type this total covers. Equals the request's `operation_type` (default "outcome") for every entry. */
  operation_type: OperationType;
  /** Sum of movement amounts for this category within the filters, rounded to 2 decimals. */
  total_amount: number;
}

/**
 * Response of GET /api/metrics/categories/top.
 * A bare JSON array (not wrapped in an object), sorted by `total_amount`
 * descending, with at most `limit` entries (1–20, default 5).
 * Empty when no movements match the filters.
 */
export type TopCategoriesResponse = CategoryEntry[];
