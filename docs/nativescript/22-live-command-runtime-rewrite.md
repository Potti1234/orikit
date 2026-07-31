

# 21. Live FoldKit Command runtime rewrite

**Status: completed on Windows, web, and physical Android on 2026-07-31.**
See [the evidence](../evidence/foldkit-live-command-runtime.md). iOS remains
`NOT_RUN`.

## 21.1 Objective

Align the OriKit native runtime boundary with FoldKit's web runtime:

```text
live FoldKit Command
    |- execute the original Effect locally
    `- record only serializable name/args metadata
```

The current compatibility adapter first projects a live FoldKit Command to a
JSON description and then reconstructs an equivalent live Command from a
registry before executing it. That is safe, but reconstruction is unnecessary
for a Command that was just produced in the same JavaScript runtime.

This rewrite must not weaken the existing production-runtime guarantees:

- `update` stays synchronous, deterministic, and effect-free;
- constructing a Command does not execute its Effect;
- Model, Message, history, trace, Story, and replay data stay serializable;
- replay compares Command descriptions but never executes Effects;
- every completion re-enters through the serialized Message queue;
- cancellation interrupts the live Effect where possible;
- session, branch, active-command, and disposed checks quarantine stale work;
- an invalid or unregistered Command fails before its Effect starts.

## 21.2 Current flow

```text
update
  -> live FoldKit Command { name, args, effect }
  -> adapter projects { _tag, name, args }
  -> production runtime schedules description
  -> interpreter looks up registry.make(args)
  -> equivalent live Command is reconstructed
  -> reconstructed Effect executes
```

History is safe, but the original Effect is discarded and the Todo adapter
must maintain factories whose main job is rebuilding it.

## 21.3 Target flow

```text
update
  -> live FoldKit Command { name, args, effect }
  -> adapter validates and pairs:
       recorded: { _tag, name, args }
       execute: original effect
  -> production runtime:
       records `recorded`
       supervises `execute`
```

During replay:

```text
historical Message
  -> update produces live Commands lazily
  -> adapter derives and compares descriptions
  -> Effects are discarded
```

No Effect or native service enters the serializable Program, history, or
replay data.

## 21.4 Boundary types

The generic OriKit runtime continues to own serializable
`CommandDescription` values. A new optional scheduling channel carries an
ephemeral executable alongside the description only for the live transition
that created it:

```ts
type ScheduledCommand<CommandDescription, Message> = Readonly<{
  description: CommandDescription
  execute: (context: CommandContext) => Promise<Message>
}>
```

The runtime event and snapshot types remain parameterized only by
`CommandDescription`. `ScheduledCommand` is never exposed by `events()`,
`snapshot()`, codecs, traces, Story, or DevTools export.

The core runtime API should accept either:

1. its existing `interpret(description, context)` fallback; or
2. an ephemeral executable supplied for a particular live transition.

The fallback remains for existing data-command Programs. FoldKit programs use
the new live scheduling path. This keeps the rewrite bounded and reversible.

## 21.5 FoldKit adapter changes

The FoldKit adapter must:

1. Validate every live Command name against its declared completion contract.
2. Validate its name/args/key as JSON metadata.
3. Produce the same `FoldKitCommandDescription` used by Story and traces.
4. Pair that description with execution of the original `command.effect`.
5. Connect `AbortSignal` to Effect Fiber interruption.
6. Remove `registration.make` from the normal execution path.

Registrations retain only completion tags unless a separately justified
restore-from-description feature is introduced later. Restoring an application
session must restore serializable state, not resume old in-flight Effects.

## 21.6 Commit and scheduling order

For a live Message:

1. Call `update` and receive the new Model plus live Commands.
2. Validate and describe all Commands without executing Effects.
3. Commit the new live Model.
4. Record the Message, Model, and descriptions.
5. Publish the Model.
6. Schedule original Effects in returned order.
7. Dispatch each valid terminal result as a Message.

This matches the existing runtime commit order and FoldKit's important
property that Effects begin only after the transition has committed.

## 21.7 Replay and time travel

Replay continues to use the serializable Program projection. Its update path
may construct lazy FoldKit Commands so their descriptions can be checked, but
it has no scheduling channel and therefore cannot execute their Effects.

Travel only selects a reconstructed historical Model. Resume returns to the
live head. Neither operation executes historical Commands or reverses external
effects.

## 21.8 Failure behavior

- Unknown Command name: reject the live transition before scheduling it.
- Non-JSON args: reject at description projection.
- Effect expected failure: Command maps it to a typed terminal Message.
- Effect defect: use the existing runtime crash policy.
- Invalid terminal Message: completion contract rejects it.
- Cancellation: interrupt the Effect Fiber and retain existing cancellation
  and stale-completion records.
- Replay divergence: report the first differing description; execute nothing.

## 21.9 Files expected to change

- `packages/runtime/src/`: optional per-transition live executable channel.
- `packages/foldkit-runtime-adapter/src/`: live/recorded split.
- `packages/todo/src/program.ts`: completion registry without reconstruction.
- `packages/foldkit-portable-spike/src/`: same adapter API migration.
- focused adapter/runtime/Todo/Story tests.
- benchmark wiring and evidence documentation where types change.

The FoldKit sibling fork should not need implementation changes. FoldKit
already executes original live Commands and records only name/args metadata.

## 21.10 Verification gates

The rewrite passes only if all applicable gates pass:

1. A focused test proves the exact original Effect instance executes once.
2. A focused test proves no Effect executes during Program projection/replay.
3. JSON history contains descriptions and no `effect` property.
4. Cancellation and stale-completion tests remain green.
5. All Todo Stories and canonical traces remain deterministic.
6. Web behavior remains on the normal FoldKit runtime.
7. Android builds and the physical Todo/portable/time-travel device gates pass.
8. The 10,000-Message runtime benchmark remains within its existing gate.
9. iOS remains `NOT_RUN` without macOS/Xcode evidence.

Required commands:

```text
pnpm verify:portable
pnpm verify:web
pnpm evidence:runtime
pnpm verify:android
pnpm verify:android:todo:device
pnpm verify:android:foldkit-portable:device
pnpm verify:android:device
pnpm verify:docs
```

## 21.11 Alternatives rejected for this slice

### Keep reconstruction permanently

Safe but duplicates factories, performs unnecessary work, and differs from
FoldKit's web runtime for locally created Commands.

### Put Effects in history

Rejected. Effects are executable runtime values and violate serialization,
replay, export, and cross-platform trace requirements.

### Persist and resume in-flight Effects

Rejected. Active continuations and native resources are not portable state.
Restoration starts from versioned Model/Flags and may deliberately request new
Commands.

### Replace the entire production runtime with FoldKit runtime

Rejected for this slice. FoldKit runtime is browser-oriented, while the native
runtime already proves lifecycle diagnostics, cancellation, command identity,
bounded history, and stale-callback quarantine.

## 21.12 Reversal

The existing description interpreter remains available to non-FoldKit
Programs. If the live scheduling channel fails a gate, the FoldKit adapter can
return to reconstruction without changing Model, Message, history, Story,
trace, or renderer contracts.




