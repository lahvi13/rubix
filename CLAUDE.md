# CLAUDE.md — konvence projektu Rubix

Funkční zadání a datový model: [SPEC.md](SPEC.md). Tenhle soubor je o tom **jak** se píše kód.

Komunikace s uživatelem probíhá česky. **Všechno v repu je anglicky** — identifikátory,
názvy souborů, komentáře, dokumentace v kódu, commit messages, texty chyb.

**Aplikace mluví dvěma jazyky: anglicky a česky.** Veškerá kopie žije v
`src/lib/strings/`: `en.ts` je zdroj tvaru, `cs.ts` je proti němu typovaný
(`Translated<typeof en>`), takže klíč přidaný jen na jedné straně shodí build.
Nová UI věta se **vždycky** píše do obou souborů. Pravidla:

- jazyk se vybere jednou při startu z `localStorage` (`lib/language.ts`), výchozí
  je čeština jen tehdy, když si o ni řekne prohlížeč. Přepnutí v Nastavení aplikaci
  znovu načte — moduly čtou `strings` při importu, nic jiného je nepřemluví
- české počty mají tři tvary (1 / 2–4 / 5+); rozhoduje `Intl.PluralRules` v
  `strings/plural.ts`, nikdy ne poslední číslice (22 patří k „pět“, ne ke „dva“)
- **názvy ze sad algoritmů se nepřekládají v datech.** Anglický název je klíč
  (seed, `diagramFor`, export mezi zařízeními); překládá se až při vykreslení přes
  `packLabel()`. Co zůstává anglicky (Dot, Sune, Headlights, písmena PLL), je
  vyjmenované v `strings/pack-names.ts` a test nad sadami hlídá, že žádný název
  nezůstal nerozhodnutý
- datum a čas se řídí jazykem aplikace, region si bere z prohlížeče (`lib/format.ts`)

## Stack — nerozporovat

Vite + React + TypeScript (strict) · Dexie.js · vite-plugin-pwa · cubing.js · Recharts ·
Cloudflare Workers (statické assety). Nová runtime závislost jen když ji nelze rozumně nahradit ~50 řádky
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
    cube/         # vlastní model kostky: notace, stav (54 nálepek), pohledy na případ
    alg/          # triggery — rozpad algoritmu na pojmenované úseky
    transfer/     # formát exportu, validace importu, plán merge/replace
  features/
    timer/  history/  stats/  trainer/  splits/  data-transfer/  settings/
      components/   # React komponenty téhle feature
      hooks/        # use-*.ts — most mezi repository a komponentou
      index.ts      # veřejné API feature (jediný povolený import zvenčí)
  components/     # sdílené hloupé UI (Button, Modal, Sheet, EmptyState)
  hooks/          # sdílené hooky (use-media-query, use-keyboard)
  lib/            # obaly nad cizím světem: scramble-client.ts, beep.ts, format.ts, uuid.ts, clock.ts
    strings/      # en.ts + cs.ts (typovaný proti en), plural.ts, pack-names.ts, language.ts vedle
  fonts/          # Inter + JetBrains Mono jako woff2 v buildu (fonts/README.md)
  workers/        # audio onset processor (scrambles run in cubing.js's own worker)
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

1. **Žádný odchozí síťový provoz za běhu.** Žádné sentry, fonty z CDN, ping na API.
   Všechny assety jsou v buildu. Výjimky jsou dvě: service worker kontrolující update
   samotné aplikace a Cloudflare Web Analytics (beacon z
   `static.cloudflareinsights.com`, snippet v `index.html`). Beacon nesmí do precache
   ani do runtime cachingu — jde vždy na síť — a jeho výpadek nesmí nic rozbít:
   je to samostatný `<script type="module">`, který na ničem nezávisí a nikdo na něj
   nečeká. Parametr `"spa": true` v `data-cf-beacon` je oproti originálnímu snippetu
   navíc a je povinný — bez něj se měří jen první načtení a přechody mezi obrazovkami
   se nezapočítají.
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
8. **Neblokovat main thread.** Scramble počítá cubing.js ve **vlastním** workeru —
   nikdy ho nebalit do dalšího workeru (znamená to druhou kopii celé knihovny v paměti);
   audio patří do `AudioWorklet`. Během běžícího timeru se nesmí dělat nic, co může
   způsobit jank: timer překresluje každý frame, takže komponenty pod ním jsou
   memoizované a zápis do DB jde až po zastavení.
9. **Nepoužívat `Date.now()` / `Math.random()` v `domain/`** a pro měření času nikdy
   `Date.now()`, vždy `performance.now()`.
10. **Žádné floaty pro čas.** Vše celé milisekundy; zaokrouhlení až při formátování.
11. **Neměnit stack** ani nepřidávat backend, účty, další telemetrii (nad rámec
    výjimky v bodě 1) nebo cloud sync —
    to jsou vědomé non-goals, ne opomenutí.
12. **Nekomentovat samozřejmosti.** Komentář vysvětluje *proč* (např. proč je práh
    detekce adaptivní), ne *co* řádek dělá.

## Poznámky k vývoji

- `npm run dev` běží bez service workeru; PWA chování se testuje přes `npm run build && npm run preview`
- Cloudflare Worker se statickými assety (`wrangler.jsonc`): build `npm run build`,
  output `dist`, SPA fallback na `index.html`, žádný server kód. Push do `main` se sám
  zbuilduje a nasadí (Workers Builds), `npm run deploy` se ručně nespouští — ale deploy
  krok umí spadnout (viděno: 503 z CF API po úspěšném buildu), takže po pushi ověřit,
  co produkce doopravdy servíruje. Jakou verzi zařízení běží, je vidět na obrazovce
  About (`__APP_VERSION__` = verze z `package.json` · commit) — service worker jinak
  update schová; „Check for updates“ tamtéž si ho vynutí. Verze: nová funkce zvedá
  prostřední číslo, oprava poslední — ale **číslo se zvedá jednou za pracovní blok**
  (sezení, den), ne po každém pushi. Push nasazuje průběžně se starým číslem;
  nasazené sestavení rozliší commit za tečkou. Zvednout až na konci bloku jedním
  `chore(release)` podle nejvyšší změny v bloku (autor nechce, aby verze naskakovaly
  po několika za den).
- cubing.js se importuje **dynamicky** (`await import('cubing/scramble')`), aby se
  nedostal do hlavního chunku
- **statické obrázky kostky kreslí `components/CubeDiagram.tsx`**, ne twisty:
  na obrazovce sady je jich až 57 a jsou to jen nálepky. Twisty se sahá jen na
  přehrání algoritmu. Model kostky (`domain/cube/state.ts`) nemá ručně psané
  permutační tabulky — tah je rotace vrstvy v prostoru, což jde otestovat
  (čtyři tahy = výchozí stav, sexy move šestkrát = složeno)
- **pack algoritmy se ověřují spuštěním**, ne přečtením: `db/seed/packs.test.ts`
  aplikuje každý na složenou kostku a kontroluje, že případ je toho druhu, co
  sada tvrdí, že jsou všechny navzájem různé a že kostka zůstane nastojato
- **dlouhá Dexie transakce s desítkami awaitů je křehká** („Transaction committed
  too early“ — viděno u seedu). Vzor: přečíst mimo transakci, spočítat změny,
  zapsat je jedním `bulkPut`. Jednotkové testy nad fake-indexeddb tohle nechytí
- **cubing.js spouští vlastní workery ze svých chunků**, proto musí build držet tři věci
  pohromadě (všechny v `vite.config.ts`): sdílené moduly cubingu ve vlastní `cubing-shared`
  skupině (jinak je bundler přilepí k app entry a worker umře na `document`),
  `modulePreload: false` (preload helper sahá na `document`) a
  `setSearchDebug({ prioritizeEsbuildWorkaroundForWorkerInstantiation: true })`.
- změnu, kterou uvidí prohlížeč, ověřit **v prohlížeči**, ne jen testy: `npm run build &&
  npm run preview` a projít reálný scénář (dobře posloužil headless Chrome přes CDP).
  Chyby v hranicích worker / chunking / service worker jednotkové testy z principu nechytí.
- **výkon s tisíci solvů je změřený** (5 000 a 10 000, CPU 4× zpomalené):
  [PERFORMANCE.md](PERFORMANCE.md) — postup měření, výsledky, co se opravilo a
  dva otevřené kroky (jeden dotaz na solvy session na timeru; Dexie
  `cache: 'immutable'` jen po auditu). Výpočet, který projde všechny solvy,
  se po každém solvu pouští znovu: nové statistiky změřit se 5 000 solvy, ne
  s padesáti. Živý dotaz platí za každý vrácený řádek (klonování + sledování
  klíče), takže ho neptat na víc řádků, než potřebuje, a kurzor (`each`,
  `anyOf`) přes velkou tabulku nahradit indexem.
- **iOS se odsud ověřit nedá.** Co je na iPhonu potřeba proklikat ručně, proč je
  statusbar nastavený tak, jak je, a co Safari se smazáním dat zaručit nejde:
  [IOS-CHECKLIST.md](IOS-CHECKLIST.md). Je tam i verzová podlaha appky (iOS 17.5
  kvůli `light-dark()`) — vědomá, ne opomenutí.
- **hlavní zařízení je telefon.** UI se ověřuje v šířce 412 px (CDP
  `Emulation.setDeviceMetricsOverride`, `mobile: true`) — desktop je až druhý.
  Řádek s několika ovládacími prvky vedle sebe se tam smrskne na nulu, takže
  seznamy jsou karty a rozšiřují se až v `@media (min-width: …)`. Vstupní pole
  mají `font-size: max(1rem, 16px)`, jinak stránku klávesnice zvětší — v pixelech,
  protože nastavení velikosti textu (`ui.textSize`) škáluje kořenový `rem`.
- **barvy a velikosti se nepíšou do pravidel.** Paleta, typová škála i rodiny
  písem jsou proměnné v `:root` (`--text-*`, `--font-sans|mono|ui`, `--clock-size`)
  a téma se přepíná přes `light-dark()`; pravidlo si nikdy nepíše vlastní hex ani
  vlastní `rem`. Co CSS nedosáhne (diagramy kostky jsou `<img>`), dostane téma
  přes `useResolvedTheme()`.
- **tlačítka se nepřekreslují.** Vzhled je jeden (`button` v `index.css`): tichý
  obrys, ztlumený popisek, výška pro palec. Komponenta smí říct rozložení nebo
  velikost, ne vzhled; význam říká stav — `is-active` (zvolená volba),
  `is-primary` (akce, pro kterou panel je), `is-danger` (bez návratu). Co je
  plocha na ťuknutí, ne tlačítko (karta případu, scrim, barevný terčík), se
  přes rodinu přemaluje samo a musí si pohlídat i `min-height`.
