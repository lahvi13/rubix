# Performance with thousands of solves

Everything the timer and the stats screen show is recomputed from the stored
solves on every write (rule 3 in CLAUDE.md: nothing derived is stored). That is
instant with a few hundred solves. This file records how it behaves with
thousands — a csTimer import can bring that many in one go — and what was
done about it.

## How it was measured (2026-09-14)

- Production build (`npm run build && npm run preview`), headless Chrome over
  CDP, 412 px mobile viewport.
- CPU throttled 4× (`Emulation.setCPUThrottlingRate`), roughly a mid-range phone.
- Solves seeded straight into IndexedDB, then a reload (see the memory note on
  Dexie serving stale queries after a raw seed). Half of them in a second
  session, half in the active one; two thirds timed by phase.
- Main-thread stalls read with a `PerformanceObserver` for `longtask`
  (installed via `Page.addScriptToEvaluateOnNewDocument`).
- Timer: Space held and released to start, pressed to stop; long tasks counted
  from the stop. Stats: `#/stats` opened, then the scope switched.
- Hot spots found with `Profiler.start/stop` and the sampled self time mapped
  back to the minified bundle by line and column.

## Results

Longest single main-thread block, 4× throttled. Totals in brackets.

| | 50 solves | 5 000 before | 5 000 after | 10 000 after |
|---|---|---|---|---|
| Timer, after the stop | 0 | 263 ms (673) | 93 ms (163) | 156 ms (296) |
| Stats, opening | 485 ms | 1 079 ms | 643 ms | 554 ms |
| Stats, switch to All sessions | 111 ms | 689 ms | 194 ms | 364 ms |

About 480 ms of opening the stats screen is there with 50 solves: it is
loading and parsing the Recharts chunk the first time, not data. Runs vary by
some tens of milliseconds, which is why 10 000 can open faster than 5 000.

## What was fixed

1. **Averages slide one window** (`windowAverages` in `domain/stats/averages.ts`).
   The best ao50/ao100 and the record history sorted every window afresh —
   43 ms for an ao100 over 5 000 solves unthrottled. Now about 1 ms.
2. **Phase lengths worked out once per solve** (`domain/stats/phases.ts`) —
   the phase table re-split each solve for every cell. 8 ms → 3 ms.
3. **The numbers under the timer have their own hook** (`use-mini-stats.ts`).
   They used to run the whole stats screen's computation after each solve.
4. **Date formatters are built once** (`lib/format.ts`). `toLocaleDateString`
   builds an `Intl.DateTimeFormat` per call; the solve lists call it per row
   per render. It was the largest single cost on the timer after a stop.
5. **The PB comes from a time-ordered index** (schema v4,
   `[puzzle+mode+penalty+rawMs]`). It used to walk every clean and +2 solve
   with a cursor, and a live query records every key a cursor hands it.
   Since 2026-10-12 the PB is kept per method, and comes from a second such
   index, `[sessionId+penalty+rawMs]` (schema v8): the fastest clean solve and
   the fastest +2 of each of the method's sessions, two rows read per session.
   Filtering the puzzle-wide index by session would have been the cursor
   again — past every faster solve of another method, which for somebody
   learning a second one is all of them.
6. **One read of the session's solves on the timer screen** (2026-09-29,
   `hooks/use-session-solves.ts`). `useMiniStats` and `useSessionRecords` both
   ran `listSolvesChronological` for the active session, so the same thousands
   of rows were cloned and tracked twice after every solve. The timer now reads
   them once and hands the array to both (`useRecordsOf`, `MiniStats solves`).
   Measured the same way, 5 000 solves, four stops each:

   | | longest block | total |
   |---|---|---|
   | before | 153–178 ms | 344–408 ms |
   | after | 93–169 ms | 166–239 ms |

   The seed for that run was written straight into IndexedDB from the page
   (one `readwrite` transaction on `solves`, rows shaped as `Solve` in
   `db/types.ts`, two thirds with four phases), followed by a reload.
7. **Live query results are shared, not copied** (2026-10-13, `cache:
   'immutable'` in `db/schema.ts`). Dexie deep-cloned every live query result
   for whoever asked; now the cached rows are frozen and handed out as they
   are. Measured as above, a fresh profile for each run, four stops each; the
   script time is the browser's own counter over the stop and the 3.5 s after:

   | | 5 000 before | 5 000 after | 10 000 before | 10 000 after |
   |---|---|---|---|---|
   | Timer, longest block after a stop | 0–68 ms | none over 50 ms | 95–142 ms | 54–84 ms |
   | Timer, script time per stop | 156–169 ms | 113–196 ms | 261–292 ms | 177–214 ms |
   | Stats, opening | 580 ms (934) | 569 ms (896) | 605 ms (1 372) | 577 ms (1 259) |
   | Stats, switch to This session | 195 ms (680) | 246 ms (806) | 276 ms (1 076) | 293 ms (1 089) |
   | Stats, switch to All sessions | 246 ms (875) | 215 ms (853) | 402 ms (1 319) | 374 ms (1 207) |

   It had been expected to be the biggest single gain, and is not. It helps
   the timer, which rereads the same session after every solve: a quarter to
   a third of the script time at 10 000 (the 196 ms at 5 000 is the first stop
   of the run; the three after it were 113–144). The stats screen spends its
   time computing, not copying, and its numbers are inside what one run
   differs from the next by.

   The price is a rule (CLAUDE.md, "Co se nikdy nedělá"): nothing read from
   the database is changed in place. The audit before switching it on found
   five repository reads that sorted their result in place — the sets, the
   methods, the tags, the triggers, a case's algorithms. Three failed the
   tests at once; the other two did not, because a list of one sorts without
   writing anything, and would have thrown in the app with two tags or two
   algorithms. The freeze is one level deep, so a row's own lists are shared
   unfrozen; the tests now freeze every read all the way down
   (`test/setup.ts`), which is what catches the next one.

## What is still open

Nothing is queued. What remains at 10 000 is the stats screen's own work —
about 480 ms of opening it is Recharts being loaded and parsed, the rest is
computing over every solve — and Dexie recording the primary key of every row
an index query returns, so that the query knows when to run again.

One thing seen and not measured: the read behind "All sessions" sorts every
solve of the puzzle by date in JavaScript (`sortBy`), for want of an index
that orders by date across sessions.

With ordinary numbers of solves (hundreds to a low few thousand) all of it
is comfortably fast.
