# Gánh Mưu Sinh — UI direction

Applied skill: ui-ux-pro-max. Queried cultural food travel and React accessibility.
The searches returned general travel/editorial guidance but did not provide a verified heritage-specific visual style. The direction below is a project-specific design choice, using the skill's verified accessibility and React guidance.

- Purpose: help curious visitors choose a small, approachable food journey.
- Style: warm editorial travel journal; generous whitespace, restrained borders, real illustrative photography, serif headlines and clear sans-serif interface text.
- Background #F8F7F2; surface #FFFFFF; ink #263D32; secondary text #62685F.
- Primary #234D3C with white text. Accent #B64B2D with white text. Warm highlight #F3CB83 with dark green text.
- Fonts: Be Vietnam Pro for controls and body; Lora for editorial headings. Both include Vietnamese coverage. System fallbacks must remain usable without network.
- Layout: 1200px max width; 24–64px gutters; 8px spacing rhythm; 20px card radius; 44px minimum controls.
- Imagery: real street/food photos, always marked illustrative. No association between people pictured and fictional vendor biographies.
- Motion: 160–240ms interaction feedback; disable decorative animation and smooth scrolling for reduced motion.
- Accessibility: skip link, one h1 per view, visible focus, native buttons/labels, dialog focus trap/Escape/restore, semantic status messages, no color-only states.
- States: explicit API failure/retry, empty searches/reset, async loading, unavailable AI explained, image upload consent, demo stamps distinguished from AI observations.
- Maps: OpenStreetMap with attribution; path segments are distance estimates, not street directions. Text itinerary remains available if tiles fail.

## Admin and account extension · 2026-10-29

- Preserve the warm editorial identity: forest-green sidebar, cream workspace, white tables, and restrained status colors.
- User/admin shells are separated in `Root.tsx`; both share native fields, focus-trapped dialogs and account state.
- UI/UX search: `admin data table forms --domain ux`. Applied the table-handling result: wide tables stay inside their scrollable region. Forms become one column on mobile.
- Navigation includes overview, vendors/stories, quests, moderation, references, and read-only members. Counts come from the backend.
- Draft, published and archived states are explicit. Approval says it creates a draft. Missing source facts remain blank.
- Imports preserve source provenance and unverified status, without inventing biographies or allergy data.
- Login supports autofill, password visibility, errors, and server-side role checks. Registration has no role selector.
