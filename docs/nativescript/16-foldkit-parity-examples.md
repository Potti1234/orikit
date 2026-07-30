# 16. Foldkit parity and example strategy

## 16.1 Meaning of parity

Parity means equivalent architectural capability and observable logical
behavior. It does not mean that every browser API or HTML element exists on
mobile.

Statuses:

- **Exact**: portable API and semantics are the same.
- **Adapted**: equivalent behavior through a platform abstraction.
- **Platform-specific**: same Program boundary, separate implementation.
- **Deferred**: planned after the vertical slice.
- **Browser-only**: no honest native equivalent.

## 16.2 Capability matrix

| Foldkit capability | Initial OriKit status | Notes |
|---|---|---|
| Schema Model | Exact target | Effect compatibility must pass |
| Tagged Messages | Exact target | Same schemas |
| Pure update | Exact target | Same function |
| Command naming | Adapted | Description separated from interpreter |
| Story tests | Exact semantic target | Portable implementation |
| HTML view | Web only | Existing Foldkit |
| Native view | New | NativeScript |
| Scene tests | Adapted | HTML Scene + NativeScene |
| Submodels | Exact semantic target | Portable extraction |
| OutMessages | Exact semantic target | Portable extraction |
| Subscriptions | Adapted | Browser/native sources |
| Managed resources | Adapted | Native handles outside Model |
| Routing | Adapted | URL versus native navigation |
| UI components | Platform-specific | Behavior may share, controls differ |
| DOM Mount | Browser-only | Custom native element replaces it |
| Canvas | Platform-specific | Canvas/native graphics |
| File APIs | Platform-specific | Picker/storage capability |
| HTTP | Adapted | Portable command/capability |
| DevTools history | Exact semantic target | Different presentation |
| Time travel | Exact logical target | Native reconciliation |
| DevTools overlay | Web only | Remote inspector for native |
| MCP | Adapted | Inspector relay |
| State-preserving HMR | Deferred | NativeScript Vite + runtime work |

## 16.3 Example order

### Tier 0 — feasibility

1. Counter
2. Async Counter

Proves schemas, update, dispatch, Commands, controls, history.

### Tier 1 — product vertical slice

3. Todo
4. Form validation
5. Weather/HTTP

Proves input, lists, persistence, failure, async behavior.

### Tier 2 — architecture

6. Authentication
7. Shopping Cart
8. Multi-step Job Application
9. API Cache

Proves submodels, OutMessages, nested state, resource policies.

### Tier 3 — platform behavior

10. Navigation
11. Deep links
12. WebSocket Chat
13. Location/permissions
14. File picker

Proves platform capabilities, lifecycle, subscriptions, resources.

### Tier 4 — advanced rendering

15. Kanban
16. Pixel Art
17. Snake
18. UI showcase

Proves gestures, high-frequency events, canvas, custom controls, performance.

## 16.4 Example layout

```text
examples/todos/
├── shared/
│   ├── model.ts
│   ├── message.ts
│   ├── command.ts
│   ├── update.ts
│   ├── program.ts
│   └── story.test.ts
├── web/
│   ├── view.ts
│   └── scene.test.ts
├── native/
│   ├── view.ts
│   ├── native-scene.test.ts
│   └── renderer.test.ts
├── android/
│   └── capability.android.ts
└── ios/
    └── capability.ios.ts
```

## 16.5 Todo requirements

Behavior:

- Load initial Todos.
- Add.
- Edit.
- Toggle complete.
- Delete.
- Filter.
- Persist.
- Failure and retry.

UI:

- Native text input.
- Native virtualized list.
- Stable focus and scroll.
- Accessible buttons/states.
- Native back/navigation if details screen exists.

Tests:

- Stories for every logical branch.
- Web Scene.
- NativeScene.
- Renderer identity.
- Android E2E.
- iOS E2E when available.
- Canonical trace equality.

## 16.6 Browser-specific examples

Examples based on:

- Browser DOM mounting.
- Browser URL details.
- AudioContext.
- RTCPeerConnection.
- Web-specific drag/drop.

must be classified. A native version should demonstrate the equivalent product
capability, not imitate a browser API unnecessarily.

## 16.7 UI component parity

For every component:

```text
Logical state machine:
Messages:
Accessibility semantics:
Web control:
Android control:
iOS control:
Keyboard/touch behavior:
Platform differences:
Time-travel behavior:
```

Do not port the visual implementation before defining these semantics.

## 16.8 Example acceptance

An example is complete only when:

- Its purpose is documented.
- Portable Story passes.
- Every claimed target runs.
- Native claim has view hierarchy evidence.
- Accessibility is tested.
- DevTools shows meaningful Messages/Commands.
- Known platform differences are visible.
- No secret or private data appears in fixtures.
