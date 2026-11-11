# Product design studio and artwork import — 11 November 2026

## What changed

The storefront design studio now has:

- A shape selector with rectangular, cube, tall, flat and rounded concept profiles.
- Dimension-aware proportions: changing length, width or height updates the concept model.
- Six independently editable sides: front, back, left, right, top and bottom.
- Per-side colour, text, text size and alignment.
- A 360-degree auto-rotation control, a rotation slider and the existing drag-to-rotate gesture.
- Material and finish treatments in the preview.
- Local SVG shape-outline import and per-side local artwork placement.
- A design-file inspection panel for CDR, AI, EPS, PDF, SVG, PNG, JPG, WEBP and TIFF.
- A quote configuration that retains validated side colours, text and design metadata without storing uploaded file bytes.

## Important preview limitations

The 3D object remains a browser-rendered concept model. The shape presets alter the proportions of a cuboid; a custom SVG is shown as a 2D overlay/reference. This is not a manufacturing-accurate mesh, folding carton, dieline or cutting path. A production engineer must validate the final CAD/dieline and physical sample.

The preview is illustrative. Material texture and finish treatments are visual approximations and must not be treated as a proof for colour matching, foil registration, print tolerances or manufacturing.

## Artwork import behaviour

Files are inspected in the browser and are **not uploaded to the server**:

| Format | Current behaviour |
|---|---|
| SVG | Sanitised image preview; reads width/height or viewBox; extracts visible text nodes |
| PNG/JPG/WEBP/TIFF | Local preview where browser decoding is supported; pixel dimensions estimated at 96 DPI |
| PDF | Attempts to read an uncompressed MediaBox; no reliable text extraction |
| AI/EPS | Attempts to read PDF MediaBox or EPS BoundingBox metadata |
| CDR | Recognised as a file selection, but raw CorelDRAW binary is not parsed |

Raster pixel dimensions are not physical print dimensions. The user must confirm the intended millimetres. CDR users should export from CorelDRAW to SVG or PDF for more useful preview/metadata extraction. AI files should be saved with PDF compatibility or exported to SVG/PDF.

Secure upload, file retention, malware scanning, PDF preflight, font embedding, linked-asset collection, colour-profile handling and server-side CDR conversion are not included in this local concept phase. Do not upload confidential artwork or treat this import as a production proof.

## Optional local AI assistant (no paid API key)

The AI assistant uses a locally installed Ollama service. It generates a structured concept direction, six-side colour palette, suggested side copy, shape preset, material and finish. It does not create final artwork, image files, print-ready PDFs, dielines or prices.

1. Install Ollama from https://ollama.com/download.
2. Open PowerShell and download a small model:

   ```powershell
   ollama pull llama3.2:3b
   ```

3. In the DesignPro project `.env`, set:

   ```properties
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=llama3.2:3b
   ```

4. Keep Ollama running, restart the DesignPro API, refresh the browser and use **AI design assistant**.

The API only permits a loopback Ollama address, applies a per-client rate limit, validates the product category and filters the model response to known shapes, compatible materials/finishes, six-digit colours and short side text. Do not expose Ollama or DesignPro's local API directly to the public internet.

If Ollama is not configured or running, concept generation returns a clear service error. The rest of the configurator works without AI.

## Still required before production

- Real parametric 3D geometry for each supported product family.
- A dieline/CAD pipeline with dimensions, folds, glue flaps, bleed, cut and crease paths.
- Secure, authenticated artwork upload and versioned storage.
- Robust PDF/AI/EPS/CDR conversion and extraction, including font and linked-image checks.
- Colour-management support (ICC profiles, spot colours, foil/white-ink layers).
- AI image generation or a human designer workflow for print-ready artwork.
- Factory-approved material, machine, finishing and shape constraints.
- End-to-end proof approval using the exact uploaded production file.

The DesignPro release gates remain authoritative. This enhancement does not change the DEVELOPMENT / UAT ONLY release status.
