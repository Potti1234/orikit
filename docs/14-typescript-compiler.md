# 14. Future TypeScript/Fold compiler research

## 14.1 Status

Deferred until the Kotlin runtime, native bindings, web adapter, Story DSL,
and replay model are proven.

## 14.2 Product question

Would authoring shared behavior in FoldKit-like TypeScript improve the user and
AI workflow enough to justify a new restricted language and compiler?

This is not the same as compiling arbitrary TypeScript.

## 14.3 Feasible scope

A restricted frontend may support:

- Effect Schema-like value declarations
- Tagged Model, Message, and Command types
- Pure literals and expressions
- Exhaustive Message matching
- Immutable field updates
- Command construction
- Feature composition
- Story declarations

It should reject:

- Browser/platform APIs
- Arbitrary npm dependencies
- Dynamic property access
- Reflection/proxies
- `any`
- Mutation
- Exceptions as normal domain flow
- Arbitrary Effect programs inside update
- Unsupported JavaScript numeric assumptions

## 14.4 Pipeline

```text
Fold TypeScript subset
        │
TypeScript parser + type checker
        │
validated Fold AST
        │
versioned Fold IR
        │
Kotlin source generator
        │
normal OriKit KMP compilation
```

Generate Kotlin source rather than Kotlin IR initially. Generated source is
easier to inspect, debug, diff, and test.

## 14.5 Fold IR

The IR must be language-neutral and versioned:

```text
Program
├── Types
├── Model
├── Messages
├── Commands and result mappings
├── Init expression
├── Update match tree
├── Feature composition
└── Stories
```

Expression nodes might include:

```text
Constant
ReadField
CopyModel
ConstructValue
Arithmetic
Boolean
ListMap/Filter/Fold (restricted)
MatchTag
ReturnNext
EmitCommand
```

Every node needs defined Kotlin, JS, null, and numeric semantics.

## 14.6 Compiler correctness

Required:

- Source locations carried into IR.
- Generated Kotlin line mapping.
- Golden AST/IR/Kotlin tests.
- Semantic tests executing TypeScript reference and generated KMP result.
- Rejection tests for every unsupported construct.
- Version compatibility for IR.
- Deterministic generation.

## 14.7 Prototype

Prototype only:

1. Counter Model.
2. Three Messages.
3. Integer arithmetic.
4. Exhaustive match.
5. One Delay Command.
6. One Story.
7. Generated Kotlin compiled for JVM and JS.
8. Compare transition vectors.

Stop if error messages cannot point users back to their TypeScript source.

## 14.8 Go/no-go criteria

Proceed only if:

- At least three realistic features fit the subset naturally.
- Generated debugging is understandable.
- Build time remains acceptable.
- AI reliably stays inside the subset.
- The compiler reduces total code/complexity compared with direct Kotlin.
- Numeric/null/collection semantics are explicit.

Do not proceed merely because the counter prototype compiles.

## 14.9 Alternative

A Kotlin DSL plus generated TypeScript facade may provide most of the desired
experience at much lower cost. Evaluate it before committing to a new
language.

