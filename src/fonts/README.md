# Bundled fonts

Two typefaces ship with the app instead of being asked for at runtime: nothing
here may touch the network, and a system font stack looks different on every
device. Both are variable fonts (weight axis only, upright only), subset to
latin and latin-ext — the UI is English, but a session name or a note can be
written in any language with those letters.

| File | Family | Licence |
|---|---|---|
| `inter-latin.woff2`, `inter-latin-ext.woff2` | Inter Variable | SIL OFL 1.1, `inter-LICENSE.txt` |
| `jetbrains-mono-latin.woff2`, `jetbrains-mono-latin-ext.woff2` | JetBrains Mono Variable | SIL OFL 1.1, `jetbrains-mono-LICENSE.txt` |
| `dseg7-classic.woff2` | DSEG7 Classic Regular | SIL OFL 1.1, `dseg7-LICENSE.txt` |

DSEG7 is the seven-segment face a stopwatch has, offered for the clock alone
(`ui.clockFace`). It is 5 kB and carries digits, letters and the few symbols a
time needs.

Taken from the `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`
packages (`files/*-wght-normal.woff2`). They are copied in rather than
installed, because importing a fontsource stylesheet would bundle every subset
it ships — cyrillic, greek, vietnamese — and the service worker would precache
all of them.
