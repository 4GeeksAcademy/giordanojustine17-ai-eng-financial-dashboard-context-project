# Phase 3: Component Specifications

This document specifies three React components for the financial dashboard's Phase 3 feature set:
1. Date-range filtering with one-sided filtering support
2. Spending anomaly alerts with threshold and grouping controls
3. Top income categories comparison between B2B and B2C segments

All components follow frontend engineering rules (Rule 5: loading/error/empty states; Rule 4: explicit TypeScript interfaces; Rule 6: CSS custom properties for theming).

**Specification date:** November 17, 2026  
**Reuses:** `frontend/specs/api-types.ts`, `frontend/specs/param-types.ts`

---

## Component 1: DateRangeFilter

**File:** `frontend/src/components/dashboard/date-range-filter.tsx`  
**Export:** `export function DateRangeFilter(...)`  
**Domain:** Dashboard feature component (`frontend/src/components/dashboard/`)

### Props Interface

```typescript
interface DateRangeFilterProps {
  /**
   * Currently selected start date, ISO 8601 format (YYYY-MM-DD).
   * Undefined means "from earliest date in dataset".
   */
  start_date?: string;

  /**
   * Currently selected end date, ISO 8601 format (YYYY-MM-DD).
   * Undefined means "to latest date in dataset".
   */
  end_date?: string;

  /**
   * Earliest available date in the dataset, from GET /api/metrics/facets response.
   * Used to set the minimum selectable date.
   */
  min_date?: string;

  /**
   * Latest available date in the dataset, from GET /api/metrics/facets response.
   * Used to set the maximum selectable date.
   */
  max_date?: string;

  /**
   * Callback fired when user changes the date range.
   * Parent component receives a DateRangeFilter object (may have start_date, end_date, or both undefined).
   */
  onFilterChange: (params: DateRangeFilter) => void;
}
```

### Behavior

- **Layout:**
  - Two optional input fields: "Start Date" and "End Date"
  - Each input accepts ISO 8601 format (YYYY-MM-DD) or remains empty
  - "Clear Filters" button to reset both to undefined
  - Flexbox row on desktop, stack on mobile

- **One-sided filtering:**
  - User can set start-only (end undefined), end-only (start undefined), both, or neither
  - No requirement that both be filled; each is independently optional
  - Support enables queries like "all transactions from 2026-01-01 onwards" or "up to 2026-12-31"

- **Validation on change:**
  - If both dates provided and `start_date > end_date`: show inline error "Start date must not be after end date"
  - Prevent firing `onFilterChange()` callback if validation fails
  - Clear error message when user corrects the range

- **Date bounds:**
  - Apply `min_date` independently as the minimum input bound whenever it is provided.
  - Apply `max_date` independently as the maximum input bound whenever it is provided.
  - If only one bound is provided, enforce that bound; do not disable both constraints.
  - If neither bound is provided, allow any date.
  - Use HTML5 input constraints or custom validation

- **Callback contract:**
  - Fire `onFilterChange()` on valid change with `DateRangeFilter` object
  - Object may have `start_date`, `end_date`, or both undefined
  - Parent component responsible for fetching fresh data

### Conditional Rendering

- **Always rendered:** Control inputs and "Clear Filters" button
- **Error state (validation failure):** Inline error message below date fields
- **No loading/error/empty states:** This is a control component, not data-fetching

### API Contracts

This component does not make API calls. It passes `DateRangeFilter` to parent, which uses it in:
- `GET /api/metrics/alerts?start_date={start_date}&end_date={end_date}&...`
- `GET /api/metrics/categories/top?start_date={start_date}&end_date={end_date}&...`
- `GET /api/metrics/summary?start_date={start_date}&end_date={end_date}&...`

### Edge Cases

- **Both dates undefined:** Represents "no filter"; parent should query full dataset
- **start_date === end_date:** Valid; queries single day
- **Date format invalid (user types "2026-13-01"):** Show validation error; do not call callback
- **min_date/max_date undefined:** No constraints; user can enter any date
- **min_date > max_date in props:** Treat as invalid data from parent; document as bug in parent
- **Only one date bound provided:** Enforce the provided bound independently; the missing bound is unconstrained

---

## Component 2: AnomalyAlerts

**File:** `frontend/src/components/dashboard/anomaly-alerts.tsx`  
**Export:** `export function AnomalyAlerts(...)`  
**Domain:** Dashboard feature component (`frontend/src/components/dashboard/`)

### Props Interface

```typescript
interface AnomalyAlertsProps {
  /**
   * Array of AlertEntry objects from GET /api/metrics/alerts response.
   * Empty array means no alerts matched the threshold and filters.
   */
  alerts: AlertEntry[];

  /**
   * Whether data is currently being fetched.
   * When true, render Skeleton placeholders instead of alert list.
   */
  loading?: boolean;

  /**
   * Error message if the API request failed or validation failed.
   * When present, render error state instead of data.
   */
  error?: string;

  /**
   * Current query parameters used to fetch alerts (threshold, group_by, business_type, date range).
   * Used to populate control UI and document which filters are active, including current start_date/end_date.
   */
  params: AlertsParams;

  /** Earliest selectable date from the parent/facets context; passed to DateRangeFilter independently. */
  min_date?: string;

  /** Latest selectable date from the parent/facets context; passed to DateRangeFilter independently. */
  max_date?: string;

  /**
   * Callback fired when user changes the threshold value.
   * Frontend enforces 0.01–1.0 range (strict, not negotiable).
   */
  onThresholdChange: (threshold: number) => void;

  /**
   * Callback fired when user changes the grouping period.
   */
  onGroupByChange: (groupBy: GroupBy) => void;

  /**
   * Callback fired when user changes date filters.
   */
  onDateRangeChange: (params: DateRangeFilter) => void;

  /**
   * Optional: callback when user changes business_type filter.
   */
  onBusinessTypeChange?: (businessType: BusinessType | undefined) => void;
}
```

### Behavior

#### Control Panel (above alert list)
- **Threshold input:**
  - Numeric input or horizontal slider, 0.01–1.0, default 0.3
  - Frontend enforces min 0.01, max 1.0 (strict range, independent of backend's ≥ 0 acceptance)
  - Explanation text: "0.3 = alert when spending exceeds baseline by >30%"
  - On change, call `onThresholdChange(newThreshold)`

- **Grouping selector:**
  - Radio buttons or dropdown: "Day" / "Week" / "Month"
  - Default: value from `params.group_by`
  - Shows period format example: "Day: 2026-01-15, Week: 2026-W03, Month: 2026-01"
  - On change, call `onGroupByChange(groupBy)`

- **Date range controls:**
  - Embed or reference DateRangeFilter component
  - Pass current `params.start_date` and `params.end_date`, plus `min_date` and `max_date` from the parent context
  - `params` is the source of the current selected dates; the separate optional bounds constrain available dates
  - On change, call `onDateRangeChange(params)`

- **Business type filter (optional):**
  - If `onBusinessTypeChange` callback is provided: show dropdown (All / B2B / B2C)
  - If callback omitted: hide business type filter
  - On change, call `onBusinessTypeChange(businessType | undefined)`

#### Alert List Display
- **Sort order:** Chronological ascending (earliest period first)

- **Each alert row displays:**
  - **Period:** e.g., "2026-01" (month), "2026-W03" (week), "2026-01-15" (day)
  - **Outcome Total:** formatted currency (e.g., "$5,234.50")
  - **Baseline Average:** formatted currency (e.g., "$4,100.00")
  - **Increase Ratio:** formatted as percentage (e.g., "+30.5%")

- **Visual severity gradient based on `increase_ratio`:**
  - 0.01 < ratio ≤ 0.25: green/neutral styling
  - 0.25 < ratio ≤ 0.50: yellow/warning styling
  - 0.50 < ratio ≤ 1.0: orange/caution styling
  - ratio > 1.0: red/critical styling

#### Baseline Discrepancy Notice
**JSDoc and inline documentation must include:**
```
Backend computes baseline as the average of all preceding periods in the filtered dataset.
The assignment rubric describes using the previous 3 periods; this component displays the 
actual backend calculation. Consumers should understand this difference when interpreting alerts.
```

### Conditional Rendering

- **`loading === true`:**
  - Render control panel (not disabled)
  - Render 5 Skeleton row placeholders below controls
  - Each skeleton: period label skeleton, three number-field skeletons

- **`error` is set and truthy:**
  - Render control panel (not disabled)
  - Below controls, render error state: styled container with "Failed to load anomaly alerts. {error}"
  - Red/warning styling; use card styling from `frontend/src/components/ui/card.tsx`

- **`alerts.length === 0` and `!loading` and `!error`:**
  - Render control panel (not disabled)
  - Below controls, render centered empty state message:
    ```
    No anomalies detected for the current filters and threshold.
    Threshold: {params.threshold}, Grouping: {params.group_by}, Business Type: {params.business_type || "All"}
    ```
  - Muted text styling

- **`alerts.length > 0` and `!loading` and `!error`:**
  - Render control panel + sorted alert list
  - Each alert row with formatting and severity gradient

### API Contracts

**Request:**
```
GET /api/metrics/alerts?threshold={threshold}&group_by={group_by}&start_date={start_date}&end_date={end_date}&business_type={business_type}
```

**Response:**
- Type: `AlertsResponse` (array of `AlertEntry`)
- Schema: `{ period: string, outcome_total: number, baseline_average: number, increase_ratio: number }[]`
- The following example uses `threshold=0.3`; each returned ratio must be strictly greater than 0.3. The 0.2769 sample does not qualify at the default threshold, so it is shown separately as an example for `threshold=0.25`.
- Example:
  ```json
  [
    { "period": "2026-02", "outcome_total": 6500.00, "baseline_average": 4800.00, "increase_ratio": 0.3542 }
  ]
  ```
- With `threshold=0.25`, a response may additionally include `{ "period": "2026-01", "outcome_total": 5234.50, "baseline_average": 4100.00, "increase_ratio": 0.2767 }` (rounded from the supplied totals).

### Edge Cases

- **`threshold === 0.01` (minimum threshold):**
  - Alerts for increases strictly greater than 1% (increase_ratio > 0.01)
  - Backend filters and returns only entries exceeding this threshold
  - Component receives already-filtered list

- **`threshold === 1.0` (maximum threshold):**
  - Alerts for increases strictly greater than 100% (increase_ratio > 1.0)
  - Very few alerts expected; likely none in stable datasets

- **Single period in date range:**
  - No preceding periods; baseline cannot be computed
  - Backend returns empty array
  - Component renders empty state

- **All periods with zero outcome:**
  - `baseline_average === 0` → backend prevents division by zero, returns empty array
  - Component renders empty state

- **Very high `increase_ratio` (e.g., 5.23):**
  - Display as-is without capping (e.g., "+523.0%")
  - Formatting handles display gracefully

- **Date range has no alert-triggering periods:**
  - Empty array returned
  - Component renders empty state with current filter summary

---

## Component 3: IncomeComparison

**File:** `frontend/src/components/dashboard/income-comparison.tsx`  
**Export:** `export function IncomeComparison(...)`  
**Domain:** Dashboard feature component (`frontend/src/components/dashboard/`)

### Props Interface

```typescript
interface IncomeComparisonProps {
  /**
   * Currently selected start date, inclusive, in YYYY-MM-DD format; undefined means no start-date filter.
   * Keep synchronized with the parent-owned date filter.
   */
  start_date?: string;

  /**
   * Currently selected end date, inclusive, in YYYY-MM-DD format; undefined means no end-date filter.
   * Keep synchronized with the parent-owned date filter.
   */
  end_date?: string;

  /**
   * Top 5 income categories for the B2B segment.
   * Retrieved from GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2B
   * Empty array if no B2B income exists or query returned nothing.
   */
  b2bCategories: CategoryEntry[];

  /**
   * Total B2B income across all categories (not just top 5).
   * Retrieved from GET /api/metrics/summary?operation_type=income&business_type=B2B
   * Used to calculate each category's percentage of total B2B income.
   * Must be >= 0; handle 0 without dividing by zero.
   */
  b2bTotal: number;

  /**
   * Top 5 income categories for the B2C segment.
   * Retrieved from GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2C
   * Empty array if no B2C income exists or query returned nothing.
   */
  b2cCategories: CategoryEntry[];

  /**
   * Total B2C income across all categories (not just top 5).
   * Retrieved from GET /api/metrics/summary?operation_type=income&business_type=B2C
   * Used to calculate each category's percentage of total B2C income.
   * Must be >= 0; handle 0 without dividing by zero.
   */
  b2cTotal: number;

  /**
   * Whether data is currently being fetched.
   * When true, render Skeleton placeholders in both columns.
   */
  loading?: boolean;

  /**
   * Error message if any API request failed.
   * When present, render error state instead of category data.
   */
  error?: string;

  /**
   * Optional: callback when user changes date filters.
   * Parent component receives a DateRangeFilter object.
   * If omitted, date filtering controls are hidden.
   */
  onDateRangeChange?: (params: DateRangeFilter) => void;
}
```

### Behavior

#### Layout
- Two side-by-side columns (responsive; stack on mobile)
  - **Left column:** "Top 5 B2B Income"
  - **Right column:** "Top 5 B2C Income"
- Each column equal width on desktop; full width on mobile

#### For Each Segment Column
- **Header:**
  - Title: "Top 5 B2B Income" or "Top 5 B2C Income"
  - Subtitle with segment total: e.g., "Total: $12,345.67"

- **Ranked list (numbered 1–5):**
  - Display format per row:
    ```
    {rank}. {category_name}  {amount}  {percentage}%
    ```
  - Example:
    ```
    1. Sales          $5,234.50  42.5%
    2. Operational    $3,100.00  25.1%
    3. Administrative $2,500.00  20.3%
    4. Suppliers      $1,100.00   8.9%
    5. Others           $411.17   3.3%
    ```

- **Category name formatting:**
  - Capitalize first letter: "Sales", "Suppliers", "Operational", "Administrative", "Others"

- **Amount formatting:**
  - The existing `formatCurrency()` from `frontend/src/lib/financial-utils.ts` formats USD with zero fractional digits (for example, `$5,235`).
  - If displaying cents as in the sample rows is required, use an explicit two-decimal currency format; do not assume the existing helper displays cents.

- **Percentage calculation:**
  ```typescript
  percentage = (category.total_amount / segmentTotal) × 100
  ```
  - Denominator: **full segment total** (from `/api/metrics/summary`), **not** sum of top 5 categories
  - This correctly reflects each category's share of all income
  - **Example:** If total B2B income is $100 and top 5 sum to $95:
    - A category with $10 displays as 10%, not 10/95 = 10.5%
  - **Formatted:** 2 decimal places (e.g., "0.01%", "100.00%")

- **Segment total row** (at bottom of each column):
  - Display: "**Total:** {formatted currency}"
  - Example: "**Total:** $12,345.67"

#### Date Range Controls (optional)
- If `onDateRangeChange` callback is provided: embed DateRangeFilter component or controls above/below comparison
- Pass the current `start_date` and `end_date` props to those controls so they remain synchronized with the parent-owned filter state.
- On change, call `onDateRangeChange(params)`
- If callback omitted: no date controls visible

### Conditional Rendering

- **`loading === true`:**
  - Render two side-by-side Skeleton placeholders
  - Each column:
    - Header skeleton (title + total)
    - 5 row skeletons (rank, category name, amount, percentage)

- **`error` is set and truthy:**
  - Render centered error message spanning both columns
  - Styled container: "Failed to load income comparison. {error}"
  - Red/warning styling; use card styling from `frontend/src/components/ui/card.tsx`

- **`b2bCategories.length === 0 && b2cCategories.length === 0`:**
  - If both totals are zero and both category arrays are empty, render an empty state spanning both columns: "No income data available for the selected period". Do not fabricate zero-value category rows.
  - If both arrays are empty but either total is nonzero, render a no-categories empty state while retaining the reported segment totals; do not invent categories.
  - Muted text styling

- **`b2bCategories.length === 0` only (B2C has data):**
  - Left column: show "No B2B income recorded" placeholder (muted, centered)
  - Right column: render normally with B2C ranked list and total

- **`b2cCategories.length === 0` only (B2B has data):**
  - Right column: show "No B2C income recorded" placeholder (muted, centered)
  - Left column: render normally with B2B ranked list and total

- **`b2bCategories.length > 0 && b2cCategories.length > 0` and `!loading` and `!error`:**
  - Render both columns with ranked lists and totals

### API Contracts

**Requests (parent component must orchestrate):**

| Purpose | Endpoint | Parameters |
|---------|----------|------------|
| B2B top categories | GET /api/metrics/categories/top | `operation_type=income`, `limit=5`, `business_type=B2B`, `start_date?`, `end_date?` |
| B2C top categories | GET /api/metrics/categories/top | `operation_type=income`, `limit=5`, `business_type=B2C`, `start_date?`, `end_date?` |
| B2B income total | GET /api/metrics/summary | `operation_type=income`, `business_type=B2B`, `start_date?`, `end_date?` |
| B2C income total | GET /api/metrics/summary | `operation_type=income`, `business_type=B2C`, `start_date?`, `end_date?` |

**Category response:**
- Type: `TopCategoriesResponse` (array of `CategoryEntry`)
- Schema: `{ category: string, operation_type: "income" | "outcome", total_amount: number }[]`
- The following category values are illustrative examples only, not verified live API data:
  ```json
  [
    { "category": "sales", "operation_type": "income", "total_amount": 5234.50 },
    { "category": "others", "operation_type": "income", "total_amount": 3100.00 }
  ]
  ```

**Summary response:**
- `SummaryParams` is the request query-parameter interface defined in `frontend/specs/param-types.ts`, not a response type.
- Response is a bare array of summary items (backend model `MetricsSummaryItem`); its shape is `{ period: string, income: number, outcome: number, net: number }[]`. No frontend response interface for this summary shape is currently defined in `frontend/specs/api-types.ts`.
- Schema: `{ period: string, income: number, outcome: number, net: number }[]`
- For percentage calculation, sum all `income` fields in the returned array
- The following response data is illustrative, not verified live data:
  ```json
  [
    { "period": "2026-01", "income": 5234.50, "outcome": 0.00, "net": 5234.50 },
    { "period": "2026-02", "income": 7111.17, "outcome": 0.00, "net": 7111.17 }
  ]
  ```
- Component sums: `b2bTotal = 5234.50 + 7111.17 = 12345.67`

### Edge Cases

- **Zero segment total (`b2bTotal === 0` or `b2cTotal === 0`):**
  - If the category array contains entries despite a zero total, display those returned categories with 0.00% (no division by zero) and show the zero total.
  - If the category array is empty, show the segment's empty state; never invent zero-value categories.

- **Fewer than 5 categories returned (backend limit=5 may return fewer):**
  - Display count as-is; no padding
  - Example: B2B has 3 categories, B2C has 5. Left column shows 3 rows, right shows 5 rows.

- **Very small percentages (e.g., 0.01%):**
  - Display with 2 decimal places
  - No rounding to 0% (preserve small but nonzero amounts)
  - Example: "$0.01" at "$100" total = 0.01%

- **Very large amounts (e.g., $999,999,999.99):**
  - Format using currency formatter; ensure no layout break
  - Test responsive behavior

- **Zero-total segment with an empty category array:**
  - Render that segment's empty state; do not synthesize categories or rows with zero amounts.

- **Summary returns multiple periods; component must sum `income` for total:**
  - Parent component responsible for summing
  - Example: If summary returns 12 monthly periods, parent sums all monthly income values to compute `b2bTotal`

---

## Implementation Guidelines

### Imports Required

```typescript
// From spec files (all referenced exports exist)
import { type DateRangeFilter, type AlertsParams, type GroupBy } from "@/specs/param-types";
import { type AlertEntry, type CategoryEntry, type BusinessType } from "@/specs/api-types";

// From existing components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/financial-utils";
```

`formatCurrency` currently formats USD with zero fractional digits (`maximumFractionDigits: 0`); cents-bearing examples require an explicit two-decimal formatter if that display is desired. `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, and `Skeleton` are exported by the cited UI files. `DateRangeFilter`, `AlertsParams`, and `GroupBy` exist in `param-types.ts`; `AlertEntry`, `CategoryEntry`, and `BusinessType` exist in `api-types.ts`. Do not import a `MetricsSummaryItem` response type from the frontend specs; its response shape is documented above, but no matching frontend export currently exists.

### Key Rules to Follow

1. **Rule 1: Named Exports**
   - Export: `export function DateRangeFilter(...)`
   - Export: `export function AnomalyAlerts(...)`
   - Export: `export function IncomeComparison(...)`

2. **Rule 3: Kebab-Case File Names**
   - `date-range-filter.tsx`
   - `anomaly-alerts.tsx`
   - `income-comparison.tsx`

3. **Rule 4: Explicit Props Interfaces**
   - Each component defines its `ComponentNameProps` interface
   - All props documented with JSDoc

4. **Rule 5: Handle Loading, Error, Empty States**
   - DateRangeFilter: control component; validation errors only
   - AnomalyAlerts: loading → Skeleton; error → error message; empty → empty state
   - IncomeComparison: loading → Skeleton; error → error message; empty → empty state

5. **Rule 6: CSS Custom Properties**
  - Use existing custom properties from `frontend/src/index.css`, such as `var(--income-badge)`, `var(--income-badge-fg)`, `var(--outcome-badge)`, `var(--outcome-badge-fg)`, `var(--destructive)`, `var(--muted)`, and `var(--border)`
   - Never hardcode colors

### No API Calls in Components

- All three components are **presentational**
- Parent component (e.g., `App.tsx` or a page container) orchestrates data fetching
- Components accept data as props; parent is responsible for fetching and state management

### Validation and Error Handling

- **DateRangeFilter:** Validate date logic (start ≤ end); show inline error if invalid
- **AnomalyAlerts:** Parent validates threshold 0.01–1.0 range before calling component
- **IncomeComparison:** Parent ensures totals are non-negative; component handles zero gracefully

---

## Summary of Components

| Component | Purpose | Props Count | Callbacks | Stateless? |
|-----------|---------|------------|-----------|------------|
| DateRangeFilter | Date range selection with validation | 5 | 1 | Local validation state only |
| AnomalyAlerts | Display spending anomalies with controls | 10 | 4 (1 optional) | Parent owns data/filters; local input validation allowed |
| IncomeComparison | Compare B2B vs B2C top income categories | 9 | 1 optional | Parent owns data/filters |

Components make no API calls. The parent owns API data and applied filter state and passes those values through props. Components may use local UI state for concerns such as input editing and validation feedback; that local state does not replace the parent as source of truth for fetched data or applied filters.
