# Phase 6 NativeScript renderer hardening

Date: 2026-07-30

## Outcome

Phase 6 introduces `@orikit/renderer-nativescript`, a native-only component
with typed nodes, stable keyed identity, property diffing, event lifecycle,
focus/selection/scroll preservation, accessibility validation, custom native
adapters, path-aware diagnostics, and virtualized-list value reconciliation.

Todo consumes the framework-owned keyed reconciliation. Android text fields
preserve native selection and focus when a controlled value changes and skip
writes when the logical value is already visible.

This is not a shared web/native view AST. That decision remains in Phase 9.

## Automated evidence

`pnpm verify:portable` passed across all ten workspace projects. Eight renderer
tests cover keyed reuse and movement, property diffing, focus, selection,
scroll, event replacement and removal, accessibility, invalid properties,
duplicate keys, and custom adapter disposal.

`pnpm evidence:renderer` reconciled 1,000 successive 101-node trees:

```json
{
  "nodesPerTree": 101,
  "samples": 1000,
  "medianMilliseconds": 0.1035,
  "p95Milliseconds": 0.2804,
  "maximumMilliseconds": 0.9427,
  "budgetMilliseconds": 8,
  "status": "pass"
}
```

This is a Windows structural-host benchmark. Device verification separately
proves actual native behavior.

## Physical Android evidence

`pnpm verify:android:todo:device` passed on Samsung SM-G781B:

- Native `EditText`, `ListView`, and `Button` classes were present.
- No `WebView` was present.
- Add, toggle, edit, and delete passed.
- Text focus remained stable while typing.
- Deleted rows left no stale recycled semantics.
- Accessibility names reflected current row state.
- Canonical trace matched the portable fixture.
- Production runtime remained `Running`.

The verifier now waits for application foreground focus before capturing the
hierarchy, preventing unrelated system overlays from invalidating a run.

## Commands

```text
pnpm verify:portable
pnpm verify:web
pnpm evidence:renderer
pnpm verify:docs
pnpm verify:android:todo:device
```

iOS was not run because this Windows host has no Xcode.
