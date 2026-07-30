# 7. DevTools and cross-platform time travel

## 7.1 Purpose

DevTools must answer:

- What Message was dispatched?
- What Model changed?
- Which Commands were requested?
- Which command produced this completion?
- Which subscriptions started or stopped?
- Why did the runtime crash or become slow?
- Can this behavior be replayed without touching external systems?

The protocol is shared. Each platform may present it differently.

## 7.2 Event record

```kotlin
@Serializable
data class EventRecord(
    val program: ProgramIdentity,
    val sessionId: SessionId,
    val branchId: BranchId,
    val sequence: Long,
    val timestamp: Instant?,
    val source: EventSource,
    val message: EncodedValue,
    val modelBeforeFingerprint: String,
    val modelAfter: EncodedValue?,
    val modelAfterFingerprint: String,
    val commands: List<RecordedCommand>,
    val subscriptionChanges: List<SubscriptionChange>,
    val updateDurationMicros: Long?,
    val tags: Map<String, String>,
)
```

`timestamp` is observation metadata and must not affect replay. `modelAfter`
may be omitted between snapshots in compact mode.

Event sources:

```text
User
Command(commandId)
Subscription(subscriptionId)
PlatformLifecycle
DevTools
Initialization
```

## 7.3 Snapshots

```kotlin
@Serializable
data class ModelSnapshot(
    val program: ProgramIdentity,
    val sessionId: SessionId,
    val branchId: BranchId,
    val sequence: Long,
    val model: EncodedValue,
    val fingerprint: String,
)
```

Default development policy:

- Full snapshot at initialization.
- Full snapshot every 50 Messages.
- Store each Message and Command description.
- Optionally store every resulting Model for easier inspection.
- Keep a configurable in-memory event limit.

Production policy defaults to disabled or aggressively redacted.

## 7.4 Canonical encoding

Time travel depends on stable serialization.

Requirements:

- Explicit discriminator for sealed types.
- Stable field names.
- No map-order dependence in fingerprints.
- No native pointers or identity-based values.
- Version included in every export.
- Defined treatment for defaults and unknown fields.

Initial format:

- JSON for inspection/export.
- SHA-256 of canonical JSON for fingerprints.
- In-memory typed Model remains authoritative during live execution.

Do not use a Kotlin object's ordinary `hashCode()` for replay integrity.

## 7.5 Runtime modes

```text
LIVE
  ├── travel(cursor) ──> TRAVELING
  └── crash ──────────> CRASHED

TRAVELING
  ├── move(cursor) ───> TRAVELING
  ├── resumeLive ─────> LIVE
  ├── branch ─────────> LIVE on new branch
  └── dispose ────────> DISPOSED
```

### Live mode

- Normal dispatch, commands, and subscriptions operate.
- Runtime records events.
- `liveHeadModel` tracks the newest committed Model.

### Entering travel mode

Atomically:

1. Mark status `Traveling`.
2. Capture current live head and sequence.
3. Pause UI-visible live Model publication.
4. Cancel or quarantine subscriptions.
5. Apply the configured active-command policy.
6. Reconstruct the selected historical Model.
7. Publish that Model as the inspection Model.

Default active-command policy is **cancel when possible, quarantine all late
results**.

### Moving within history

To reconstruct sequence `N`:

1. Find the latest compatible snapshot `S <= N`.
2. Decode the snapshot Model.
3. Apply recorded Messages from `S + 1` through `N` by calling update.
4. Compare each produced Model fingerprint and Command description with the
   record.
5. Stop with a replay-divergence error on mismatch.
6. Never execute produced Commands.
7. Publish the reconstructed Model.

For short histories, cached Models may make cursor movement immediate.

### Resume live

Default non-branching behavior:

1. Stop publishing the inspection Model.
2. Restore the captured live-head Model.
3. Clear quarantined late results.
4. Reconcile subscriptions from live-head state.
5. Set status to `Running`.
6. Continue with the original branch.

No historical mutation affects the live head.

### Branch

Branching means:

1. Select historical Model at cursor.
2. Allocate a new Branch ID.
3. Make that Model the new live head.
4. Cancel old branch work.
5. Reconcile subscriptions for the branched Model.
6. Allow new Messages and Commands.
7. Preserve parent branch metadata.

Branching can repeat external writes if the user dispatches new events. It
must be a deliberate DevTools action and visibly marked.

## 7.6 Late native callbacks

Problem:

1. A camera/payment/location operation starts.
2. User enters travel mode.
3. Native SDK later invokes completion.

Solution:

- Every command completion carries `commandId`, `sessionId`, and `branchId`.
- Runtime accepts it only if the command is still active for the current live
  branch.
- Otherwise it records `QuarantinedCompletion` and does not dispatch.

This rule is mandatory across web, Android, and iOS.

## 7.7 Subscription behavior during travel

Default:

- Cancel live subscriptions on entering travel mode.
- Never start historical subscriptions during reconstruction.
- Reconcile from the live Model on resume.
- Reconcile from historical Model only when explicitly branching.

This prevents sockets, sensors, timers, and location streams from changing the
inspection state.

## 7.8 Command behavior during replay

Replay calls update and compares the returned Commands to recorded Commands,
but it never hands them to a handler.

Command equality for replay uses canonical encoded value, not object identity.

Nondeterministic command IDs are runtime metadata and excluded from semantic
comparison. The command description and order must match.

## 7.9 Model redaction

DevTools must support generated or configured redaction:

```kotlin
@Sensitive
val accessToken: String
```

Redaction occurs before:

- Event persistence
- DevTools transport
- MCP output
- Export files
- Crash reports

The live typed Model is not modified. Fingerprints should be computed from
unredacted canonical values in memory, while exported fingerprints may use a
separate redacted fingerprint. Document which is shown.

## 7.10 History storage

Start with:

- In-memory ring buffer
- Configurable event and byte limits
- Full development export to a file selected by the user
- No automatic production persistence

Later:

- Browser IndexedDB adapter
- Android encrypted/debug file adapter
- iOS debug document adapter
- Remote inspector transport

When evicting history, retain the newest snapshot at or before the first kept
event so replay remains valid.

## 7.11 DevTools protocol

Transport-independent request types:

```text
GetRuntimeInfo
GetCurrentModel
ListEvents(after, limit, branch)
GetEvent(sequence)
GetSchema(kind)
TravelTo(sequence)
ResumeLive
CreateBranch(sequence)
DispatchMessage(encodedMessage)
ExportHistory
ClearHistory
```

Every mutating DevTools request includes the current session ID and expected
runtime mode to prevent stale commands.

## 7.12 Platform presentation

Web:

- FoldKit overlay and MCP relay.
- Model tree, Message list, diff, command status.

Android:

- Debug-only Compose activity or desktop inspector connection.
- Optional shake/developer-menu entry.

iOS:

- Debug-only SwiftUI sheet or desktop inspector connection.
- Optional launch argument to enable.

The shared protocol and history semantics remain identical.

## 7.13 MCP safety

MCP server:

- Binds to loopback by default.
- Requires explicit development enablement.
- Publishes Message schemas.
- Validates every dispatch.
- Redacts sensitive values.
- Refuses production attachment unless explicitly configured.
- Distinguishes read-only inspection from mutating operations.

Suggested tools:

```text
orikit.runtime_info
orikit.current_model
orikit.list_events
orikit.get_event
orikit.message_schema
orikit.dispatch
orikit.travel_to
orikit.resume_live
orikit.branch_from
orikit.run_story
```

## 7.14 Replay limitations shown to users

Time travel restores logical application state. It does not reverse:

- Network writes
- Payments
- Notifications already delivered
- Files already written
- Camera or microphone side effects
- Native navigation animations
- External system changes

The UI must say "inspect/replay state," not imply external reality was undone.

## 7.15 Verification vectors

Maintain a checked-in replay fixture:

```text
fixture ID: todos-load-add-delete-v1
initial flags
initial model fingerprint
12 messages
7 commands
3 snapshots
expected final fingerprint
```

Run it on JS, JVM, Android, and iOS. A target passes only if Models and
Commands match at every sequence.

