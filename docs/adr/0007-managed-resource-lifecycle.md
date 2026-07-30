# ADR-0007: reconcile subscriptions and resources from the live Model

Date: 2026-07-30  
Status: accepted

## Context

OriKit needs Foldkit-compatible ongoing effects for timers, WebSockets, native
sensors, and long-lived handles. These effects cannot live in the serializable
Model, and ordinary Commands are the wrong abstraction because they represent
finite work rather than model-driven lifecycles.

Historical inspection adds a second concern: selecting an old Model must not
acquire duplicate resources or disconnect the live runtime's resources.

## Decision

Define portable `SubscriptionDefinition` and `ResourceDefinition` contracts.
Each has a stable ID and a canonical key derived from the live Model. After
each committed transition, a managed-runtime layer:

1. preserves equal ID/key pairs;
2. stops inactive or removed definitions;
3. stops and starts exactly once when a key changes;
4. acquires and releases opaque resource handles outside the Model;
5. dispatches emissions with ID and generation source metadata; and
6. records starts, preservation, emissions, stops, defects, and bounded
   restart attempts.

Branch replacement restarts managed work under the new branch. Runtime
disposal aborts subscriptions and releases acquired handles idempotently.
Historical travel does not invoke reconciliation because it changes only the
visible Model; live processing and managed resources continue at the live
head.

Timer and WebSocket fixtures accept injected clocks/connectors for deterministic
tests. Android implements the same contract with a narrow Kotlin accelerometer
stream whose native listener never enters the portable Model.

## Consequences

- Unrelated Model changes preserve native and network handles.
- Keys must be canonical serializable values; opaque handles remain host-local.
- Callback emissions can be traced to a resource generation and quarantined
  after abort.
- Defects are visible without unbounded restart loops.
- DevTools protocol version 2 exposes redacted resource state and lifecycle
  changes.
- Subscriptions continue during Foldkit-compatible historical inspection.

## Verification

Portable tests cover preservation, key changes, inactive definitions, causal
emissions, resource release, repeated disposal, defects, restart limits,
timers, WebSockets, and travel. Physical Android verification covers the native
accelerometer, stable generation during travel, and continued live processing.
