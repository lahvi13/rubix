# Performance with thousands of solves

Everything the timer and the stats screen show is recomputed from the stored
solves on every write (rule 3 in CLAUDE.md: nothing derived is stored). That is
instant with a few hundred solves. This file records how it behaves with
thousands — a csTimer import can bring that many in one go — what was done
about it, and what is still open.

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

## What is still open

What remains at 10 000 is mostly Dexie's own per-query work: every live query
result is deep-cloned for its subscriber, and every row an index query returns
has its primary key recorded so the query knows when to re-run. Two ways to
cut it, neither done yet:

1. **One read of the session's solves on the timer screen.** `useMiniStats`
   and `useSessionRecords` both run `listSolvesChronological` for the active
   session, so the same thousands of rows are cloned and tracked twice after
   every solve. Sharing one query is safe; it is a small restructuring of
   where the timer screen gets those numbers from.
2. **Dexie's `cache: 'immutable'`.** Results would be frozen and shared instead
   of cloned per subscriber — probably the biggest single gain. It is also a
   change for the whole app: any code that mutates a query result or sorts one
   in place would start throwing, including in paths the tests do not reach.
   Only with an audit of every repository read first.

Worth re-measuring before either: with ordinary numbers of solves (hundreds to
a low few thousand) the current state is comfortably fast.
