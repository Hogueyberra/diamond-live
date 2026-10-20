# Clubhouse umpire and rules chat

The figure behind home plate and its **Consult the Rules** label open a dedicated rules chat. The button supports keyboard activation, visible focus, and a minimum 44 × 44 CSS-pixel hit area. The four existing clubhouse navigation areas remain in place.

The chat defaults to Minor B and searches the existing 204-section `src/data/hvll2026.json` corpus using `searchGuidelines`. Suggested questions cover pitching innings, batting order, and playing time. Results retain their division, section, exact original paragraphs, full passage, and source PDF page link. The newest question and first result are brought into view. Whole paragraphs preserve conditions that could otherwise be clipped from a search snippet.

This is a chat interface for local rule retrieval, not a connected generative model or an umpire's ruling. It covers the saved 2026 HVLL bylaws; separate Little League rulebooks, later updates, and privately uploaded team documents are not included. Missing topics do not produce invented answers. Explicit mismatched divisions and years prompt the coach to correct the scope. Conversation content remains in memory and resets when the dialog closes.

## Artwork

- Final project asset: `public/prototype/umpire.png` (transparent PNG).
- Generated with the **built-in image generation tool**; no API/CLI fallback.
- Style reference: `public/prototype/clubhouse.png`. The original clubhouse image was not edited. The umpire is a separate positioned asset, so the existing navigation coordinates remain intact.
- Original generated file: `C:/Users/nhogue/.codex/generated_images/01a14660-03a2-76a0-9bf4-737bc081a76c/exec-d0bc40c4-3475-4363-8d15-df6d00fa4e71.png`.

### Generation prompt

> Create a single isolated baseball home-plate umpire game sprite on a truly transparent background. Image 1 is a STYLE AND CAMERA REFERENCE ONLY: match the charming miniature toy people in this isometric baseball clubhouse scene. Do not reproduce the clubhouse or field. One full-body small stylized 3D umpire with a large rounded head and compact toy proportions, black protective umpire cap and face mask, muted powder-blue short-sleeve umpire shirt, charcoal pants and black shoes. Seen from an elevated isometric camera, mostly from behind, facing toward the top of the image into the field, with a slight three-quarter turn so the face mask is visible. Hands resting near knees in a light ready crouch, both feet grounded, clearly reads as an umpire rather than a catcher. Warm natural light from upper left, soft realistic miniature material textures matching reference. Center the entire figure in a tightly framed portrait canvas with small even transparent margins, include both shoes, no ground, no baseball field, no home plate, no background, no text, no extra characters, no logo, no opaque shadow plane. Intended to be placed behind home plate as a clickable character in the existing clubhouse illustration.

## Verification

Browser evidence is saved in `umpire-rules-qa/`. The map and chat are checked at 390 × 844 and at the normal embedded-browser width; this is not a physical iPhone test. Targeted tests exercise the umpire button, source citations, missing results, division/year scope, exact passage preservation, and focus restoration after closing.

October 20 verification: 16 existing guideline tests, 3 new rules-lookup tests, and 12 prototype interaction tests passed. An initial combined run hit a worker startup timeout; the interaction file passed when run separately. The final production build and `git diff --check` passed. The existing main-bundle size warning remains. No production publication was performed.
