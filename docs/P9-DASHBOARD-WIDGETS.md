# P9.1 — Dashboard widget picker

**Flag:** `enable_dashboard_widget_picker` (default **on**)

Students can show/hide and reorder main dashboard blocks without code changes.

## Sections

| ID | Label |
|----|--------|
| `pulse` | Next 7 days workload |
| `gapfill` | Smart gap-fill suggestions |
| `countdown` | Exam countdown |
| `schedule` | Today schedule & focus |
| `tasks` | Tasks |

## Where to configure

Settings → **Appearance** → Panel layout (visibility checkboxes + ↑↓ reorder).

## Storage

- Order: `flux_layout_dashboard_v1`
- Hidden: `flux_dashboard_hidden_sections_v1` (array of section ids)

## Rollback

Set flag false in `flux_feature_flags`; reorder-only UI remains (legacy behavior).
