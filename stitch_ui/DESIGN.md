---
name: Skyline Clarity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4850'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7881'
  outline-variant: '#bec8d2'
  surface-tint: '#006591'
  primary: '#006591'
  on-primary: '#ffffff'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#89ceff'
  secondary: '#006399'
  on-secondary: '#ffffff'
  secondary-container: '#7bc2ff'
  on-secondary-container: '#004f7b'
  tertiary: '#006686'
  on-tertiary: '#ffffff'
  tertiary-container: '#4ba5cc'
  on-tertiary-container: '#00384b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#cde5ff'
  secondary-fixed-dim: '#94ccff'
  on-secondary-fixed: '#001d32'
  on-secondary-fixed-variant: '#004b74'
  tertiary-fixed: '#c0e8ff'
  tertiary-fixed-dim: '#7bd1fa'
  on-tertiary-fixed: '#001e2b'
  on-tertiary-fixed-variant: '#004d66'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system is built upon a foundation of clarity, professionalism, and openness. It utilizes a **Corporate / Modern** style characterized by expansive whitespace, a vibrant blue-centric palette, and a focus on functional aesthetics.

The personality is approachable yet authoritative, designed to evoke feelings of trust and efficiency. By prioritizing high-contrast elements against pure white surfaces, the UI ensures maximum readability and a fresh, airy atmosphere that feels both contemporary and reliable.

## Colors
The palette is dominated by "Sky Blue" and "Pure White." 

- **Primary:** The vibrant sky blue (#0ea5e9) is used for key actions and brand presence.
- **Secondary:** A deeper azure (#0369a1) ensures accessible contrast for text-on-light backgrounds and hover states.
- **Surface Tints:** Soft blue-gray and very light sky blue (#f0f9ff) are used for "surface-dim" or "variant" containers to provide subtle structural separation without breaking the clean aesthetic.
- **Neutral:** A slate-leaning gray scale is used for body text and borders to maintain a professional, cool-toned harmony.

## Typography
This design system utilizes **Inter** exclusively to leverage its systematic, utilitarian, and highly readable qualities. 

- **Headlines:** Use Bold and Semi-bold weights with tight letter spacing for a modern, impactful look.
- **Body:** Standardized on 16px for optimal readability, utilizing a Regular weight with generous line height (1.5x) to prevent visual fatigue.
- **Labels:** Utilized for metadata and small UI triggers, often in Medium or Semi-bold to maintain hierarchy at small scales.
- **Hierarchy:** High contrast is maintained by using the Secondary blue or Dark Slate (#1e293b) for headings and Medium Slate (#475569) for body text.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a 12-column structure for desktop and a 4-column structure for mobile.

- **Rhythm:** An 8px linear scale (with a 4px step for micro-adjustments) governs all padding and margins. 
- **Consistency:** Gutters are fixed at 24px to ensure breathing room between content modules. 
- **Adaptation:** On mobile, side margins shrink to 16px. Containers typically span the full width of the screen, whereas on desktop, content is often constrained to a max-width of 1280px to maintain line-length readability.

## Elevation & Depth
Depth is conveyed primarily through **Tonal Layers** and subtle **Ambient Shadows**.

- **Surfaces:** The primary background is pure white. Secondary containers or sidebars use a soft tint (#f0f9ff) to indicate a different functional area.
- **Shadows:** Shadows are highly diffused and tinted with a hint of the primary blue (e.g., `rgba(14, 165, 233, 0.08)`) to maintain the "Sky" theme.
- **Borders:** Low-contrast outlines (#e2e8f0) are used for input fields and card boundaries when shadows are not applied, ensuring a clean, flat aesthetic that doesn't feel heavy.

## Shapes
The design system uses a **Rounded** shape language to feel modern and friendly.

- **Base Radius:** 0.5rem (8px) is the standard for buttons, inputs, and small cards.
- **Large Radius:** 1rem (16px) is reserved for larger containers and modals.
- **Extra Large Radius:** 1.5rem (24px) may be used for featured sections or promotional banners.
- **Consistency:** Avoid sharp corners except for dividers or full-width section breaks.

## Components
- **Buttons:** Primary buttons are solid Sky Blue (#0ea5e9) with white text. Secondary buttons use an outline of the primary color or a light blue ghost style.
- **Input Fields:** Pure white background with a 1px border (#cbd5e1). On focus, the border transitions to Primary Blue with a soft blue outer glow (2px).
- **Cards:** White surfaces with a very soft shadow (blur 12px, y-4px) and an 8px corner radius.
- **Chips/Badges:** Use the "surface-dim" light blue background with Secondary Blue text for high legibility and a soft look.
- **Lists:** Separated by thin, light gray dividers (#f1f5f9) with generous vertical padding (12px-16px) to maintain the airy feel.
- **Navigation:** Active states are indicated by a solid Primary Blue bar (2px or 4px) or a soft blue background pill.