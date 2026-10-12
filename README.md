# Rubix

An offline speedcubing trainer for the 3×3, from a first solve to a fast average —
a timer, a beginner's guide and an algorithm trainer for **CFOP** and **Roux**.
It runs in the browser and installs as an app on a phone or a computer:
**[rubix.lahvi.cz](https://rubix.lahvi.cz)**

Free, no account, no ads. Once opened, it works without a connection. English and Czech.

<p align="center">
  <img src="docs/screenshots/timer.webp" width="200" alt="The timer: a scramble, its 3D preview and the clock">
  <img src="docs/screenshots/learn.webp" width="200" alt="The beginner's guide, for CFOP or Roux, with the notation open">
  <img src="docs/screenshots/trainer.webp" width="200" alt="The trainer on Roux: CMLL, every case with its algorithm">
  <img src="docs/screenshots/stats.webp" width="200" alt="Statistics: phase averages and the phase trend">
</p>

## What it does

### Timer
- Hold to start (space bar or anywhere on the screen), tap anything to stop.
- WCA inspection with a countdown bar and beeps at 8 and 12 seconds; going over
  gives the +2 or DNF on its own.
- Random-state WCA scrambles generated on the device, with a flat or 3D preview
  of the scrambled cube. Paste your own scramble to practise a particular situation.
- While the clock runs, only the time is on screen — and you choose whether it
  shows hundredths, tenths, whole seconds or nothing at all.
- Under your averages, what the next solve needs for a new best ao5 or ao12 —
  shown only while one is in reach, and it can be turned off.

### History and sessions
- Every solve with its scramble, penalty, tags, note and star; fix a mistyped
  time or a penalty later.
- Separate sessions for different practice, each timed in CFOP or Roux, archived
  when you are done with them.
- Deleting a solve can be undone for a few seconds.

### Statistics
- Current and best ao5, ao12, ao50 and ao100, personal bests, mean, median,
  standard deviation, DNF and +2 rate.
- A histogram of times, and a trend of the rolling ao12 against the slower ao50.
- Averages follow the csTimer convention, so the numbers match what you are used to.

### Algorithm trainer
- **CFOP:** PLL, OLL and F2L — with two further levels of F2L for a pair that
  starts in the wrong slot — plus 2-Look OLL and PLL for the way most people
  learn them.
- **Roux:** the second block's 65 pairs, CMLL — all 42 cases, with 2-Look CMLL
  on the way there — the eleven cases of edge orientation, and EOLR, which
  orients the edges and places the side ones in a single algorithm.
- Every case drawn as a diagram, with arrows for where the pieces go; play the
  algorithm on a 3D cube move by move.
- Alternative algorithms for a case — left-handed ones marked as such — your
  own algorithms, and named triggers (sexy move, sledgehammer…) highlighted
  inside them.
- Mark each case as new, learning or known, and see how far through a set you are.
- Drill a chosen set of cases against the clock, from a real scramble into the
  case, and see which ones are your slowest; or drill recognition alone, naming
  the case you are shown. The cross has a drill of its own.

### Phase splits
- Time each phase by tapping as you finish it: cross, F2L, OLL and PLL in CFOP,
  the two blocks, CMLL and the last six edges in Roux.
- See your average and best time for every phase, how your current ao12 divides
  between them, and how they change over time.

### Beginner guide
- A whole first solve in seven steps, with pictures of how to hold the cube —
  for CFOP, or for Roux with its blocks built by feel, only two algorithms and
  a picture for every way its last edges can lie.
- Can be hidden once you no longer need it.

### Sharing
- Send a solve or an average as a picture.
- Send a link with the same scrambles, so a friend can try to beat your time
  or your ao5.

### Your data
- Back up everything to a single file and restore it, or merge it into another
  device; you see what will change before anything does.
- Import your history from csTimer.
- Export solves to CSV for a spreadsheet.

### Look
- Light and dark theme, cube colour schemes, text and clock size, a choice of fonts.

## Privacy

There are no accounts and no backend. Everything you record stays in your browser's
storage and leaves the device only when you export it yourself. The one outside
request is Cloudflare Web Analytics, which counts page views; it knows nothing
about your solves and nothing waits for it.

## Where the algorithms come from

Most of the CFOP algorithms are from [J Perm](https://jperm.net/), and the
beginner method follows [badmephisto](http://badmephisto.com). The Roux sets
come from the sheets of [Kian Mansour](https://sites.google.com/view/kianroux/)
and the Roux community; the second-block cases those sheets leave out are from
[SpeedCubeDB](https://speedcubedb.com/). Every algorithm in the app is checked
by running it on a model of the cube before it ships.

## Bugs and ideas

[Open an issue](https://github.com/lahvi13/rubix/issues/new/choose) — or, without a
GitHub account, write to the e-mail on the app's About screen. More in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Running it

Node 24 (see `.node-version`).

```sh
npm install
npm run dev       # development server, no service worker
npm test
npm run build && npm run preview   # the real PWA, with offline caching
```

A push to `main` builds and deploys to Cloudflare Workers as static assets.

## How it is made

Rubix is my project. The idea, what goes in and what stays out, how every
screen behaves and looks — those are my decisions, and I try the changes
with a cube in my hands on real devices.

I write the code together with [Claude Code](https://claude.com/claude-code),
Anthropic's AI coding assistant; the commits it worked on say so in their
`Co-Authored-By` line.

Built with Vite, React and TypeScript, Dexie over IndexedDB,
[cubing.js](https://js.cubing.net/cubing/) for scrambles and 3D playback and
Recharts for charts. The specification ([SPEC.md](SPEC.md)) and the project
conventions ([CLAUDE.md](CLAUDE.md)) are in Czech; the code, comments and commit
messages are in English.

## License

[GPL-3.0-or-later](LICENSE). You may use, change and share Rubix; a changed version
you distribute has to stay open under the same license.
