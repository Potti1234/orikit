# ADR-0005: harden a native-only renderer before deciding view sharing

Date: 2026-07-30  
Status: accepted

## Context and evidence

The Todo slice proved separate Foldkit web and NativeScript views, but keyed
collection logic and state-preservation rules lived inside the application.
Phase 6 needs reusable renderer behavior without prematurely claiming that
one view language should serve both web and native targets.

## Decision

Create `@orikit/renderer-nativescript` as a native-only renderer contract. Its
nodes describe NativeScript control kinds, properties, events, accessibility,
keys, and isolated custom elements. It is not imported by portable Programs
and is not a renderer-neutral web/native AST.

The renderer depends on a structural native host interface. Native handles
remain inside the host while deterministic contract tests run on Windows.
Todo adopts framework-owned keyed virtualized-value reconciliation and
Android text-state preservation immediately.

The view-sharing decision remains deferred to Phase 9.

## Consequences

- Key identity, property diffing, events, disposal, accessibility validation,
  custom adapters, and diagnostics have one tested contract.
- Focus, selection, and scroll stay renderer-local and outside the Model.
- Existing NativeScript XML remains valid while renderer-managed trees can
  adopt `NativeNode` incrementally.
- Kotlin/Swift-backed views require explicit create, update, and dispose
  adapter operations.

## Verification

The renderer suite, benchmark, portable suite, Android build, and physical
Todo device verifier must pass.
