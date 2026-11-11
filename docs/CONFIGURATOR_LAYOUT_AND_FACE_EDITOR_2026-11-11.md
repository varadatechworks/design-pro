# Configurator layout and six-side artwork editor — 11 November 2026

## Customer workflow

The product configurator is organised into three work areas:

1. **Left — Product setup:** category, material, finish, dimensions, quantity, product shape/custom SVG outline, print sides, rush production, design brief, source-file inspection and optional local AI concept generation.
2. **Middle — Design studio:** live 3D concept preview and rotation controls at the top; a six-tab editor below for Front, Back, Left, Right, Top and Bottom.
3. **Right — Delivery and estimate:** delivery state, destination count and estimated-shipping toggle appear above the total price and itemised estimate.

## Per-side controls

Every side stores its own:

- Background colour.
- Copy / text.
- Font family (serif, sans-serif, display or monospace), style, weight, colour, size and alignment.
- Image artwork and its placement rectangle (left, top, width and height as percentages of the side).

The side tabs use keyboard navigation (arrow keys, Home and End). Artwork can be selected through the image control or dropped onto a visible preview face. Drag the image to reposition it and drag its corner handle to resize it. These interactions update the local concept preview immediately.

## Quote configuration

The estimate API validates and normalises per-side typography and artwork placement metadata. The quote configuration includes the selected file name, MIME type, byte size and placement values. It does not include image bytes or a secure server-side file reference.

**Important:** the current image upload is browser-local preview only. Refreshing the page loses the image preview, and a saved quotation does not contain the uploaded binary. Do not use this workflow to submit confidential or production artwork. Secure authenticated upload, malware scanning, private object storage, file versioning and proof approval remain release blockers.

## Preview and production limitations

- The 3D model remains an illustrative CSS concept model, not manufacturing-accurate CAD.
- Product shape presets and the SVG outline overlay are visual references; they do not generate a parametric mesh, dieline, cut/crease paths or folding geometry.
- Dragging/positioning uses percentage coordinates on the rendered face. It is not a print-imposition or bleed/safe-area tool.
- Font choices are browser preview stacks, not embedded production fonts.
- Image colours are not ICC-managed and do not represent calibrated CMYK, spot-colour, foil or white-ink output.
- Final dimensions, dielines, typography, bleed, colour and artwork must be checked in a production proof by the design/production team.

## Verification

The responsive Playwright smoke suite covers:
- Three-pane placement of product controls, design editor and delivery preferences.
- Six side tabs and independent typography values.
- Product-specific shape presets.
- Local source-file inspection.
- Per-side image preview, drag positioning and resize interaction.
- Layout overflow at mobile, tablet and desktop viewports.

This enhancement does not change the DesignPro release status: controlled UAT only until the production release gates are closed.
