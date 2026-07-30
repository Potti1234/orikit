# 8. DevTools, time travel, and MCP

## 8.1 Goals

DevTools must answer:

- Which Message arrived and from where?
- What changed in the Model?
- Which Commands were requested?
- Which completion belongs to which Command?
- Which Subscriptions/resources started or stopped?
- Is the screen live or historical?
- Can the transition be reproduced without executing effects?
- Can an AI agent inspect the same information safely?

## 8.2 Event record

```ts
type EventRecord = Readonly<{
  program: ProgramIdentity
  sessionId: string
  branchId: string
  sequence: number
  observedAt?: string
  source: EventSource
  message: EncodedValue
  modelBeforeFingerprint: string
  modelAfter?: EncodedValue
  modelAfterFingerprint: string
  commands: ReadonlyArray<RecordedCommand>
  subscriptionChanges: ReadonlyArray<SubscriptionChange>
  resourceChanges: ReadonlyArray<ResourceChange>
  updateDurationMicros?: number
  renderDescriptionDurationMicros?: number
}>
```

Observation timestamps do not affect replay.

## 8.3 Snapshots

Default development policy:

- Full initial snapshot.
- Full snapshot every 50 Messages.
- Store each Message and Command description.
- Keep recent Models cached for instant cursor movement.
- Bound memory by events and bytes.

Production recording defaults to disabled. Any enabled production mode must
have redaction and explicit retention.

## 8.4 Runtime heads

The runtime distinguishes:

- `liveHeadModel`: latest committed live state.
- `visibleModel`: state currently rendered.
- `cursor`: selected historical sequence when traveling.

In live mode, both Models are equal.

## 8.5 Foldkit-compatible travel behavior

The initial implementation follows current Foldkit inspection semantics:

1. Selecting history changes `visibleModel`.
2. User interaction with the application is blocked.
3. Live processing may continue in the background.
4. New history entries may arrive.
5. Resume sets `visibleModel` to the current live head.

This differs from the older KMP plan, which cancelled live work during travel.
The selected behavior must be explicit in the UI and covered by tests.

For native operations with unacceptable background behavior, the capability
may implement a stricter policy, but callbacks must always carry branch/session
identity and be quarantinable.

## 8.6 Reconstruction

To reconstruct sequence `N`:

1. Find the latest compatible snapshot `S <= N`.
2. Decode the snapshot Model.
3. Apply Messages from `S + 1` through `N`.
4. Compare Model fingerprints.
5. Compare semantic Command descriptions and order.
6. Never execute Commands or start Subscriptions/resources.
7. Stop on divergence with the first differing path.

## 8.7 Resume

Resume:

1. Stops rendering historical Model.
2. Publishes current `liveHeadModel`.
3. Reconciles the native view and navigation.
4. Clears inspection-only caches as configured.
5. Marks runtime Running.

No historical inspection mutates live state.

## 8.8 Branch

Branching is a deliberate development action:

1. Select historical Model.
2. Create a new branch ID.
3. Make the historical Model the new live head.
4. Cancel or detach work from the old branch.
5. Reconcile Subscriptions/resources.
6. Permit new Messages.

Branching may cause external operations to be requested again. DevTools must
warn before enabling it.

## 8.9 Native presentation

Do not initially build full DevTools twice.

Recommended topology:

```text
Android/iOS debug app
    │ WebSocket
    ▼
desktop/browser inspector
    ├── Message timeline
    ├── Model and diff
    ├── Commands/resources
    ├── travel/resume/branch
    └── MCP relay
```

The mobile app contains a small debug connection panel:

- Inspector enabled/disabled.
- Pairing address/code.
- Connection state.
- Read-only versus mutation mode.
- Clear history.

## 8.10 Transport

Protocol is independent of WebSocket, USB forwarding, or in-process use.

Requests:

```text
GetRuntimeInfo
GetCurrentModel
ListEvents
GetEvent
GetSchema
TravelTo
ResumeLive
CreateBranch
DispatchMessage
ExportHistory
ClearHistory
```

Mutating requests include:

- Expected session ID.
- Expected runtime mode.
- Request nonce.
- Validated schema payload.

## 8.11 MCP tools

Proposed:

```text
orikit.runtime_info
orikit.current_model
orikit.list_events
orikit.get_event
orikit.get_schema
orikit.run_story
orikit.dispatch
orikit.travel_to
orikit.resume
orikit.branch_from
```

Defaults:

- Read-only.
- Development builds only.
- Loopback/local-network binding.
- Explicit pairing.
- Schema validation.
- Redaction before transport.

An AI agent must not obtain arbitrary native API execution through MCP.

## 8.12 Redaction

Sensitive schema annotations or configured paths are redacted before:

- History persistence.
- Remote inspector transport.
- MCP.
- Crash reports.
- Export.
- Logs.

Examples:

- Authentication tokens.
- Passwords.
- Payment data.
- Private messages.
- Precise location.
- Photos and file contents.

The live typed Model is not modified. Redacted exports use a separate
fingerprint namespace so they are not confused with internal replay integrity.

## 8.13 Security

- Debug transport is absent or disabled in release by default.
- Inspector refuses unpaired connections.
- Mutation mode requires an explicit local action.
- No wildcard network binding by default.
- Production enablement requires a separate security review and ADR.
- Export paths are user-selected or application-private.
- Native logs do not print unredacted Messages or Models.

## 8.14 Performance

History recording must be measured separately from update/render time.

Mitigations:

- Configurable event cap.
- Snapshot interval.
- Exclude high-frequency Messages from full history where explicitly marked.
- Lazy Model diffing.
- Redaction only at transport/export boundaries when safe.
- Byte budget and eviction.

Eviction retains a snapshot that makes the first kept event replayable.

## 8.15 Limitations shown to users

Time travel restores logical state. It does not reverse:

- Network or database writes.
- Payments.
- Notifications.
- Files.
- Camera or microphone side effects.
- External application launches.
- Native animations already shown.

Use the phrase “inspect/replay application state,” not “undo reality.”
