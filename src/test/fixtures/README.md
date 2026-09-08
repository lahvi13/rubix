# Real csTimer exports

Ground truth for the csTimer importer: files csTimer itself wrote, kept byte
for byte. The parser is tested against these rather than against a fixture
written from what we believe the format to be — the two are not the same
thing, and the difference is where an importer goes wrong.

- `cstimer-export-one-solve.txt` — a fresh csTimer, one solve, default session
  names (numbers, not strings).
- `cstimer-export-phases.txt` — a DNF with a comment, a plain solve, two solves
  timed in four phases, and one deliberately timed in five. csTimer allows up
  to ten, and the count is per solve: this file's session says `phases: 4`
  while one of its solves has five.
- `cstimer-export-session.csv` — the same session as `cstimer-export-phases.txt`,
  exported the other way. Semicolons, CRLF, no trailing newline, times to the
  millisecond (this csTimer has `useMilli` on), and a phase column for the
  longest solve of the session. Three things only a full session shows: every
  row has a `P.1`, even one that was never timed by phase, where it is just the
  time again; a +2 is written into the displayed time (`34.706+`) while its
  phases add up to the raw 32.706; and reading it has to give exactly what
  reading the JSON gives, which is what the two are tested against.

The first two are JSON despite the `.txt`: that is the name csTimer's
Export/Import → "Export to file" gives them.
