# 17. Example application strategy

## 17.1 Purpose

Examples are part of the framework specification. They demonstrate canonical
architecture, provide cross-platform conformance tests, teach AI agents the
preferred patterns, and expose missing APIs before those APIs reach production
applications.

The goal is eventually to cover the useful concepts demonstrated by FoldKit's
examples, but not to copy every example immediately or mechanically.

## 17.2 Legal and attribution policy

FoldKit is MIT-licensed, but OriKit is independent.

When adapting source or substantial creative structure from a FoldKit example:

1. Verify the source file is covered by FoldKit's MIT license.
2. Preserve the required copyright and license notice.
3. Add an `ATTRIBUTION.md` entry linking to the original file and revision.
4. Say "adapted from the FoldKit example," not "official FoldKit port."
5. Replace web-only presentation with original native Compose and SwiftUI
   implementations.
6. Avoid copying branding, logos, screenshots, or assets unless their license
   explicitly permits it.

Prefer reimplementing the behavior from its public description and tests when
that communicates OriKit more clearly.

## 17.3 Packaging

Use two forms:

### Example Gallery

One web, Android, and iOS gallery application hosts small examples:

```text
examples/gallery/
├── shared/
│   └── features/
├── web/
├── androidApp/
└── iosApp/
```

Benefits:

- One native project per platform.
- Faster CI and easier device exploration.
- Shared navigation among examples.
- Consistent DevTools and MCP demonstration.

### Standalone examples

Use standalone applications when the example needs:

- Special native entitlements.
- Background modes.
- Push notifications.
- Camera/microphone.
- A separate backend.
- Complex build configuration.
- Embedding in a host application.

## 17.4 Example quality bar

Every example must include:

- A short statement of the capability being taught.
- Shared Model, Messages, update, and Commands.
- At least one Story.
- Web FoldKit view.
- Android Compose view.
- iOS SwiftUI view.
- Stable semantic identifiers.
- Critical shared Scene scenario when appropriate.
- DevTools screenshot or recorded trace after DevTools exists.
- Explanation of intentional platform differences.
- No framework behavior used only in the example without tests.

## 17.5 Wave 0 — bootstrap

### Counter

Teaches:

- Model
- Messages
- Exhaustive update
- Immutable copy
- Story basics
- Three native/web bindings

It is a smoke test, not the architecture proof.

### Todos

Teaches:

- Text input
- Validation
- Lists and stable IDs
- Async loading
- Persistence
- Retry
- Navigation
- Command cancellation
- Full Story and Scene workflow
- Time-travel fixture

Todos is the first vertical architecture proof.

## 17.6 Wave 1 — core architecture

### Multiple counters

FoldKit inspiration: Counters.

Teaches:

- Dynamic child features
- Per-instance identity
- Child Message mapping
- Removing a child
- DevTools feature paths

### Stopwatch

Teaches:

- Timer Subscription
- Model-keyed lifecycle
- Start/stop/reset
- Fake clock
- Travel-mode subscription cancellation

### Form

Teaches:

- Per-field validation
- Async validation Command
- Stale validation result rejection
- Native error accessibility

### Weather

Teaches:

- HTTP Command
- Loading/success/failure/refreshing
- Retry and timeout
- Fake API handler
- Native network-state presentation

### Authentication

Teaches:

- Submodel and OutMessage
- Secure-storage Command
- Session restoration
- Logout cleanup
- Sensitive-value redaction

### Shopping cart

Teaches:

- Nested feature composition
- Derived totals
- Domain validation
- Parent/child events

## 17.7 Wave 2 — runtime behavior

### Crash reporting

Teaches:

- Update defect
- Command defect
- Crash context
- Platform-native fallback UI
- Redacted support export

### Slow warnings

Teaches:

- Update and serialization timing
- Custom thresholds
- DevTools performance events

### Interrupting commands

Teaches:

- `KeepLatest`
- Cancellation
- Upload progress modeled as Subscription when streaming is needed
- Quarantined late completion

### API cache

Teaches:

- Request deduplication
- Stale-while-revalidate
- Refresh intervals
- Cache freshness as shared state

### Managed-resource chat

Teaches:

- WebSocket acquisition/release
- Reconnect policy
- Background/foreground behavior
- Subscription key changes

### Managed resource with dependency layer

Teaches:

- Explicit port construction
- Resource-scoped dependencies
- Test substitution

## 17.8 Wave 3 — routing and complex workflows

### Routing

Teaches:

- Shared typed Route
- Web URL parsing/building
- Android Navigation Compose mapping
- SwiftUI `NavigationStack` mapping
- Back/deep-link parity

### Route transitions

Teaches:

- Entered/left/stayed route facts
- Route-specific Commands
- Native transition differences

### Query synchronization

Teaches:

- Web query parameters
- Android/iOS restoration equivalents
- Filtering and sorting state

### Job application

Teaches:

- Multi-step form
- Cross-field validation
- File-picker native Commands
- Per-step error indicators
- Restoration

### Checkout machine

Teaches:

- Guarded state transitions
- Payment command boundaries
- Idempotency
- Side-effect limitations of time travel

## 17.9 Wave 4 — native integrations

### Map

Use:

- MapLibre or suitable web map
- Google Maps/Mapbox/native Android map
- MapKit or chosen iOS map

Teaches platform-owned views driven by one shared logical map state.

### Charting

Uses platform-appropriate chart libraries and shared data/loading behavior.

### File and media

Teaches:

- Browser file input
- Android Activity Result API
- iOS picker
- Common metadata rather than shared native file handles

### Notifications

Teaches permission flow, scheduling Commands, and deep-link Messages.

### Secure storage

Teaches browser limitations, Android Keystore, and Apple Keychain without
pretending their security models are identical.

## 17.10 Wave 5 — interaction-heavy examples

### Kanban

Teaches:

- Complex reorder behavior
- Keyboard accessibility
- Native drag and drop
- Optimistic persistence

The shared Model owns ordering; gestures are platform-owned.

### Pixel art

Teaches:

- Large grid state
- Pointer/touch input normalization
- Model performance
- Undo/redo versus runtime time travel

### Canvas/generative art

Teaches the boundary between logical Model and high-frequency rendering state.
Do not place every animation frame into the application Model unless the
example intentionally measures that cost.

### Snake

Teaches:

- Frame/timer Subscription
- Input Messages
- Deterministic random seed supplied through flags/messages
- Replayable gameplay

## 17.11 Wave 6 — framework integration

### Embedding

Three host applications embed a OriKit feature:

- Existing FoldKit/TypeScript page
- Existing Android application
- Existing SwiftUI/UIKit application

Teaches flags, ports, outputs, ownership, and disposal.

### Web components

Web-only demonstration of FoldKit custom-element integration. Native versions
show analogous platform-owned component wrappers rather than pretending web
components exist natively.

### Markdown/blog

Web can retain build-time Markdown views. Android and iOS use native rich-text
presentation with shared content metadata and embedded interactive features.

### DevTools and MCP laboratory

Purpose-built app for:

- Message discovery
- Dispatch
- Inspection
- Rewind
- Resume
- Branching
- Redaction
- Replay divergence
- Agent Story execution

## 17.12 FoldKit example mapping

The following known FoldKit examples should be evaluated:

| FoldKit example | OriKit equivalent |
|---|---|
| Counter | Counter |
| Counters | Multiple counters/submodels |
| Todo | Todos vertical slice |
| Stopwatch | Subscription/clock |
| Crash View | Crash reporting |
| Slow Warnings | Runtime metrics |
| Form | Shared validation |
| Job Application | Multi-step native form |
| Weather | HTTP Commands and AsyncData |
| API Cache | Shared cache behavior |
| Charting | Platform chart adapters |
| Routing | Shared Route/native navigation |
| Route Transitions | Route lifecycle facts |
| Interrupting Commands | Command cancellation |
| Query Sync | Route/filter restoration |
| Snake | Deterministic game |
| Map | Native map adapters |
| Auth | Submodel, OutMessage, secrets |
| Shopping Cart | Nested features |
| Checkout Machine | Guarded workflow |
| WebSocket Chat | Managed subscription |
| Managed Resource Layer | Port/resource lifecycle |
| Kanban | Native drag and drop |
| Pixel Art | Grid/performance |
| Canvas Art | High-frequency rendering boundary |
| Generative Art | Rendering-state boundary |
| Web Components | Web-only plus native analogues |
| Embedding | Host handles on all platforms |
| UI Showcase | Platform design-system showcases |
| Personal Blog | Content plus interactive islands |
| Typing Game | Later full-stack stress test |

The list should be refreshed against the FoldKit repository before beginning a
new adaptation.

## 17.13 What not to do

- Do not create 30 separate Xcode and Gradle applications.
- Do not block the core runtime on full example parity.
- Do not force identical pixels across platforms.
- Do not copy FoldKit code without attribution review.
- Do not add a framework primitive solely to make a flashy example easier.
- Do not keep an example that does not test or teach a distinct capability.

## 17.14 Example implementation order

```text
Counter
  ↓
Todos
  ↓
Counters + Stopwatch + Form + Weather
  ↓
Auth + Shopping Cart
  ↓
Crash + Slow + Interrupting Commands
  ↓
Routing + Job Application + Checkout
  ↓
WebSocket + native integrations
  ↓
interaction-heavy examples
  ↓
embedding + DevTools/MCP laboratory
```

After each wave, ask:

1. Did an example reveal a missing invariant?
2. Did native platforms require divergent behavior?
3. Can an AI agent reproduce the pattern?
4. Is the framework API smaller or larger because of the example?
5. Does the example belong in the gallery or standalone?

