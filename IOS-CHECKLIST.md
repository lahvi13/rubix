# iOS: what to click through, and what cannot be verified from a desk

Everything here shipped in v0.16.0 and **none of it has been on a real iPhone
yet**. It was verified in headless Chrome at 412 px with safe-area insets
emulated over CDP (`Emulation.setSafeAreaInsetsOverride`), which proves the CSS
reacts to insets and that the app runs offline, and proves nothing about the
things only iOS does: the notch, the status bar tint, the home-screen icon, and
the share sheet.

Deploy first, then check what production actually serves — About shows
`__APP_VERSION__`, and a service worker otherwise hides an update.

## Install

1. Open in Safari, go to About — the second section is "Add to the Home
   Screen" with the instructions.
2. Share → Add to Home Screen. **The icon must be the cube on a dark ground,
   not a screenshot of the page** and not a black square.
3. The name under the icon should read "Rubix".
4. Launch from the home screen: **no address bar, no Safari toolbar**. The
   install section in About must be gone.

## Safe areas — all of this from the home-screen app

5. Timer: the bottom row of the solve list and the INSP/PHASE toggles must not
   run under the home indicator.
6. History: scroll to the very bottom — the last solve and "Load more" must sit
   above the indicator and still be tappable.
7. Open a solve (tap its time): the foot of the detail sheet, with the tags and
   the delete button, must clear the indicator.
8. Delete a solve: the undo bar must not sit on the indicator.
9. **Turn the phone sideways.** iOS ignores the manifest's `orientation:
   portrait`, so it will rotate. Nothing may go under the notch and the page
   must not scroll sideways.

## Touch on the timer surface

10. Tap the timer area ten times fast: no magnifier, no text selection, no copy
    menu, and the page must not zoom.
11. Hold a finger on it for about two seconds (arming the clock): same again,
    no magnifier.
12. Run a solve with inspection on: the cues at 8 and 12 seconds must be
    audible. Worth deciding whether they should still sound with the phone on
    silent.

## Status bar and theme

13. Settings → Theme → Light: the status bar must lighten with the app and the
    clock and battery must stay readable. Then Dark, then System.

    This is the one to watch. `apple-mobile-web-app-status-bar-style` is
    deliberately left opaque (`default`) rather than `black-translucent`, which
    always draws the status bar in white and would be unreadable on the light
    theme. If either theme comes out unreadable anyway, the fallback is an
    explicit `black`.

## Offline and data

14. Aeroplane mode → close the app from the switcher → launch from the home
    screen. It must come up, show a scramble, and time a solve.
15. Time three solves, close from the switcher, wait a few minutes, reopen.
    They must still be there.
16. Data → Export data, **from the home-screen app, not a tab**: check that a
    file **actually comes out** (iOS opens the share sheet, or saves to Files).
    The export is a plain `<a download>` on a blob URL, which is the shakiest
    thing in the app on iOS — a standalone web app has no download bar to put
    it in. The line under the section title must change to "Last backup: Today
    · … KB".
17. Right after the export, "Send it somewhere…" must be there. Tap it: the
    share sheet opens, and Mail or Files takes a `rubix-YYYY-MM-DD.txt`. If
    the download in step 16 did nothing, this is the way out on iOS — worth
    knowing before anyone relies on it.
18. Data → Restore → Choose a file: pick that `.txt` from Files. The preview
    must come up with the solves in it ("The file changes nothing here." is
    right when restoring onto the same phone).
19. The storage line in the Backup section: from the home-screen app it should
    say the browser **keeps** the data. "May clear" there means `persist()` was
    refused even for an installed app, and the export is all there is.
20. If there is the patience for it, check a week later that the solves are
    still there.

## Updates

21. After the next deploy: launch from the home screen. Within the hour, or on
    returning to the foreground, "A new version is available." must appear, and
    the version on About must change after Reload. "Check for updates" on
    About should find a fresh deploy straight away.

## What iOS cannot be made to guarantee

`navigator.storage.persist()` is called at startup, which is the whole of what
a page can do. On iOS it still holds that

- `persist()` effectively only grants for an app on the home screen, not a tab;
- Safari clears an origin's data after **seven days without a visit** — for a
  tab, that includes the solves;
- Settings → Safari → Clear History and Website Data wipes IndexedDB with no
  warning, installed app or not;
- the system evicts on its own when storage runs low.

There is no substitute for the export. That sentence is in the app too, in the
install hint.

## The version floor

The stylesheet uses `light-dark()` in nineteen places, which Safari only
supports from **17.5** (May 2024). With `:has()`, `dvh` and `color-mix()` also
in use, the real floor is **iOS 17.5+**. Below it the layout survives but the
palette does not — the colours simply have no value.

This is a known, accepted limit, not an oversight: carrying a second palette
for older iOS is its own piece of work, and nobody has asked for it. Revisit
only if a real device turns up that cannot run 17.5.
