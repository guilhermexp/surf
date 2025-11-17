## Theme Mapping – Surf Desktop

This document maps the current dark theme implementation to the source files and strings you need to touch when re‑applying the Monokai Nebula palette (https://github.com/jacobcallahan/monokai-nebula-zed).  
Use it as a checklist for future contributors: update the shared tokens first, then work through the components that still bake in legacy blues.

---

### 1. Palette Cheat Sheet

| Role (Monokai)   | Hex / rgba                                     |
| ---------------- | ---------------------------------------------- |
| Base background  | `#101010`                                      |
| Elevated surface | `#1A1A1A`                                      |
| Foreground text  | `#F8F8F2`                                      |
| Muted text       | `#75715E` → `rgba(117,113,94,0.7)`             |
| Accent Pink      | `#F92672`                                      |
| Accent Blue      | `#66D9FF` _(still present in many components)_ |
| Accent Purple    | `#AE81FF`                                      |
| Accent Orange    | `#FF971F`                                      |
| Accent Green     | `#A6FF2E`                                      |
| Accent Yellow    | `#E6DB74`                                      |
| Border grey      | `#8F8F8F` or `rgba(143,143,143,0.35)`          |

Keep these handy when remapping colors referenced below.

---

### 2. Global Tokens & Entry Points

| File                                    | Purpose                                                                                                                                            | Strings to audit                                                                                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/tokens/tokens.json`        | Source of design tokens consumed across `@deta/ui` and the desktop app. Update this first so downstream CSS variables inherit the correct palette. | `app-background`, `app-background-dark`, `accent`, `accent-dark`, `accent-background`, `on-surface-*`, `brand-*`, `tab-active-gradient-*`, `tab-shadow-*`, `success/danger/warning`, etc. |
| `packages/ui/src/lib/styles/tokens.css` | Generated CSS variables imported by Svelte components. Mirrors the JSON file. Update in tandem (search for `--app-background`, `--accent`, etc.).  | Same variables as JSON, plus derived ones like `--accent-color-rgb`.                                                                                                                      |
| `app/src/app.css`                       | Global font imports; rarely needs palette tweaks but is where additional CSS variables could be wired if needed.                                   | N/A                                                                                                                                                                                       |

**Workflow:** edit `tokens.json`, run `yarn turbo run @deta/ui#build` (or rely on dev server) so `tokens.css` stays aligned. When replacing the blues, make sure `rgba(119,189,255,0.15)` style highlights receive new RGBA equivalents that match Monokai’s glows.

---

### 3. Application-Level Surfaces

| Area                                 | File(s)                                                                                                                               | Notes / Strings                                                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root renderer background & gradients | `app/src/renderer/Core/Core.svelte`                                                                                                   | Defines `:global(:root)` variables `--background-dark`, `--background-accent`, `--primary`, etc. Contains hard-coded `#66d9ff`, `#f92672`, `#66d9ff` used for drag indicators and overlays (`--color: #66d9ff;`). Update these if accent colors change. |
| Resource workspace                   | `app/src/renderer/Resource/Resource.svelte`                                                                                           | Repeats the gradient/background variables (`--background-dark`, `--color-brand`, etc.) and the `light-dark` backgrounds for body. Includes `#66d9ff` for drag indicators and outlines.                                                                  |
| Navigation bar / Save state popover  | `app/src/renderer/Core/components/NavigationBar/NavigationBar.svelte` & `.../SaveState.svelte`                                        | Uses `light-dark(...)` with `var(--accent, #3b82f6)` fallback plus inline `#66d9ff` and `#3b82f6`. Replace default args so they align with Monokai palette.                                                                                             |
| Tabs system (horizontal & vertical)  | `app/src/renderer/Core/components/Tabs/**` (`TabItem.svelte`, `BaseTabItem.svelte`, `VerticalBaseTabItem.svelte`, `TabsList*.svelte`) | Houses the hover/active glows built from `rgba(119,189,255,0.15)` and `--tab-*` variables. Search for `119, 189, 255`, `129, 146, 255`, and `rgba(0,0,0,0.09)` to swap inset highlights, gradients, and `color(display-p3 ...)` fallbacks.              |
| Input components                     | `app/src/renderer/Resource/components/Input.svelte`                                                                                   | Contains outlines that reference `rgba(119, 189, 255, 0.15/0.4)`. Replace with accent-specific glows (e.g., `rgba(249,38,114,0.3)`).                                                                                                                    |
| Tree/list indicators                 | `app/src/renderer/Resource/components/notebook/NotebookTreeView.svelte`                                                               | Property `--tree-drop-indicator-color: light-dark(#66d9ff, #8192ff)` anchors drag indicators.                                                                                                                                                           |
| Dragcula drop indicator              | `app/src/renderer/Core/Core.svelte` (around `.dragcula-drop-indicator`)                                                               | Sets `--color: #66d9ff` and `--dotColor: white;`. Update for new accent.                                                                                                                                                                                |

---

### 4. Settings Window Surfaces

| Component                                                   | Path                                                                                                          | Key strings / tokens                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main layout                                                 | `app/src/renderer/Settings/Settings.svelte`                                                                   | Controls sidebar gradients, card shadows, tab hover states, and the `--settings-dark-*` custom variables. Search for `light-dark` clauses using `#678fff`, `#d7e1fd`, `rgba(119, 189, 255, 0.15)` to update both light + dark fallbacks. |
| `SettingsOption`                                            | `app/src/renderer/Settings/components/SettingsOption.svelte`                                                  | Heading text + copy uses `light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5))`. Update fallback dark values to Monokai neutrals.                                                                                              |
| `DefaultSearchEnginePicker` & `TeletypeDefaultActionPicker` | `app/src/renderer/Settings/components/DefaultSearchEnginePicker.svelte`, `TeletypeDefaultActionPicker.svelte` | Border + background `light-dark` fallback currently uses `rgba(71,85,105,0.4)` and `#101010`. Replace fallback border/shadow colors with the new neutral + pink accent.                                                                  |
| `ModelSettings`                                             | `app/src/renderer/Settings/components/ModelSettings.svelte`                                                   | Contains developer card gradients identical to the ones in `Settings.svelte` plus inline `#0284c7`, `#94a3b8`, etc. These should be swapped to Monokai cyan/purple equivalents and reference the shared tokens.                          |
| `UsageBar`                                                  | `app/src/renderer/Settings/components/UsageBar.svelte`                                                        | Defines `--usage-*` color variables (good/warning/danger). Confirm they map to Monokai values (`#A6FF2E`, `#FF971F`, `#F92672`).                                                                                                         |

**Strings to search for inside `app/src/renderer/Settings/**`:\*\*

```
#678fff
#d7e1fd
rgba(119, 189, 255, 0.15)
rgba(102, 217, 255, 0.16)
rgba(71, 85, 105, 0.4)
```

Each occurrence points to a hover/focus style that still leans blue.

---

### 5. Other Hard-Coded References

Use ripgrep to locate residual blues/oranges you care about:

| Pattern                         | Meaning / Where                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#66d9ff`                       | Primary accent throughout Core, Resource, Settings components. Check `Core/Core.svelte`, `Resource/Resource.svelte`, `NotebookTreeView`, `NavigationBar/SaveState`, `Tabs*`, and `Settings`. |
| `rgba(119, 189, 255,`           | Shared glow/shadow values for tabs, inputs, and cards. Replace once you pick a Monokai glow color.                                                                                           |
| `rgba(129, 146, 255,`           | Dark-mode counterpart of the glow above (vertical tabs, tab items).                                                                                                                          |
| `#3b82f6`, `#1d8aff`, `#1995f5` | Legacy brand blues defined in `tokens.json` under `brand-*`; update those tokens so components referencing `var(--brand-primary)` inherit the right hue.                                     |
| `light-dark(... #101010)`       | Many components still default to `#101010` which is OK for the base background. Focus on the _light_ fallback values (`#e3f0ff`, `#c8e3ff`, etc.) if you want parity between schemes.        |

---

### 6. Suggested Update Order

1. **Settle the palette** in `packages/ui/tokens/tokens.json` / `tokens.css`.

   - Decide on exact hex/RGB for `accent`, `accent-dark`, `brand-*`, `tab-shadow-*`.
   - Regenerate CSS (or run dev server) so every `var(--token)` pulls new values.

2. **Update global surfaces** (`Core/Core.svelte`, `Resource/Resource.svelte`) to avoid overriding the shared tokens with outdated fallback values.

3. **Sweep component overrides** using `rg "#66d9ff"`, `rg "119, 189, 255"`, etc., replacing them with palette colours (preferably referencing the new tokens instead of raw hex).

4. **Audit Settings window** – because it contains the densest amount of custom gradients and glows. Follow the table in section 4.

5. **Verify** in both light and dark mode (Settings toggle + actual window). Pay attention to:
   - Tab hover/active glows (should match pink/orange instead of blue).
   - Sidebar gradients (should use Monokai neutrals).
   - Form controls and cards (no remaining `#66d9ff` highlights unless you deliberately keep it as a secondary accent).

---

### 7. Quick Reference Table (Tokens ➞ Components)

| Token / Color                                          | Primary dependents                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `--app-background` / `--app-background-dark`           | Core background, Settings sidebar, Resource view backgrounds.                                                      |
| `--accent`, `--accent-dark`                            | Buttons, SaveState popover, Tab active states, Notebook tree drop indicator, Settings CTA.                         |
| `--accent-background`, `--accent-background-dark`      | Popover hover states, Inputs, Settings cards.                                                                      |
| `--tab-active-gradient-*` & `--tab-shadow-*`           | `Core/components/Tabs/**/*.svelte`.                                                                                |
| `--border-subtle(-dark)`                               | Settings sidebar divider, popover borders, dropdowns (`DefaultSearchEnginePicker`, `TeletypeDefaultActionPicker`). |
| `--brand-primary`, `--brand-secondary`, `--brand-link` | Settings links/buttons, `ModelSettings` CTA, `UsageBar` statuses.                                                  |

Whenever you change one of these tokens, re-open the components listed to ensure no hard-coded fallback overrides the new value.

---

### 8. Tooling

- `rg "#66d9ff" app/src` – find remaining blue strings.
- `rg "light-dark" app/src/renderer/Settings` – inspect dual-scheme blocks quickly.
- `yarn dev` inside `app/` – hot reload the desktop renderer to verify changes.

---

With this map you can hand the task to any engineer: update the tokens, follow the component tables above, and run through verification steps. Reach out if we discover additional surfaces that still hard-code palette values.
