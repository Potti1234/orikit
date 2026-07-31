

# 22. NativeScript framework-adapter study

**Status:** research complete on 2026-07-31. This document records design
input for the bounded renderer experiment in [document 23](24-foldkit-nativescript-renderer-plan.md).
It does not authorize adding Vue, Angular, React, Svelte, or Solid to
OriKit.

## 22.1 Question

NativeScript supports several TypeScript UI frameworks through adapters. They
solve a problem similar to OriKit's remaining renderer problem:

```text
declarative framework view
        -> framework reconciliation
        -> NativeScript host operations
        -> real Android/iOS controls
```

The research question is which host-adapter techniques can be reused while
preserving FoldKit's Elm architecture, deterministic runtime, Story tests,
serializable history, and effect-free replay.

## 22.2 Conclusion

The adapter family validates the planned direction and exposes a smaller path
than building a reconciler from scratch:

1. FoldKit already owns a tested Snabbdom VNode differ.
2. FoldKit's patch initializer already accepts a replaceable `DOMAPI` host.
3. A NativeScript host can implement the same small create/insert/remove/text
   surface used by NativeScript-Vue.
4. NativeScript is not one ordinary visual tree. A separate logical node tree,
   element metadata, property children, invisible anchors, and special list
   handling are still required.
5. Web should continue using `foldkit/html`; native should use a native builder
   and native element vocabulary. Translating arbitrary HTML to native controls
   would weaken native semantics and is not part of this experiment.

The recommended shape is therefore:

```text
FoldKit Program + runtime semantics
               |
        native view function
               |
       FoldKit VNode/reconciler
               |
   OriKit NativeScript host
               |
     UIKit / Android View tree
```

## 22.3 Research snapshot

Source revisions were recorded so a later agent can distinguish the studied
code from later upstream changes.

| Project | Revision studied | Relevant role |
|---|---|---|
| FoldKit | `c826cdbc033cffd49442cd7248806742cc871d39` plus the local portable-kernel changes | VNode, Snabbdom patcher, HTML builder, event modules |
| NativeScript-Vue | `7cba9651cfff27d9819cafe76f67e09bfd19fdbe` | Small custom renderer, registry, events, `ListView` |
| NativeScript Angular | `780e666bc915cd13fedd97a58a9f14d067195a4c` | Mature logical/visual tree and insertion rules |
| React NativeScript | `d551a171e279bde27d696a048efe37daf0ece19b` | React host config reusing Vue-style node wrappers |
| Svelte Native | `c267e748844db3258c0b66fda684ade56a7e2cbf` | DOM facade, property nodes, platform attributes |
| NativeScript Solid | `6b9a815a26014c4adab6f85fbfae2865975bfb31` | DOM-compatible host and native event limitations |
| NativeScript core | `6982b5f3dc3f50aa59d9f244968d3397eac09903` | Native UI runtime and element classes |

The versions are research anchors, not new dependency pins. Implementation
must record the actual revisions used in its evidence document.

## 22.4 NativeScript-Vue lessons

Vue 3 provides a custom renderer contract. NativeScript-Vue implements a small
set of node operations:

```ts
createElement(type)
insert(child, parent, anchor)
remove(node)
createText(text)
createComment(text)
setText(node, text)
parentNode(node)
nextSibling(node)
patchProp(node, key, previous, next)
```

Useful patterns:

- Keep creation/tree operations separate from property patching.
- Normalize element names through a registry.
- Resolve classes lazily so unused NativeScript views need not load.
- Store per-element metadata for nonstandard insertion and value binding.
- Dispatch properties, class, style, and events to separate patch modules.
- Keep one stable native event listener and replace its current callback when
  the logical handler changes.
- Describe two-way values as `{ prop, event }` metadata because `TextField`,
  `Switch`, `Slider`, and custom controls do not share one change protocol.
- Treat `ListView` as a special renderer component. It manages realized and
  recycled cell roots instead of behaving like a normal layout child list.

Primary source:

- [renderer node operations](https://github.com/nativescript-vue/nativescript-vue/blob/7cba9651cfff27d9819cafe76f67e09bfd19fdbe/src/renderer/nodeOps.ts)
- [property dispatcher](https://github.com/nativescript-vue/nativescript-vue/blob/7cba9651cfff27d9819cafe76f67e09bfd19fdbe/src/renderer/patchProp.ts)
- [stable event invokers](https://github.com/nativescript-vue/nativescript-vue/blob/7cba9651cfff27d9819cafe76f67e09bfd19fdbe/src/renderer/modules/events.ts)
- [element registry](https://github.com/nativescript-vue/nativescript-vue/blob/7cba9651cfff27d9819cafe76f67e09bfd19fdbe/src/registry/index.ts)
- [virtualized ListView component](https://github.com/nativescript-vue/nativescript-vue/blob/7cba9651cfff27d9819cafe76f67e09bfd19fdbe/src/components/ListView.ts)

## 22.5 NativeScript Angular lessons

Angular's renderer keeps a logical sibling tree even when some nodes have no
native visual representation. Text nodes and comment nodes participate in
ordering but may be invisible. `ViewUtil` then projects logical operations to
the actual NativeScript hierarchy.

Its insertion behavior distinguishes:

- ordinary `LayoutBase` children;
- single-content views;
- builder/property children;
- detached elements;
- invisible comment and text nodes;
- element-specific metadata hooks.

This is the strongest evidence against storing only native `View.parent` and
native child indexes. OriKit needs logical `parentNode`, `firstChild`,
`lastChild`, `previousSibling`, and `nextSibling` relationships even where a
node is not attached visually.

Primary source:

- [NativeScript renderer](https://github.com/NativeScript/angular/blob/780e666bc915cd13fedd97a58a9f14d067195a4c/packages/angular/src/lib/nativescript-renderer.ts)
- [logical and visual tree utility](https://github.com/NativeScript/angular/blob/780e666bc915cd13fedd97a58a9f14d067195a4c/packages/angular/src/lib/view-util.ts)
- [invisible text and comment nodes](https://github.com/NativeScript/angular/blob/780e666bc915cd13fedd97a58a9f14d067195a4c/packages/angular/src/lib/views/invisible-nodes.ts)
- [element registry](https://github.com/NativeScript/angular/tree/780e666bc915cd13fedd97a58a9f14d067195a4c/packages/angular/src/lib/element-registry)

## 22.6 Svelte Native lessons

Svelte has historically been adapted through a small DOM facade. Svelte Native
explicitly credits the NativeScript-Vue DOM implementation and defines:

- `ViewNode` for logical parent/child/sibling state;
- `ElementNode` and `NativeElementNode` wrappers;
- text and comment nodes;
- `PropertyNode` for relationships that are assignments rather than visual
  children;
- a registry for native element construction;
- `ios:` and `android:` property filters;
- `prop:` placement for values such as drawer content.

Property nodes are relevant for NativeScript relationships such as a Page's
ActionBar, tab items, formatted strings, drawer content, and plugin-specific
configuration collections.

Primary source:

- [Svelte Native project and architecture](https://github.com/nativescript-community/svelte-native/tree/c267e748844db3258c0b66fda684ade56a7e2cbf)
- [logical ViewNode](https://github.com/nativescript-community/svelte-native/blob/c267e748844db3258c0b66fda684ade56a7e2cbf/src/dom/basicdom/ViewNode.ts)
- [native element wrapper](https://github.com/nativescript-community/svelte-native/blob/c267e748844db3258c0b66fda684ade56a7e2cbf/src/dom/native/NativeElementNode.ts)
- [property node](https://github.com/nativescript-community/svelte-native/blob/c267e748844db3258c0b66fda684ade56a7e2cbf/src/dom/basicdom/PropertyNode.ts)

## 22.7 React NativeScript lessons

React NativeScript demonstrates that the host layer can be shared across
framework renderers. Its repository contains Vue-derived NativeScript node and
registry code below the React reconciler.

The useful lesson is the host abstraction, not React itself. Depending on
React's reconciler would add a second state/rendering framework and violate
accepted decision D2. OriKit should keep FoldKit's own VNodes and patcher.

Primary source:

- [React NativeScript repository](https://github.com/shirakaba/react-nativescript/tree/d551a171e279bde27d696a048efe37daf0ece19b)
- [host node operations](https://github.com/shirakaba/react-nativescript/blob/d551a171e279bde27d696a048efe37daf0ece19b/react-nativescript/src/nativescript-vue-next/runtime/nodeOps.ts)
- [host nodes](https://github.com/shirakaba/react-nativescript/blob/d551a171e279bde27d696a048efe37daf0ece19b/react-nativescript/src/nativescript-vue-next/runtime/nodes.ts)

## 22.8 NativeScript Solid lessons

The Solid integration uses a DOM-compatible layer and documents two native
event facts that OriKit must model explicitly:

1. NativeScript event names are case-sensitive.
2. Native events do not provide ordinary browser event bubbling, so browser
   delegation assumptions do not hold.

The native builder should consequently expose typed native event factories
such as `OnTap`, `OnTextChange`, and `OnReturnPress` instead of accepting an
arbitrary browser `Event` contract.

Primary source:

- [NativeScript Solid renderer and event caveats](https://github.com/nativescript-community/solid-js/tree/6b9a815a26014c4adab6f85fbfae2865975bfb31)

## 22.9 FoldKit seams already available

FoldKit's Snabbdom initializer accepts a `DOMAPI`. It already owns:

- VNode identity and keys;
- ordinary and keyed sibling reconciliation;
- insertion, movement, replacement, and removal;
- create/update/remove/destroy hooks;
- text and comment nodes;
- duplicate-key diagnostics;
- module hooks for attributes, properties, classes, styles, and events.

Primary source:

- [FoldKit host DOMAPI](https://github.com/foldkit/foldkit/blob/c826cdbc033cffd49442cd7248806742cc871d39/packages/foldkit/src/snabbdom/htmldomapi.ts)
- [FoldKit patch initializer](https://github.com/foldkit/foldkit/blob/c826cdbc033cffd49442cd7248806742cc871d39/packages/foldkit/src/snabbdom/init.ts)
- [FoldKit VNode contract](https://github.com/foldkit/foldkit/blob/c826cdbc033cffd49442cd7248806742cc871d39/packages/foldkit/src/snabbdom/vnode.ts)

The current types and default modules are DOM-named and DOM-typed. The
experiment must expose a narrow host-neutral boundary or an experimental
NativeScript-specific adapter without making `foldkit/portable` import DOM
types. A broad public general-renderer API is not required for the first proof.

## 22.10 What should be reused

| Concern | Recommended owner |
|---|---|
| Model, Message, update, Command, Story | FoldKit portable kernel |
| Live/recorded Command split | Existing OriKit FoldKit runtime adapter |
| VNode identity and keyed diff | FoldKit Snabbdom kernel |
| Logical wrapper tree | OriKit renderer, informed by Angular/Svelte |
| Native element creation | OriKit registry over `@nativescript/core` |
| Native properties and events | OriKit patch modules |
| List virtualization | Specialized NativeScript adapter |
| Focus, selection, scroll, animation handles | Renderer-local state |
| History and time travel | Existing OriKit runtime/DevTools contracts |

## 22.11 What should not be reused

- Do not install another framework merely to obtain its adapter.
- Do not copy an adapter wholesale; its lifecycle and state semantics belong
  to its original framework.
- Do not expose native handles through Model, Message, VNode event payloads,
  history, or DevTools transport.
- Do not emulate the complete browser DOM.
- Do not translate arbitrary FoldKit HTML tags and browser events to native.
- Do not make a generic `setAttribute(any)` the stable typed public API.
- Do not treat `ListView`, navigation, modals, ActionBar, or property children
  as normal layout children.

## 22.12 Licensing and provenance

All studied adapter repositories report MIT licensing in their repository or
package metadata. The plan borrows architectural ideas, not source text. If an
implementation copies or closely adapts code, it must:

1. identify the exact source file and revision;
2. confirm the source file's governing license;
3. retain required copyright and license notices;
4. add the provenance to the renderer evidence document;
5. avoid importing framework-specific code that is not needed.

The project MIT license, independent-project disclaimer, and `save.txt` must
remain unchanged.




