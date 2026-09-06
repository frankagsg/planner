# Appearance, themes, and backgrounds

Open **Settings → Appearance**. Pick Blush, Linen, Garden, Midnight, or Lavender,
then customize the preview. **Apply appearance** saves to the planner. A failed
save leaves the draft available to retry. Other open screens pick up settings
within 30 seconds; reloading applies them immediately.

- Customize separate light and dark palettes: page, card, text, secondary text,
  border, and accent colors. Preview either palette independently of the mode.
- Choose light, dark, device preference, or a day/night schedule. Scheduled times
  use the viewing device's local clock. For a wall planner, set its timezone first.
- Choose rounded, system, or serif body and heading fonts; adjust text size.
- Set card opacity, corner radius, border width, shadow, and home card spacing.
- Use the theme color, a solid color, a gradient, one photo, or a slideshow. Show
  backgrounds on Home or every page. Change gradient angle, background dimming,
  blur, photo fit, and horizontal/vertical positioning.
- Upload JPG, PNG, WebP, or GIF photos (up to 10 MB each). Slideshow selections
  play in selection order, with 15–3600 seconds per photo and up to 40 photos.
  Missing images are skipped; the page color remains if all images are missing.
- Name and keep up to 20 presets. Preset additions/removals save when you apply.
  Export/import versioned JSON themes. Photo files are not embedded in exports;
  upload them on another planner and select replacements there.
- **Discard** returns to the saved appearance. **Previous look** loads the last
  applied appearance into preview; apply it to restore. **Preview defaults**
  resets the preview without deleting presets, photos, or planner content.

Drafts survive page navigation in the same browser tab when session storage is
available. Uploads are saved to the photo library immediately and remain there
when a draft is discarded. Delete unwanted uploads in **Settings → Photos**.
That tab's existing home-background shortcut also works with the new editor.

The editor flags low text contrast against card colors. With transparent cards,
check the actual background and viewing distance as well. Dialogs and inputs
keep solid surfaces so their controls remain readable.

## Compatibility and scope

This extends the family-hub version on `master`. Existing light/dark/auto and
accent settings, plus existing home photos, are converted when read; no database
migration or reset is needed. New configuration lives in `display.appearance`
and `display.themePresets` in the existing settings store and backups. Confirmed
saves update the browser's offline settings cache. Themes are shared by devices
using the same planner; independent phone/wall themes and drag-to-rearrange
dashboard layouts are not included in this change.

## Verification

```sh
npm --prefix client run build
node --test scripts/appearance.test.ts  # Node 22.18+ or 24+
node scripts/verify.mjs
```

Use a separate database for a preview server. Never run demo seeding against a
live household database. Preview a theme, save a preset, reload, and verify it
returns. Disconnect the preview server and attempt a save; the error should
retain the draft for retry. Check photos, both palettes, and normal planner pages.
