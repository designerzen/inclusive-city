# Interface requirements

All buttons and button-like controls must have a rendered hit target of at least
44 × 44 CSS pixels at every viewport size, including disabled controls, icon-only
HUD controls, select triggers and disclosure summaries. Icons can be smaller.

Preserve the global minimums in `source/src/accessibility.css`. Do not override
them with smaller dimensions, `!important` rules, shrinking transforms or clipped
containers. Compact layouts must still reserve the full target size without
overlap. Run `pnpm test` when changing control sizes; verify rendered controls in
the browser on desktop and mobile.
