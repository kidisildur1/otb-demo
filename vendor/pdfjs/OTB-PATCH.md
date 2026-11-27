# Local PDF.js extraction correction

Upstream: pdfjs-dist 5.7.284, Apache-2.0. The original npm archive integrity is in vendor/manifest.json.

The worker text extraction loop skips invisible-format glyphs before advancing their widths. Some PDFs map the visibly drawn hyphen glyph to U+00AD (soft hyphen), including the embedded Arial fixture used for contract checks. This silently concatenated contract identifiers. getTextContent({disableNormalization:true}) does not affect this earlier filtering.

One conditional is changed to retain U+00AD glyphs only when the font reports positive width. Other invisible-format glyphs and zero-width U+00AD remain skipped. The parser normalizes retained U+00AD to a hyphen while preserving readable source fragments. Rendering is not changed. Positive width is a conservative proxy, so all identifiers still require human review.

The patch script asserted exactly one match. The manifest records original and modified file SHA-256 values. When updating PDF.js, review this patch again and rerun the real-PDF identifier regression.
