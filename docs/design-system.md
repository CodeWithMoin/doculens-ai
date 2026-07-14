# DocuLens design system

DocuLens uses a quiet, evidence-first visual language designed for long document-review sessions. The system intentionally favors hierarchy, legibility, and provenance over decorative dashboard density.

## Foundations

- **Typography:** Manrope carries interface and editorial copy; DM Mono is reserved for metadata, shortcuts, identifiers, and technical labels.
- **Color:** porcelain surfaces and ink text form the neutral foundation. Cobalt communicates focus and action; amber marks evidence and citations. Semantic success, warning, and danger colors are limited to real system state.
- **Spacing:** an eight-pixel rhythm governs layout, with four-pixel increments used inside compact controls.
- **Shape:** controls use restrained 10–14 px radii; large marketing surfaces use broader radii to create hierarchy without turning every element into a card.
- **Elevation:** borders establish most grouping. Shadows are reserved for floating navigation, dialogs, menus, and the primary product mockup.

All values are exposed as semantic CSS variables in `frontend/src/styles/globals.css`. Components consume roles such as `background`, `foreground`, `muted`, `border`, and `primary` instead of raw palette values.

## Interaction principles

1. Primary actions are visually unambiguous; secondary actions remain quiet until hover or focus.
2. Every interactive control has a keyboard-visible focus ring and a descriptive accessible label.
3. Motion communicates entrance, progress, or state change. It never blocks input and is disabled when the operating system requests reduced motion.
4. Dark mode is a first-class theme, persisted locally and initialized from the operating-system preference.
5. Product pages preserve working context through a stable sidebar and command search, while public pages use a simpler editorial frame.

## Component boundaries

```text
components/
├── brand/       product identity primitives
├── layout/      application shell and navigation
├── ui/          reusable, domain-neutral controls
└── dashboard/   data visualization and workspace composition
```

Domain pages compose primitives but do not redefine their visual states. This keeps accessibility and interaction behavior consistent while allowing document workflows to evolve independently.

## Performance tradeoffs

DocuLens uses CSS transitions and keyframes instead of an animation library. This limits orchestration features but avoids adding a runtime dependency for effects that are short, local, and deterministic. Authenticated pages are split at route boundaries so marketing visitors download only the public experience.
