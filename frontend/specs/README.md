# Phase 4: Feature API and Frontend Integration

This guide describes how the frontend can use the existing metrics API for date-range filtering, spending anomaly alerts, and B2B/B2C top-income comparison. The frontend components are presentational: the parent/page container owns requests, fetched data, and applied filters, then passes them to the components. No API-response interfaces are added here; the TypeScript names below refer only to types already defined in `api-types.ts` and `param-types.ts`.

All dates are ISO 8601 calendar dates (`YYYY-MM-DD`) and date-range endpoints treat supplied bounds as inclusive. Both `start_date` and `end_date` are optional independently: either may be sent alone, both may be sent, or neither may be sent.

---

## 1. Date-range filtering

### Endpoints

- `GET /api/metrics/facets` supplies the dataset's available date range for filter controls.
- `GET /api/metrics` returns matching movements and accepts date filters.
- `GET /api/metrics/alerts`, `GET /api/metrics/categories/top`, and `GET /api/metrics/summary` also accept date filters for the dashboard features below.

### Request parameters

| Parameter | Required | Default | Valid values / behavior |
|---|---:|---|---|
| `start_date` | No | `None` | ISO date (`YYYY-MM-DD`); inclusive lower bound. Omitted means no lower-bound filter. |
| `end_date` | No | `None` | ISO date (`YYYY-MM-DD`); inclusive upper bound. Omitted means no upper-bound filter. |

On `GET /api/metrics`, optional `category` is one of `suppliers`, `sales`, `operational`, `administrative`, `others`, and optional `operation_type` is `income` or `outcome`. These additional filters do not change date-range semantics.

`GET /api/metrics/facets` takes no query parameters. Its response uses the existing `FacetsResponse` type: `operation_types: OperationType[]`, `business_types: BusinessType[]`, `categories: Category[]`, `min_date: string`, and `max_date: string`. The facet dates are the earliest and latest dates in the dataset.

### Response shapes and TypeScript types

- `GET /api/metrics/facets`: `FacetsResponse` (defined in `api-types.ts`), a JSON object containing the distinct filter values and `min_date`/`max_date`.
- `GET /api/metrics`: a JSON array of movement objects. The project does not currently define a frontend API response type for this endpoint in `api-types.ts`; do not assign it a newly invented type in this guide.
- The range itself is represented on the frontend by the existing `DateRangeFilter` interface in `param-types.ts`:

```typescript
interface DateRangeFilter {
  start_date?: string;
  end_date?: string;
}
```

The displayed interface is a summary of the existing export, not a new declaration. `DateRangeFilter` is a query/filter type, not an API response type.

### Frontend use and UI states

Fetch facets to set the minimum and maximum selectable input bounds, then keep the selected range in the parent and pass it to filter controls and any dependent data requests. Apply `min_date` and `max_date` independently: if only one is available, enforce that one bound without requiring the other. Send only selected dates; do not serialize an unset side as a required date. A cleared range sends neither parameter.

The date control itself does not fetch data and has no data-loading, data-error, or data-empty state. It can show a local inline validation error for malformed input or a start date later than the end date and suppress the change callback until corrected. The parent may show loading, error, and empty states for whichever endpoint it refreshes; these should reflect the returned endpoint data rather than fabricate records.

### Edge cases

- Only `start_date` is supplied: return matching records on or after it; no end bound is imposed.
- Only `end_date` is supplied: return matching records on or before it; no start bound is imposed.
- Neither is supplied: do not filter by date.
- Equal start and end dates are valid and select that date (inclusive).
- A well-formed range with no matching movements returns an empty array; show the dependent feature's empty state.
- A start date later than the end date is invalid for the frontend control; show validation and do not apply the change.

---

## 2. Spending anomaly alerts

### Endpoint

`GET /api/metrics/alerts`

### Request parameters

| Parameter | Required | Backend default | Valid values / behavior |
|---|---:|---|---|
| `threshold` | No | `0.3` | Backend accepts numbers `>= 0`. The UI must constrain this to `0.01` through `1.0` inclusive, default `0.3`. A value of `0.3` means alert when outcome is more than 30% above baseline. |
| `group_by` | No | `month` | `day`, `week`, or `month`; controls period aggregation and label format. |
| `start_date` | No | `None` | ISO date, inclusive lower bound. |
| `end_date` | No | `None` | ISO date, inclusive upper bound. |
| `business_type` | No | `None` | `B2B` or `B2C`; omitted means both business types. |

`start_date` and `end_date` are independently optional; one-sided ranges are supported. The UI's threshold range is intentionally stricter than the backend's non-negative constraint.

### Response shape and TypeScript types

The response is a bare JSON array, not an object wrapper. Its existing frontend types in `api-types.ts` are `AlertsResponse` and its element type `AlertEntry`:

```typescript
type AlertsResponse = AlertEntry[];

interface AlertEntry {
  period: string;
  outcome_total: number;
  baseline_average: number;
  increase_ratio: number;
}
```

The `period` uses the selected grouping (`YYYY-MM-DD` for day, ISO `YYYY-Www` for week, or `YYYY-MM` for month). Monetary values are rounded to two decimals; `increase_ratio` is a fraction rounded to four decimals (for example, `0.5` means 50%). Every returned ratio is strictly greater than the requested threshold. `AlertsParams` in `param-types.ts` is the existing request-parameter interface, not a response type.

### Baseline discrepancy

The backend computes each period's baseline as the average outcome of **all preceding periods in the filtered, grouped dataset**, not just the previous three periods. The assignment rubric specifies a previous-three-period baseline, so the backend behavior does not match that rubric requirement. Until the backend is changed, the frontend must accurately present the returned `baseline_average` and should make this discrepancy clear in relevant explanatory/help text; it must not describe the alert as calculated from only the previous three periods.

### Frontend use and UI states

The parent composes the selected date range, threshold, grouping, and optional business type into the request; it passes the returned `AlertEntry[]`, current params, loading/error values, and facet date bounds to the alert view. The alert list is chronological and uses backend-filtered results; an empty result is a valid response, not an API failure.

- **Loading:** retain the controls and show alert-row skeleton placeholders.
- **Error:** retain the controls and show an error message; do not display stale/partial data as the successful result.
- **Empty:** show “No anomalies detected” with the active threshold/grouping/filter context.
- **Data:** display each period, outcome total, baseline average, and percentage increase.

### Edge cases

- A single grouped period has no prior period for comparison, so the backend returns no alert for it; show the empty state if there are no other qualifying periods.
- A zero baseline cannot be divided by; the backend emits no alert for that comparison.
- No period exceeds the threshold: the response is `[]`, and the UI shows the empty state.
- At UI minimum `0.01`, only increases strictly above 1% qualify; at maximum `1.0`, only increases strictly above 100% qualify.
- A date filter may remove all earlier periods needed for a baseline, resulting in no alert even if earlier unfiltered data exists.

---

## 3. Top 5 B2B vs B2C income categories

### Endpoints and requests

For each business type, request top categories and the full income summary using the same optional date range:

| Purpose | Exact request |
|---|---|
| B2B top income categories | `GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2B` plus optional `start_date` and/or `end_date` |
| B2C top income categories | `GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2C` plus optional `start_date` and/or `end_date` |
| B2B full income total by period | `GET /api/metrics/summary?operation_type=income&business_type=B2B` plus optional `start_date` and/or `end_date` |
| B2C full income total by period | `GET /api/metrics/summary?operation_type=income&business_type=B2C` plus optional `start_date` and/or `end_date` |

Top-category calls must explicitly set `operation_type=income` and `limit=5`; the endpoint defaults are `outcome` and `5`, so relying on the operation default would return the wrong data. The categories endpoint's `limit` accepts integers 1–20. Both dates remain optional independently. `business_type` accepts `B2B` or `B2C`.

The summary endpoint's additional `group_by` parameter defaults to `month` and accepts `day`, `week`, or `month`. For this comparison, the parent may use the default; sum all returned `income` values to produce the full-segment denominator for the matching date range and business type.

### Response shapes and TypeScript types

- Top categories returns a bare JSON array, sorted by `total_amount` descending and containing at most the requested limit. Existing frontend types: `TopCategoriesResponse` (`CategoryEntry[]`) and `CategoryEntry` from `api-types.ts`. Each entry has `category: Category`, `operation_type: OperationType`, and `total_amount: number`.
- Summary returns a bare JSON array of backend `MetricsSummaryItem` objects: `{ period: string, income: number, outcome: number, net: number }[]`. The backend Pydantic model is `MetricsSummaryItem` in `backend/app/routes.py`. **There is no corresponding summary response interface in frontend `api-types.ts`.** Do not call `SummaryParams` a response type; it is the existing request-parameter interface in `param-types.ts`.
- The request shapes are described by existing `TopCategoriesParams` and `SummaryParams` in `param-types.ts`. Neither is a response type.

For each category, compute its percentage against the **full income total for that business type**, not against the sum of the returned top five:

```text
percentage = category.total_amount / full_segment_income_total * 100
```

The parent derives `full_segment_income_total` by summing `income` across the matching summary response. Use the same date filter for both category and summary requests so numerator and denominator cover the same data.

### Frontend use and UI states

The parent issues the four requests (or equivalent coordinated requests), associates the response arrays with B2B/B2C, sums each segment's summary `income`, and supplies categories, totals, and request state to the comparison view. The view displays up to five ranked rows for each segment and calculates percentages from the supplied full totals.

- **Loading:** show two column skeletons while required comparison data is pending.
- **Error:** show a comparison-level error if a required category or summary request fails; do not imply partial results are a complete comparison.
- **Empty:** if no categories are returned, show an empty message for that segment and retain any known total. If both segments have no categories and totals are zero, show the overall no-income state. Do not invent zero-value categories.
- **Data:** display each segment's categories, full income total, and category percentages.

### Edge cases

- Fewer than five matching categories: display only the categories returned; do not pad the list.
- A segment has no matching income: categories may be `[]` and its total is zero; show the segment/overall empty state rather than fabricated categories.
- A category list is empty but its summary total is nonzero: retain the reported total and show that no categories were returned; do not invent rows.
- A zero full-segment total: avoid division by zero. If the API nevertheless supplies category entries, display them with a safe zero percentage and the zero total; otherwise show the empty state.
- More than one summary period is returned: sum every `income` value before computing category percentages.
- Date filters differ between the categories and summary requests: the numerator and denominator would be inconsistent; the parent must keep them identical.
