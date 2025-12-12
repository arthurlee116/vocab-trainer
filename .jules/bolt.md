## 2025-02-24 - Hooks and Early Returns
**Learning:** When optimizing React components by moving `useMemo`/`useCallback` hooks, be extremely careful with early returns. If a component conditionally returns `null` when data is missing, moving hooks above this return requires the hooks to handle `undefined` data gracefully. Failing to do so causes "Cannot read property of null/undefined" crashes.
**Action:** When moving hooks above a guard clause, explicitly check for the missing data inside the hook or provide a fallback value immediately.
