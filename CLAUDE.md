# CLAUDE.md — konvence projektu Rubix

Funkční zadání a datový model: [SPEC.md](SPEC.md). Tenhle soubor je o tom **jak** se píše kód.

Komunikace s uživatelem probíhá česky. **Všechno v repu je anglicky** — identifikátory,
názvy souborů, komentáře, dokumentace v kódu, commit messages, texty chyb.
UI stringy jsou anglicky a žijí pohromadě v `src/lib/strings.ts` (i18n zatím neřešíme).

## Stack — nerozporovat

Vite + React + TypeScript (strict) · Dexie.js · vite-plugin-pwa · cubing.js · Recharts ·
Cloudflare Pages. Nová runtime závislost jen když ji nelze rozumně nahradit ~50 řádky
vlastního kódu; UI knihovnu ani state management framework nepřidáváme
(stav = React state + `dexie-react-hooks`).

## Struktura složek

```
src/
  app/            # bootstrap, router, providers, layout, error boundary
  db/
    schema.ts     # Dexie třída + verze + indexy (jediné místo se schématem)
    types.ts      # entity typy (Solve, Session, ...)
    repositories/ # solve-repository.ts, session-repository.ts, ...
    seed/         # statická data packů (pll.json, oll.json, f2l.json) + seed.ts
    migrations/   # DB migrace + migrace importních formátů
  domain/         # ČISTÁ logika, žádný React, žádný Dexie
    stats/        # averages.ts, distribution.ts, pb.ts
    solve/        # penalty.ts, final-time.ts, splits.ts
    scramble/     # typy a pravidla, ne generování
  features/
    timer/  history/  stats/  trainer/  splits/  data-transfer/  settings/
      components/   # React komponenty téhle feature
      hooks/        # use-*.ts — most mezi repository a komponentou
      index.ts      # veřejné API feature (jediný povolený import zvenčí)
  components/     # sdílené hloupé UI (Button, Modal, Sheet, EmptyState)
  hooks/          # sdílené hooky (use-media-query, use-keyboard)
  lib/            # obaly nad cizím světem: scramble-client.ts, beep.ts, format.ts, uuid.ts, clock.ts
  workers/        # scramble.worker.ts, audio onset processor
  types/          # deklarace pro cizí custom elementy (twisty-player)
  test/           # setup.ts pro vitest
scripts/          # jednorázové generátory (ikony), spouštěné ručně přes npm run
```

**Feature nesmí importovat z jiné feature napříč** — jen přes její `index.ts`,
a když to začne být potřeba často, patří ta věc do `domain/` nebo `components/`.

## Kde bydlí logika

Tři vrstvy, závislosti jdou jen jedním směrem:

```
components  ->  hooks  ->  repositories  ->  Dexie
     \                         /
      \--------> domain <-----/          (čisté funkce, závisí na ničem)
```

- **`domain/`** — čisté funkce nad prostými daty. Žádný import Reactu, Dexie, DOM,
  `Date.now()` ani `Math.random()` (čas i náhoda se předávají parametrem, viz `lib/clock.ts`).
  Sem patří všechno, co jde otestovat tabulkou vstupů a výstupů: výpočet finálního času,
  trimmed mean, PB, histogram, práce se splity, validace importu.
- **`db/repositories/`** — **jediné místo, kde se sahá na Dexie.** Repository nezná React.
  Zapisuje `updatedAt`, generuje `id`, zakládá tombstones, drží referenční integritu
  a víceřádkové operace v `db.transaction`.
- **`features/*/hooks/`** — most: `useLiveQuery` nad repository, orchestrace akcí,
  lokální UI stav. Hook nesmí obsahovat výpočty — ty volá z `domain/`.
- **`features/*/components/`** — renderování a events. Komponenta **nikdy** neimportuje
  `db`, neformátuje čas vlastním kódem (`lib/format.ts`) a nepočítá statistiky.

Test toho, jestli je logika na správném místě: *dá se to otestovat bez DOM a bez IndexedDB?*
Pokud ano a je to v komponentě, patří to jinam.

## Pojmenovávání

- soubory s komponentami: `PascalCase.tsx` (`SolveList.tsx`), default export **ne** —
  vždy pojmenovaný export
- ostatní soubory: `kebab-case.ts` (`solve-repository.ts`, `use-timer.ts`, `final-time.ts`)
- testy: `<zdroj>.test.ts` vedle zdroje
- hooky `useXxx`, boolean proměnné `is/has/should`, časy v ms mají suffix `Ms`
  (`rawMs`, `holdThresholdMs`) — hodnota bez suffixu se nikdy nesmí ukázat jako čas
- indexované příznaky v DB jsou `0 | 1` (typ `Flag`), ne `boolean` — IndexedDB
  neumí indexovat booleany. Konverze na `boolean` až v hooku.
- Dexie tabulky pomnožně (`solves`), typy jednotně (`Solve`)
- commity: Conventional Commits anglicky — `feat(timer): add hold-to-start threshold`

## Typy

- `strict: true`, `noUncheckedIndexedAccess: true`
- **žádné `any`**, žádné `as` pro obcházení typů; `unknown` + zúžení
- entity typy žijí v `db/types.ts` a jsou zdrojem pravdy; UI si nedefinuje vlastní kopie
- discriminated unions místo volitelných polí tam, kde stavy nemůžou nastat současně
  (např. stav timeru: `idle | inspecting | armed | running | stopped`)

## Testy

Vitest + `@testing-library/react` + `fake-indexeddb`.

- **`domain/` má povinné unit testy** a je jediná vrstva, kde míříme na vysoké pokrytí.
  Píšou se tabulkově (`it.each`) a hlídají hraniční případy: prázdné okno, samé DNF,
  dva DNF v ao5, ao50 s 5% trimem, `plus2` nad DNF, chybějící fáze ve splitech.
- **repositories** se testují nad `fake-indexeddb`: kaskády, tombstones, merge při importu,
  idempotence seedu (spustit dvakrát = stejný výsledek, uživatelská data nedotčená).
- **komponenty** se testují jen tam, kde mají netriviální chování (timer, hold-to-start,
  editace penalty). Testujeme přes chování a role, ne přes implementační detaily.
- **žádné snapshot testy** velkých stromů; snapshot smí být max. nad malým čistým výstupem.
- Round-trip test exportu je povinný: `export -> import(replace) -> export` musí dát
  identický JSON.
- Testy nesmí sahat na síť ani na reálný mikrofon; audio detektor se testuje nad
  syntetickým bufferem vzorků.

## Co se nikdy nedělá

1. **Žádný odchozí síťový provoz za běhu.** Žádné analytics, sentry, fonty z CDN,
   ping na API. Všechny assety jsou v buildu. Jediná výjimka je service worker
   kontrolující update samotné aplikace.
2. **Nic neopouští zařízení** — obzvlášť ne audio z mikrofonu. Mikrofonní stream se
   zpracovává výhradně v `AudioWorklet` a nikdy se neukládá ani neposílá.
3. **Neukládat odvozené hodnoty.** Finální čas, průměry, PB, statistiky případu se
   vždy počítají. V DB je jen `rawMs` + `penalty`.
4. **Nemazat řádek bez tombstonu** — jinak se smazaný záznam vrátí při dalším importu.
5. **Neměnit význam existujícího pole.** Nové pole + migrace, ne přetížení starého.
   Každá změna schématu = nová `db.version(n)` s upgrade funkcí; stará verze se nikdy
   needituje.
6. **Nesahat na Dexie mimo `db/repositories/`.** Žádné `db.solves.where(...)`
   v komponentě ani v hooku.
7. **Nepřepisovat uživatelská data seedem.** Řádky se `source: 'user'` nebo `isCustom: 1`
   jsou pro seed nedotknutelné.
8. **Neblokovat main thread.** Generování scramblu patří do workeru, audio do
   `AudioWorklet`. Během běžícího timeru se nesmí dělat nic, co může způsobit jank —
   zápis do DB až po zastavení.
9. **Nepoužívat `Date.now()` / `Math.random()` v `domain/`** a pro měření času nikdy
   `Date.now()`, vždy `performance.now()`.
10. **Žádné floaty pro čas.** Vše celé milisekundy; zaokrouhlení až při formátování.
11. **Neměnit stack** ani nepřidávat backend, účty, telemetrii nebo cloud sync —
    to jsou vědomé non-goals, ne opomenutí.
12. **Nekomentovat samozřejmosti.** Komentář vysvětluje *proč* (např. proč je práh
    detekce adaptivní), ne *co* řádek dělá.

## Poznámky k vývoji

- `npm run dev` běží bez service workeru; PWA chování se testuje přes `npm run build && npm run preview`
- Cloudflare Pages: build `npm run build`, output `dist`, SPA fallback na `index.html`
- cubing.js se importuje **dynamicky** (`await import('cubing/scramble')`), aby se
  nedostal do hlavního chunku
