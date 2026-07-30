# Phase 8 subscriptions and managed resources

Date: 2026-07-30

## Outcome

Phase 8 adds model-driven subscription and managed-resource lifecycles to the
production runtime. Portable definitions use stable IDs and canonical keys;
native/browser hosts provide the actual acquisition boundary. Emitted Messages
carry resource ID and generation metadata through the normal runtime queue.

The implementation includes deterministic timer and WebSocket fixtures,
bounded defect restart policy, branch replacement, idempotent disposal, and a
Kotlin accelerometer stream on Android. Todo stores sampled acceleration in its
portable Model and renders it with native controls. Sampling is throttled to a
two-second evidence cadence to avoid unnecessary UI and history churn.

DevTools protocol version 2 carries current resources and per-transition
lifecycle changes. The inspector displays starts, preservation, emissions,
stops, failures, restart scheduling, and active resource generations. Resource
keys and configured fields are redacted before transport/export.

## Automated evidence

`pnpm verify:portable` passed across all workspace packages. The runtime suite
now covers:

- equal-key preservation;
- exactly one restart for a key change;
- inactive subscription cancellation;
- exact-once resource release and repeated disposal;
- causal subscription source metadata;
- bounded defect restart;
- deterministic timer cancellation; and
- WebSocket connection, message emission, and close.

The DevTools suite proves lifecycle recording, resource redaction, and that
travel/resume does not restart a managed subscription. Web, inspector, renderer
benchmark, and documentation gates also pass.

## Physical Android evidence

The connected Samsung SM-G781B running Android 13 reported
`android.accelerometer` as an active managed Subscription. The Phase 8 remote
verifier observed `MotionObserved` transitions with this causal source, entered
historical mode, observed the live sequence continue advancing, resumed, and
confirmed that the resource remained on generation 1 throughout.

The existing physical Todo verifier also passed native control detection, the
complete add/toggle/edit/delete flow, focus stability, recycled-row semantics,
canonical trace parity, and production runtime health with the sensor active.

A disposable local signing key produced a successful release APK. The
optimized bundle retains `MotionSensorStream` because the product resource is
not debug-only, while the relay path, pairing marker, and debug WebSocket client
are absent. The temporary signing key was deleted after verification.

Commands:

```text
pnpm verify:portable
pnpm verify:web
pnpm verify:inspector
pnpm evidence:renderer
pnpm verify:docs
pnpm verify:android:todo:device
pnpm exec tsx tools/phase8/verify-managed-android.mts <pairing-code>
```

## Time-travel semantics

The selected historical Model is presentation-only. Live Messages, Commands,
subscriptions, and resources continue on the live head. Application UI dispatch
remains blocked while traveling. Resume renders the current live Model. Replay
never starts a timer, socket, sensor, or resource.

## Deferred

iOS resource integration remains unverified until the macOS/Xcode phase. The
web/native view-sharing decision belongs to Phase 9.
