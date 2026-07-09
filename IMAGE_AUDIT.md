# ARXI Systems Image Audit

Audit date: 2026-07-09

## Summary

The site already had a useful base set of local Pexels assets and ARXI logo files. The strongest existing assets were the real field/civic images for transit, parks/trails, airports, downtown, public works, and the final CTA. The main gaps were precision and message fit: the homepage hero duplicated the transit card, the manufacturer route lacked hardware credibility, and the planning/intelligence story did not have a dedicated visual.

The implemented strategy retains strong real stock for tangible civic scenarios and supplements it with generated custom images where stock was too generic for ARXI's accountable smart-infrastructure positioning.

## Asset Decisions

| Asset | Current usage | Decision | Reason | Implemented enhancement |
|---|---|---|---|---|
| `assets/media/arxi-hero-infrastructure.jpg` | Previous homepage hero/poster; transit card duplicate | Retain as supporting stock, replace as hero | Real transit context is useful, but duplicated with transit use case and less custom to ARXI's accountable-layer message | Replaced hero with `assets/media/generated/arxi-hero-smart-corridor.jpg` |
| `assets/media/generated/arxi-hero-smart-corridor.jpg` | Homepage hero; agency route hero | Add/use | Best fit for smart shelter, route-map, public corridor, dark overlay, and one-accountable-partner framing | Implemented in `index.html` hero and `agencies.html` hero via CSS |
| `assets/media/flagship-smart-shelter.jpg` | Previous shelter/system and manufacturer support imagery | Retain as backup/supporting stock | Night transit image has civic mood but does not clearly show configurable shelter/system layers | Replaced primary system placements with generated smart shelter asset |
| `assets/media/generated/smart-shelter-system.jpg` | Homepage flagship section; manufacturer shelter scenario | Add/use | Custom visual communicates solar canopy, display, storage, lighting, and telemetry as a configurable system | Implemented in `index.html` and `manufacturers.html` |
| `assets/media/generated/agency-planning-intelligence.jpg` | Homepage planning/intelligence; agency civic planning scenario | Add/use | No existing asset communicated planning, site scoring, pilot criteria, and agency deployment decisions | Implemented in `index.html` and `agencies.html` |
| `assets/media/generated/manufacturer-hardware-readiness.jpg` | Manufacturer hero; manufacturer hardware scenarios and homepage manufacturer preview | Add/use | Existing stock did not show infrastructure product readiness, integration, or hardware credibility | Implemented in `manufacturers.html` and `index.html` |
| `assets/media/usecase-transit.jpg` | Transit scenario cards and use-case cards | Retain/reposition | Strong real transit-stop context; no longer overloaded as the main hero | Kept for transit/pilot cards |
| `assets/media/usecase-parks.jpg` | Parks/public-space scenario cards | Retain | Real public-space context, good for parks/trails safety and lighting story | Kept |
| `assets/media/usecase-trails.jpg` | Trails/solar lighting scenario cards | Retain | Real trail infrastructure context, fits low-disruption public-space pilot story | Kept |
| `assets/media/usecase-campuses.jpg` | Campus and prior planning cards | Retain, reduce planning dependence | Useful campus setting but too generic for civic intelligence | Replaced agency planning scenario with generated planning image |
| `assets/media/usecase-airports.jpg` | Airport/campus mobility node; manufacturer selective-fit proof | Retain | Strong, literal airport mobility infrastructure context | Kept |
| `assets/media/usecase-downtown.jpg` | Downtown corridor cards; contact CTA source duplicate | Retain | Strong urban corridor feel; duplicate use is acceptable for downtown/contact but should not carry all hero work | Kept |
| `assets/media/usecase-emergency.jpg` | Emergency/resilience proof panel | Retain | Real field worker/public safety context, useful for resilience proof | Kept |
| `assets/media/usecase-public-works.jpg` | Public works scenario; pilot operations; manufacturer context | Retain | Strong field deployment/public works realism | Kept |
| `assets/media/final-cta-infrastructure.jpg` | Homepage contact CTA background | Retain | Dark corridor image works well behind CTA/radar overlay | Kept |
| `assets/og/arxi-og-image.jpg` | Open Graph image | Retain, future update optional | Functional and locally hosted; could later be regenerated from the new hero | Kept |
| `assets/og-arxi-placeholder.svg` | No current production reference found | Retain as unused fallback | Small placeholder file, not harmful | Documented as unused |
| `assets/logos/arxi-primary-horizontal.svg` | Header/footer light theme logo | Retain | Current logo handling is strong and theme-aware | Kept |
| `assets/logos/arxi-primary-horizontal-reversed.svg` | Header/footer dark theme logo | Retain | Current logo handling is strong and theme-aware | Kept |
| `assets/logos/arxi-stacked.svg` | No current production reference found | Retain as brand asset | Useful alternate logo, not a duplicate to delete | Documented as unused production asset |
| `assets/logos/arxi-stacked-reversed.svg` | No current production reference found | Retain as brand asset | Useful alternate logo, not a duplicate to delete | Documented as unused production asset |
| `assets/logos/arxi-icon.svg` | Favicon | Retain | Required brand icon | Kept |
| `assets/logos/favicon-32.png` | Favicon fallback | Retain | Required browser fallback | Kept |
| `assets/logos/favicon-192.png` | App icon fallback | Retain | Useful install/share fallback | Kept |
| `assets/logos/favicon-512.png` | App icon fallback | Retain | Useful install/share fallback | Kept |

## Placement Issues Fixed

- Homepage hero no longer reuses the same transit image as `usecase-transit.jpg`.
- Flagship smart shelter visual now has a custom system-focused background instead of generic street/transit stock.
- Planning/intelligence now has a dedicated agency planning image.
- Manufacturer route now has hardware readiness imagery instead of generic civic scenes only.
- Agency/manufacturer page heroes now use image compositions with stronger overlay compatibility.

## Remaining Non-Blocking Gaps

- `assets/og/arxi-og-image.jpg` could be refreshed later using the new generated hero for stronger social preview consistency.
- The existing stock set is JPG-only; future asset processing could add `.webp` variants and `<picture>` elements if a formal optimization pipeline is added.
