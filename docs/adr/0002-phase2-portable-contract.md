# ADR-0002: Phase 2 portable Program and Story contract

## Status

Accepted for the experimental Phase 2 API on 2026-07-30.

This ADR does not authorize the Phase 3 renderer, a production runtime,
package publication, or an iOS verification claim.

## Context

The normative Program sketch in
[the portable core plan](../nativescript/03-portable-core-api.md) defines
schemas, `init`, and `update`. Phase 2 also requires a command-completion
contract, executable Story tests, canonical traces, and effect-free replay.
Those pieces need one unambiguous place to obtain the allowed completion
Message tags.

The Foldkit-inspired callback assertion style is useful for arbitrary test
logic, but callbacks cannot produce automatic structural diffs. OriKit's
first AI workflow benefits more from data-shaped exact and partial
expectations with stable property paths.

## Decision

For the Phase 2 experiment:

1. `Program` requires a `commandContract` beside the four schemas.
2. Every Command and completion Message remains a schema-defined tagged value.
3. `Story` begins from decoded Flags or a decoded Model snapshot.
4. Exact and partial Model expectations and exact Command expectations are
   data, not callback assertions.
5. `Story.resolve(command, message)` verifies the first pending Command and
   its allowed completion Message before applying `update`.
6. Story and replay validate Model, Message, and Command boundaries.
7. Traces contain encoded Models, emitted Commands, SHA-256 fingerprints, and
   explicit resolution links.
8. Replay applies recorded Messages but has no interpreter argument and never
   executes Commands.

`commandContract` is the one intentional addition to the Program sketch in
section 3.2. It makes the contract available consistently to Story now and to
the production runtime later.

The Todo code in Phase 2 is a portable test fixture only. It does not begin the
Phase 3 web/native Todo view or a general renderer.

## Consequences

- Invalid completion wiring fails before it can enter `update`.
- Test failures identify paths such as `$.loadState.reason`.
- The same trace can later back time-travel inspection without reacquiring a
  resource.
- Programs with no Commands use `Schema.Never` and an empty contract.
- Completion is currently matched to the first pending structural Command.
  Phase 4 must add command IDs before concurrent production effects.
- Callback assertions may be added later as a convenience, but they must not
  replace structural expectations in canonical examples.

## Alternatives considered

### Pass the contract separately to every Story and runtime

Rejected because it allows different clients to use different completion
rules for the same Program.

### Infer completions only from Message naming

Rejected because naming is not a correctness boundary and cannot express
multiple valid success/failure outcomes reliably.

### Execute a fake interpreter during replay

Rejected because replay must be safe, deterministic, offline, and unable to
reacquire native resources.

