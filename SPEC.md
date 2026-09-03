# Rubix — specifikace

Offline PWA trenažér na Rubikovu kostku pro speedcubing.

## 1. Cíle a hranice

**Cíl:** osobní trenažér — timer, historie, statistiky, drill algoritmů, fázové splity.
Používá autor a pár známých, distribuce přes URL na Cloudflare.

**Non-goals (platí pro celý projekt):**

- žádný backend, žádné API, žádná autentizace, žádné uživatelské účty
- žádná telemetrie, analytics, crash reporting ani jiný odchozí síťový provoz za běhu
- žádný Play Store / app store balíček
- žádná synchronizace přes cloud — přenos dat výhradně přes ruční export/import JSON
- žádná multi-user logika v datovém modelu (jedno zařízení = jedna sada dat)

**Offline-first:** po první návštěvě musí být aplikace plně funkční bez sítě, včetně
generování scramblů a zobrazení kostky. Vše, co cubing.js potřebuje (WASM/worker
assety), se precachuje.

## 2. Stack

| Vrstva | Volba |
|---|---|
| Build | Vite |
| UI | React + TypeScript (strict) |
| Perzistence | Dexie.js nad IndexedDB |
| PWA | vite-plugin-pwa (Workbox, `registerType: 'prompt'`) |
| Scramble + vizualizace | cubing.js (`randomScrambleForEvent`, `<twisty-player>`) |
| Grafy | **Recharts** |
| Deploy | Cloudflare Worker se statickými assety (žádný server kód) |

**Proč Recharts:** deklarativní React API, sedí na histogram i na trendový line chart,
žádný imperativní canvas kód, tree-shakeable. Očekávaný objem dat (jednotky tisíc solvů,
graf vždy nad oknem posledních N) je pro SVG bez problémů.
**Kdyby to přestalo stačit** (grafy nad ~10k body, plynulý zoom): vyměnit **jen** modul
`features/stats/charts/*` za uPlot. Grafové komponenty proto nesmí obsahovat výpočty —
dostávají hotová data z domény.

## 3. Funkční rozsah

### 3.1 Timer

- hold-to-start: podržet mezerník / dotyk na ploše po dobu `holdThresholdMs` (default 300),
  vizuální stav *armed*, uvolnění spouští čas
- WCA inspekce 15 s, vypnutelná přepínačem přímo na obrazovce timeru; zvukové cue
  na 8 s a 12 s (jen lokální beep, žádný TTS)
- automatická penalizace z inspekce: 15–17 s → `plus2`, > 17 s → `dnf`,
  vždy s `penaltySource: 'auto'`
- ruční penalizace `+2` / `DNF` bezprostředně po solvu i kdykoliv později z historie
- měření a zobrazení na setiny; interně vždy celé milisekundy (integer)
- zastavení jakoukoliv klávesou nebo dotykem **kdekoliv na obrazovce** (během běhu leží
  přes celou plochu neviditelná vrstva); ESC během běhu = zahodit pokus bez uložení
- během běhu je scramble i statistiky skryté (režim „pouze čas“)
- po zastavení zůstane na obrazovce výsledek (čas, mini-statistiky, rychlá penalta);
  další scramble se odkryje až potvrzením nebo začátkem dalšího pokusu

### 3.2 Scramble

- WCA random-state scramble přes cubing.js; počítá se ve workeru, který si cubing.js
  drží sám — aplikace kolem něj **nestaví vlastní worker vrstvu** (viz CLAUDE.md)
- prefetch: další scramble se generuje hned po zobrazení aktuálního; požadavky se řadí
  za sebe, dva běžící solvery naráz položí i slušný telefon
- náhled zamotaného stavu: **plochý rozvin kreslí aplikace sama** (stejný model
  i skin jako trenažér, žádný chunk navíc), 3D přes `<twisty-player>`
  — přepíná to nastavení `ui.twistyMode`, vypnout celý náhled jde přes
  `timer.showScramblePreview`. Rozvin se kreslí **bílou nahoru** (skin se otočí),
  protože v té poloze je scramble definovaný. Skin platí jen na plochý rozvin;
  ve 3D si barvy drží cubing.js, a proto se do 3D nikdy nepřepíná samo —
  z plochého náhledu se scramble dá přehrát tlačítkem a obrázek se pak vrátí
- scramble se ukládá ke každému solvu jako string; při reimportu se nikdy neregeneruje
- ruční vložení scramblu (paste) pro trénink konkrétní situace

### 3.3 Historie

- seznam solvů aktivní session, nejnovější nahoře, virtualizovaný
- detail solvu: čas, penalta, scramble, náhled, splity, tagy, poznámka, časové razítko
- dodatečná editace: penalta, tagy, poznámka, hvězdička, i samotný `rawMs` (překlep)
  — každá editace nastaví `editedAt`
- mazání solvu (tombstone), hromadné mazání označených
- sessiony: založení, přejmenování, archivace; právě jedna aktivní session
  na kombinaci `puzzle + mode`

### 3.4 Statistiky

Počítáno vždy nad **finálními** časy (viz 4.4), v rámci aktivní session,
kromě PB, které je globální per `puzzle`.

- current / best ao5, ao12, ao50, ao100
- PB single, PB každého okna
- session mean (aritmetický průměr všech neDNF solvů), median
- směrodatná odchylka (populační, nad neDNF solvy)
- DNF rate, +2 rate
- histogram časů (šířka koše odvozená z rozsahu, min. 0,5 s)
- trend rolling ao12 (line chart, osa X = index solvu)

**Pravidla průměrů:**

- `aoN` = trimmed mean: pro N ≤ 12 se odřízne 1 nejlepší a 1 nejhorší,
  pro N > 12 se odřízne `ceil(N * 0.05)` z každé strany (konvence csTimer)
- DNF se řadí jako nejhorší; pokud počet DNF přesáhne počet odříznutých z horní strany,
  výsledek je `DNF`
- okno je souvislé — méně než N solvů → `null` (zobrazuje se `—`)

### 3.5 Trenažér algoritmů

- sady: **PLL** (21), **OLL** (57), **F2L** (41 základních případů); rozšiřitelné
- **2-Look OLL** (10) a **2-Look PLL** (6) jsou samostatné sady navěšené na plnou
  sadu (přepínač 2-Look / Full). Ne filtr nad plnou sadou: první look OLL má tři
  hranové tvary, které mezi 57 případy vůbec nejsou, a druhý look chce případy
  pod jmény, pod kterými se učí (Sune, Bowtie, …). Každý krok se kreslí jinak —
  u OLL nejdřív jen hrany, u PLL nejdřív jen rohy
- **statický náhled případu kreslí aplikace sama** (`components/CubeDiagram.tsx`)
  z vlastního modelu kostky (`domain/cube/`), ne `<twisty-player>`: na jedné
  obrazovce je až 57 náhledů a tolik custom elementů telefon nedá. Twisty se
  načítá až ve chvíli, kdy si uživatel nechá algoritmus **přehrát**
- **náhled je obrázek, ne strom elementů**: SVG se poskládá jako text
  (`components/cube-diagram-svg.ts`), zapamatuje podle klíče
  `skin|view|stickering|stav` a vykreslí jediným `<img>`. Kostka z 54 obdélníků
  krát 57 případů byly přes tisíc uzlů na obrazovku a telefon je layoutoval
  vteřiny, během kterých nereagovalo nic — ani ťuknutí, ani zápis do DB
  (měřeno: 1189 → 82 uzlů, 14 → 3 dlouhé úlohy). Překreslí se, až když se
  změní skin nebo případ; karty mají `content-visibility: auto`, takže to,
  co není vidět, nestojí nic
- pohled podle sady: PLL a OLL jako klasický LL diagram (OLL jen orientace,
  žlutá/šedá), F2L isometricky s obarveným jen řešeným párem
- u permutačních případů se kreslí **šipky, kam který kus patří** (výměna =
  jedna obousměrná šipka); bez nich se v PLL nedá orientovat
- **skiny**: barevná schémata nálepek (`lib/cube-skins.ts`, nastavení `ui.cubeSkin`);
  proto vlastní vykreslování — twisty si barvy určuje sám
- **triggery**: pojmenované sekvence (sexy move, sledgehammer, …) se v algoritmu
  zvýrazňují; matchuje se nejdelší shoda zleva. Zabudované jdou vypnout, přepsat
  (tím přechází na uživatele) i smazat; vlastní se přidávají. Tabulka `triggers`.
  Každý trigger je **karta, ne řádek tabulky**: jméno, tahy přes celou šířku a
  barvy jako terčíky na prst — na telefonu se do jednoho řádku nevejde nic, do
  čeho by šlo psát
- **legenda notace**: každý tah jako obrázek kostky po jeho provedení, včetně
  širokých tahů; legenda uvádí oba zápisy, protože zdroje algoritmů používají oba
- **jeden zápis širokých tahů**: čte se `Rw` i `r`, ale **vypisuje se vždy krátce**
  (`f`, ne `Fw`) — jinak stejný algoritmus vypadá na dvou místech jako dva.
  Normalizuje se i to, co uživatel napíše (`db/repositories/alg-repository.ts`),
  aby se karta případu a detail shodly; nečitelný text se uloží tak, jak byl napsán
- **zrcadlení případu se nedělá** (zkoušeno a zahozeno): zrcadlený F2L pár patří
  do druhého slotu, a překlopený obrázek ukazuje jiné stěny, než na jaké se
  algoritmus odkazuje. Levoruké varianty by chtěly vlastní sadu pro druhý slot
- **animace jen v režimu 3D** (nastavení `ui.twistyMode`); přehrávač dostane
  `experimental-stickering` podle sady, takže i při přehrávání je kostka
  ztmavená kromě políček, o která jde. Přehrává se **přesně to, co je napsané** — twisty
  maluje bílou nahoru, zatímco diagramy mají žlutou, ale kostka, která na `F`
  otočí `B`, je horší než kostka špatné barvy (zkoušeno, vráceno)
- **twisty se nedá obarvit skinem** — barvy si drží cubing.js (má sice experimentální
  `experimentalSprite`, ale to je textura, ne paleta). Volba je tedy vědomá:
  `ui.twistyMode` říká, jestli chceš svoje barvy (plochý rozvin), nebo animovanou
  kostku v barvách cubing.js
- triggery mají vlastní barvu zvýraznění (pole `Trigger.colour`)
- výchozí volba mezi 2-Look a Full je nastavení `trainer.twoLookDefault`;
  `trainer.showAlgs` vypíše algoritmus i na kartu v seznamu případů
- pack algoritmy musí **skončit s kostkou nastojato** (rotace uvnitř se musí
  vyrušit) — jinak by se případ kreslil z jiné strany; hlídá to test
- F2L sada se negeneruje ručně: `scripts/generate-f2l.ts` prohledá tahy R, U, F
  do hloubky 9 a najde ke každé z 41 poloh páru nejkratší algoritmus. Ze všech
  AUF variant se vybírá ta, kde jsou **oba kusy páru vidět** (roh vpředu vpravo
  nahoře nebo ve slotu) — algoritmus si pak nese AUF sám, jak to dělají
  publikované seznamy
- druhý průchod hledá **variantu s otočením kostky** (`y` / `y2` / `y'` a pak jen
  R a U) — rotace nehýbe kostkami, mění jen to, která ruka pracuje. Vyšla u 20
  ze 41 případů a seeduje se jako druhý zabudovaný algoritmus, neaktivní;
  zobrazení se dá vypnout nastavením `trainer.showRotationAlgs`
- drill mód (vlastní obrazovka): náhodný případ z vybrané podmnožiny, scramble
  je setup případu s náhodným AUF a otočením kostky (`y`-rodina — `x`/`z` by
  sundaly žlutou z vršku), měření času stejným timerem jako běžný solve.
  Jméno případu, algoritmus i statistiky případu se odkryjí **až po pokusu**;
  rozpoznání je půlka toho, co se drilluje. Tlačítko „ukázat“ případ odhalí
  předem a pokus se pak počítá jako DNF
- **drill nad případem neinspektuje** (inspekce se přebíjí, ne čte z nastavení): 15 s
  WCA inspekce nad třísekundovým PLL netrénuje nic a automatická +2 by padala
  na každý pokus, kde se člověk nad případem zamyslel. **Cross je opačný případ** —
  přečíst scramble a naplánovat cross uvnitř inspekce je přesně to, co se trénuje,
  takže tam se inspekce řídí přepínačem timeru (a je i na drill obrazovce)
- výběr podmnožiny je jeden plochý seznam `caseId` napříč sadami
  (`trainer.drillCaseIds`); nezaškrtnuto = celá sada. Rychlé volby: celá sada,
  nejpomalejších 10
- **cross je taky sada k drillování** (`cross`) — jeden případ, žádný algoritmus
  k přečtení a scramble je skutečný random-state z cubing.js. Řádek v `algSets`
  a `algCases` má proto, že pokus míří na `caseId` a per-case statistiky se
  podle něj počítají; z trenažéru (seznam sad) je schovaný
- **cross se řeší, ne memoruje**, takže po pokusu (a po „ukázat") se vypíše
  **nejkratší možný cross** — `domain/cube/cross-solver.ts`. Cubing.js na to
  není potřeba: čtyři hrany mají 24 poloh každá, celý prostor se vejde do
  jednoho `Uint8Array` (24⁴ ≈ 332 tis. políček) a BFS ze složeného kříže dá
  **přesné** vzdálenosti; řešení se pak nehledá, jen se čte sestup z tabulky,
  takže je vždycky optimální (v HTM, nejvýš 8 tahů). Vypíše se **víc řešení téže
  délky** (bez těch, co jsou jen jiné pořadí týchž tahů) — které sedne do ruky,
  je celý smysl toho koukání. Tabulka se staví líně,
  jednou, mimo běžící timer
- **poloha se nepředepisuje, vybírá se**: kostku lze po scramblu vzít křížem
  dolů čtyřmi způsoby a tahy se pro každý liší. Místo prefixu `z2` a doufání
  jsou na obrazovce **čtyři barvy** a ťuknutím na tu, kterou máš vpředu, se
  řešení přepíše (`CROSS_HOLDS`, nastavení `trainer.crossFront`). Vysvětluje
  to konvenci beze slov. Řeší se vždy kříž **té stěny, co je dole** — solver
  si barvy přečte ze středů, ne z výchozího obarvení
- statistiky zvlášť per case: počet pokusů, best, ao5, ao12, poslední čas, DNF rate,
  „nejpomalejších 10 případů“ jako doporučení k tréninku
- **pokus jde opravit i zahodit**: rychlá penalta a smazání hned po pokusu v drillu
  (spadlá kostka se řeší tam, kde o ní víš), a v detailu případu seznam posledních
  pokusů s toutéž volbou plus „smazat všechny pokusy případu“. Mazání je normální
  smazání solvu, tedy **s tombstonem**. Cross nemá v trenažéru detail případu,
  do kterého by se to dalo dát, takže **svou historii drží na drill obrazovce** —
  v místě, kde ostatní sady mají výběr případů
- obrazovka sady ukazuje, **co je nadrilované** (kolik případů z kolika, kolik pokusů)
  a **nejpomalejší případy** jako tlačítka, která případ rovnou otevřou
- **drill session se nenabízí v seznamu sessionů**: je to aktivní session pro
  `mode: 'drill'`, přepnutí na ni nic viditelného nedělá
- vlastní algoritmus: uživatel může k případu přidat variantu a označit ji jako aktivní;
  zabudovaný pack se při updatu aplikace **nikdy** nepřepíše přes uživatelskou variantu
- vlastní případy (`isCustom: 1`) — vlastní název, setup alg, sada

Drilly se ukládají do stejné tabulky `solves` s `mode: 'drill'` a `caseId`.
Do hlavních statistik a PB **nevstupují** (filtr `mode === 'freestyle'`).

### 3.6 Fázové splity

Splity dělí solve na fáze (u CFOP cross / F2L / OLL / PLL). Zaznamenávají se
detekcí **nástupu zvuku** (onset) ve Web Audio API — uživatel na konci fáze klepne
na stůl / kostku. **Nejde o rozpoznávání řeči** a nikdy nesmí odejít žádný zvuk mimo zařízení.

- `AudioWorklet` počítá krátkodobou energii; onset = překročení adaptivního prahu
  nad klouzavým průměrem + `refractoryMs` (default 250 ms) na potlačení zákmitů
- kalibrace v nastavení: výběr vstupu, práh, gain, live meter, test detekce
- splity se přiřazují k fázím **v pořadí** podle definice metody; chybějící fáze je povolená
- dodatečná editace: posun času splitu, doplnění chybějícího, smazání celé sady
- zdroj každého splitu je uložen (`mic` / `smartcube` / `manual`) — smart cube přes
  Web Bluetooth je plánovaný, model už s ním počítá

> **Otevřené rozhodnutí (vědomě odložené).** Přesná sémantika splitů se doladí až při
> implementaci fáze 6. Model je proto navržený tak, aby změna nebolela:
> splity jsou **embedded pole uvnitř solvu** (ne vlastní tabulka, žádné cizí klíče k migraci),
> `phase` je volný `string` odkazující do `methods.phases[].key` (ne enum v kódu),
> časy jsou **kumulativní od startu** (z nich lze dopočítat délky fází, obráceně to při
> chybějící fázi nejde) a celý blok nese vlastní `splitsSchemaVersion`, takže lze migrovat
> jen splity bez zásahu do zbytku DB.

### 3.7 Export / import

- export: jeden JSON soubor se všemi tabulkami + tombstones (viz 4.7); řádky
  se řadí podle primárního klíče, takže dva exporty stejných dat jsou identické
- import ve dvou režimech:
  - **merge** — párování podle `id`, vyhrává vyšší `updatedAt`, tombstones mažou
  - **replace** — smazat vše a nahradit obsahem souboru
- **smazání vs. editace:** tombstone řádek smaže, pokud `deletedAt >= updatedAt`
  toho řádku; novější editace tedy smazaný řádek vzkřísí. Platí to na obě strany
  (tombstones lokální i ze souboru), takže na směru importu nezáleží — A do B a
  B do A skončí stejně
- před importem vždy preview: kolik záznamů přibude / změní se / smaže se
- device-local nastavení (kalibrace mikrofonu, vybrané audio zařízení) se
  **neexportuje** a import ho nikdy nepřepíše — ani v režimu replace
- „smazat všechna data“ je jediné mazání **bez** tombstonů: jinak by po něm
  nešel naimportovat vlastní starší export

## 4. Datový model

Nejdůležitější část specifikace. Platí:

- **PK je vždy `id: string` = `crypto.randomUUID()`** — kvůli mergi mezi zařízeními
- každý záznam má `createdAt` a `updatedAt` (epoch ms, UTC)
- mazání = zápis do `tombstones` + odstranění řádku
- **IndexedDB neumí indexovat `boolean`** → všechny indexované příznaky jsou `0 | 1`
- časy jsou celé milisekundy, nikdy float, nikdy sekundy
- odvozené hodnoty (finální čas, průměry, per-case statistiky) se **neukládají**
- dokud neexistuje export, žijí data jen v jedné IndexedDB → aplikace si při startu
  vyžádá `navigator.storage.persist()` a neúspěšné otevření DB jednou zopakuje

### 4.1 TypeScript typy

```ts
type Puzzle = '333' | '222' | '444' | '555' | 'pyram' | 'skewb' | 'sq1' | 'clock' | 'minx';
type SolveMode = 'freestyle' | 'drill';
type Penalty = 'none' | 'plus2' | 'dnf';
type PenaltySource = 'auto' | 'manual';
type SplitSource = 'mic' | 'smartcube' | 'manual';
type Flag = 0 | 1;

interface Split {
  phase: string;          // -> Method.phases[].key, volný string záměrně
  atMs: number;           // kumulativně od startu solvu
  source: SplitSource;
  confidence?: number;    // 0..1, jen u automatické detekce
}

interface Solve {
  id: string;
  sessionId: string;
  puzzle: Puzzle;         // denormalizováno ze session — kvůli globálnímu PB indexu
  mode: SolveMode;
  caseId: string | null;  // vazba na AlgCase, jen pro mode === 'drill'

  scramble: string;
  rawMs: number;          // naměřený čas bez penalty, integer
  penalty: Penalty;
  penaltySource: PenaltySource;

  inspectionMs: number | null;  // null = inspekce vypnutá
  startedAt: number;            // epoch ms

  splits: Split[];              // [] = neměřeno
  splitsSchemaVersion: number;  // aktuálně 1

  tagIds: string[];
  note: string | null;
  starred: Flag;

  editedAt: number | null;      // != null => uživatel po uložení něco změnil
  createdAt: number;
  updatedAt: number;
}

interface Session {
  id: string;
  name: string;
  puzzle: Puzzle;
  mode: SolveMode;
  methodId: string;       // -> Method.id, default 'cfop'
  isArchived: Flag;
  isActive: Flag;         // max. jedna aktivní na (puzzle, mode)
  createdAt: number;
  updatedAt: number;
}

interface Tag {
  id: string;
  name: string;
  color: string;          // hex
  createdAt: number;
  updatedAt: number;
}

interface Method {
  id: string;             // 'cfop'
  name: string;
  puzzle: Puzzle;
  phases: { key: string; label: string; order: number }[];
  createdAt: number;
  updatedAt: number;
}

interface AlgSet {
  id: string;             // 'pll', 'oll', 'f2l'
  name: string;
  puzzle: Puzzle;
  methodId: string;
  packVersion: number;    // verze zabudovaného datasetu
  createdAt: number;
  updatedAt: number;
}

interface AlgCase {
  id: string;             // 'pll-t', 'oll-27', ...
  setId: string;
  name: string;
  group: string | null;   // 'corners only', 'dot', ...
  setupAlg: string;       // aplikuje se v <twisty-player>
  order: number;
  isCustom: Flag;
  packVersion: number | null;   // null u vlastních případů
  createdAt: number;
  updatedAt: number;
}

interface Algorithm {
  id: string;
  caseId: string;
  moves: string;
  isActive: Flag;         // právě jedna aktivní na caseId
  source: 'pack' | 'user';
  packVersion: number | null;
  createdAt: number;
  updatedAt: number;
}

interface Trigger {
  id: string;
  name: string;
  moves: string;
  source: 'pack' | 'user';
  colour?: string;       // barva zvýraznění; chybí = výchozí
  isEnabled: Flag;       // 0 = ponechat, ale nezvýrazňovat
  createdAt: number;
  updatedAt: number;
}

interface Setting {
  key: string;            // PK
  value: unknown;         // JSON-serializovatelné
  deviceLocal: Flag;      // 1 => vyloučeno z exportu
  updatedAt: number;
}

interface Tombstone {
  id: string;             // = id smazané entity
  table: string;
  deletedAt: number;
}
```

### 4.2 Dexie schéma

```ts
export class RubixDB extends Dexie {
  solves!: Table<Solve, string>;
  sessions!: Table<Session, string>;
  tags!: Table<Tag, string>;
  methods!: Table<Method, string>;
  algSets!: Table<AlgSet, string>;
  algCases!: Table<AlgCase, string>;
  algorithms!: Table<Algorithm, string>;
  triggers!: Table<Trigger, string>;
  settings!: Table<Setting, string>;
  tombstones!: Table<Tombstone, string>;

  constructor() {
    super('rubix');
    this.version(1).stores({
      solves:
        'id, sessionId, caseId, createdAt, updatedAt, starred, *tagIds, ' +
        '[sessionId+createdAt], [caseId+createdAt], [mode+puzzle], [puzzle+mode+penalty]',
      sessions:
        'id, puzzle, mode, updatedAt, [puzzle+mode+isActive], [mode+isArchived]',
      tags:       'id, &name, updatedAt',
      methods:    'id, puzzle',
      algSets:    'id, puzzle, methodId',
      algCases:   'id, setId, isCustom, updatedAt, [setId+order]',
      algorithms: 'id, caseId, updatedAt, [caseId+isActive]',
      settings:   'key, deviceLocal, updatedAt',
      tombstones: 'id, deletedAt, [table+deletedAt]',
    });

    // v2 = trenažérové triggery; stará verze se needituje, přidává se jen
    // změněná tabulka.
    this.version(2).stores({
      triggers: 'id, updatedAt, isEnabled',
    });
  }
}
```

**K čemu který index je:**

| Index | Dotaz |
|---|---|
| `solves.[sessionId+createdAt]` | historie session, klouzavá okna ao5–ao100 |
| `solves.[caseId+createdAt]` | statistiky konkrétního případu v trenažéru |
| `solves.[mode+puzzle]` | oddělení drillů od freestyle napříč sessiony |
| `solves.[puzzle+mode+penalty]` | globální PB single (přeskočí DNF bez načítání všeho) |
| `solves.*tagIds` | filtr historie podle tagu |
| `solves.starred` | seznam „k rozboru“ |
| `sessions.[puzzle+mode+isActive]` | nalezení aktivní session |
| `algorithms.[caseId+isActive]` | aktivní algoritmus případu |
| `*.updatedAt` | inkrementální export / merge při importu |

### 4.3 Vazby

```
Session 1 ── n Solve
AlgCase 1 ── n Solve         (jen mode='drill', Solve.caseId)
AlgCase 1 ── n Algorithm     (právě jedna isActive=1)
AlgSet  1 ── n AlgCase
Method  1 ── n Session       (určuje fáze pro splity)
Tag     n ── n Solve         (Solve.tagIds, multiEntry index)
Solve   1 ── n Split         (embedded, ne tabulka)
```

Referenční integrita se drží v repository vrstvě, ne v DB:
smazání session smaže i její solvy (v transakci), smazání tagu odstraní jeho `id`
ze všech solvů, smazání `AlgCase` osiří `Solve.caseId` → nastaví se `null`.

### 4.4 Odvozené hodnoty (nikdy neukládat)

```ts
finalMs(s: Solve): number | null   // dnf -> null; plus2 -> rawMs + 2000; jinak rawMs
isDnf(s: Solve): boolean
phaseDurations(s: Solve): { phase: string; ms: number }[]  // diff kumulativních atMs
```

### 4.5 Nastavení (klíče)

| key | deviceLocal | default |
|---|---|---|
| `timer.holdThresholdMs` | 0 | 300 |
| `timer.inspectionEnabled` | 0 | 1 |
| `timer.inspectionCues` | 0 | `[8000, 12000]` |
| `timer.showScramblePreview` | 0 | `true` |
| `ui.theme` | 1 | `'system'` |
| `ui.twistyMode` | 0 | `'2D'` |
| `ui.cubeSkin` | 0 | `'classic'` |
| `trainer.twoLookDefault` | 0 | `false` |
| `trainer.showAlgs` | 0 | `false` |
| `trainer.showRotationAlgs` | 0 | `true` |
| `trainer.drillSetId` | 0 | `'pll'` |
| `trainer.drillCaseIds` | 0 | `[]` |
| `trainer.crossFront` | 0 | `'F'` |
| `stats.chartWindow` | 0 | 100 |
| `audio.inputDeviceId` | **1** | `null` |
| `audio.thresholdDb` | **1** | -30 |
| `audio.refractoryMs` | **1** | 250 |
| `schema.splitsVersion` | 0 | 1 |

### 4.6 Seed data

Při prvním spuštění (a při zvýšení `packVersion`) se seedují `methods`, `algSets`,
`algCases`, `algorithms` ze statických JSON souborů v `src/db/seed/`.
Seed je **idempotentní upsert podle `id`** a nikdy nepřepíše řádek se `source: 'user'`
ani `isCustom: 1`.

### 4.7 Formát exportu

```jsonc
{
  "format": "rubix-export",
  "formatVersion": 1,
  "exportedAt": 1756684800000,
  "appVersion": "0.4.0",
  "dbVersion": 1,
  "data": {
    "sessions": [], "solves": [], "tags": [],
    "methods": [], "algSets": [], "algCases": [], "algorithms": [], "triggers": [],
    "settings": [],      // bez deviceLocal === 1
    "tombstones": []
  }
}
```

Import validuje `formatVersion` a odmítne novější, než umí. Migrace starších
formátů žije v `src/db/migrations/import/`.

## 5. Obrazovky

| # | Obrazovka | Obsah |
|---|---|---|
| 1 | **Timer** | scramble + náhled, velký čas, inspekce, poslední solve s rychlou penaltou, mini-statistiky (ao5/ao12/session mean) |
| 2 | **Historie** | seznam solvů session, filtry (tag, penalta, hvězdička), hromadné akce |
| 3 | **Detail solvu** | modal/drawer: čas, scramble + náhled, splity, tagy, poznámka, editace |
| 4 | **Sessiony** | seznam, založení, přejmenování, archivace, přepnutí aktivní |
| 5 | **Statistiky** | karty s ao/PB/mean/SD/DNF rate, histogram, trend rolling ao12 |
| 6 | **Trenažér — sady** | PLL / OLL / F2L, progress a nejslabší případy |
| 7 | **Trenažér — případ** | `<twisty-player>`, varianty algoritmů, statistiky případu |
| 8 | **Drill** | timer nad náhodným případem z vybrané podmnožiny |
| 9 | **Nastavení** | timer, vzhled, kalibrace mikrofonu s live meterem |
| 10 | **Data** | export, import (preview + merge/replace), smazání všech dat, troubleshooting |

Navigace: **hamburger menu** v hlavičce se všemi routami; hlavička ukazuje název
aktuální obrazovky. Timer je výchozí route. (Původně tu byl dolní tab bar na
mobilu — obrazovek je ale víc, než se do něj vejde, a s trenažérem a nastavením
jich bude ještě víc.) Dokud je menu otevřené, klávesy patří jemu, ne timeru.

Každá akce, po které obrazovka vypadá stejně jako předtím (export, import,
smazání dat), musí říct, že se stala — `components/Notice.tsx`.

**Dotykové cíle**: co se na telefonu ťuká prstem, má aspoň ~44 px výšky. Zaškrtávátko
se nezvětšuje samo o sobě — plochu nese `<label>` kolem něj. Pravidla jsou pohromadě
na konci `index.css`, aby si je nemusela pamatovat každá komponenta zvlášť.

**Když databáze přestane odpovídat**: IndexedDB umí spojení zavřít pod rukama
(Android zmrazí PWA na pozadí) a zápis může uvíznout ve frontě, která se sama
nerozjede — obrazovky si pak drží poslední obsah, ťukání nedělá nic a nevyhodí se
jediná chyba. Řetěz obrany:

- `ensureDatabaseOpen()` má timeout a hlásí, když se nedočkal; `db.on('blocked')`
  se hlásí, `db.on('close')` se **jen zapíše do logu** a rovnou zkouší otevřít znovu
  (co se samo spraví, nemá dělat červený banner)
- návrat aplikace do popředí spojení překontroluje
- každý zápis „fire-and-forget" jde přes `watchWrite()`. Pomalý zápis **sám o sobě
  nic neznamená** — telefon při načítání 3D kostky blokuje hlavní vlákno na sekundy —
  takže se nejdřív pošle sonda (triviální čtení). Když odpoví, je ticho; když
  neodpoví ani ta, ohlásí se to a spojení se **samo přepojí**
- **živé dotazy nepřežijí své spojení.** Po každém opětovném otevření jde nahoru
  `databaseGeneration()` a `App` podle něj přemountuje obrazovky — bez toho je
  databáze „connected", ale seznamy zůstanou prázdné (přesně tak vypadalo
  „zmizely všechny algoritmy"). Ze stejného důvodu se po přepojení znovu pouští seed
- **dvě kopie aplikace jsou normální stav** (instalovaná PWA + tab v prohlížeči) a
  telefon tu na pozadí zmrazí. Zmrazená stránka si drží spojení i rozdělanou
  transakci, a tím blokuje tu kopii, na kterou se uživatel dívá — reload té
  viditelné nepomůže, protože blokáda je jinde. Proto se při `freeze`/`pagehide`
  spojení **pouští** a při `resume`/`pageshow` bere zpět
- `surveyDatabase()` změří každou tabulku zvlášť plus čerstvé spojení mimo Dexie
  a zapíše jednu řádku typu `settings=STUCK algorithms=1ms newConnection=0ms`.
  Spouští se sama, když zápis nedoběhne, a je i tlačítkem na obrazovce Data —
  bez ní diagnóza končila u „databáze neodpověděla"
- poslední selhání se ukládají do `localStorage` (`lib/errors.ts`), protože se
  zkoumají až po restartu; obrazovka Data je vypisuje a nabízí ruční přepojení
- **prázdno se nesmí plést s „ještě nenačteno"**: hooky vracejí `undefined`, dokud
  databáze neodpověděla, a obrazovka na to říká „načítám", ne „nic tu není"

## 6. Fáze

Každá fáze je samostatně použitelný produkt — po jejím dokončení má smysl aplikaci
používat, i kdyby další nikdy nepřišla.

### Fáze 1 — Použitelný timer

Vite + React + TS skeleton, PWA shell (offline), Dexie s **kompletním schématem v1**
(i tabulky, které ještě nikdo nečte — vyhneme se tím pozdější migraci), scramble ve
workeru, timer s hold-to-start a inspekcí, uložení solvu, plochý seznam posledních solvů,
rychlá penalta u posledního solvu. Jedna implicitní session „Default“.
→ *Použitelné jako: plnohodnotný offline timer.*

### Fáze 2 — Sessiony, historie, tagy

Správa sessionů, plná historie s filtry, detail solvu, dodatečná editace penalty /
času / poznámky, tagy, hvězdička, mazání s tombstones.
→ *Použitelné jako: timer s pořádnou historií.*

### Fáze 3 — Statistiky a grafy

Doménový modul `stats` (ao5–ao100, PB, mean, median, SD, DNF rate), obrazovka
statistik, histogram + trend rolling ao12 v Recharts.
→ *Použitelné jako: kompletní náhrada csTimeru pro vlastní použití.*

### Fáze 4 — Export / import

Serializace všech tabulek, preview importu, merge i replace, ochrana device-local
nastavení. Od téhle chvíle nehrozí ztráta dat při vyčištění prohlížeče.
→ *Použitelné jako: zálohovatelná aplikace, přenos mezi zařízeními.*

### Fáze 5 — Trenažér algoritmů

Seed PLL/OLL/F2L, sady a případy, `<twisty-player>`, drill mód (`mode: 'drill'`),
statistiky per case, vlastní varianty algoritmů, vlastní případy.
→ *Použitelné jako: samostatný trenažér algoritmů.*

### Fáze 6 — Fázové splity přes mikrofon

**Vedený solve** (scramble → cross → F2L → OLL → PLL s mezičasy) patří sem, ne do
drillu: drill měří jeden případ, tohle měří jeden solve po fázích. Bude to **volba
v timeru** („jen celkový čas“ / „po fázích“), ne další obrazovka — a ruční varianta
(ťuknutí na konci fáze) nepotřebuje mikrofon, ten je až druhá implementace téhož.

`AudioWorklet` onset detektor za rozhraním `SplitSource`, kalibrace v nastavení,
zápis splitů do solvu, zobrazení a editace splitů v detailu, průměrné časy fází
ve statistikách. Sémantika splitů se dorozhodne tady (viz 3.6).
→ *Použitelné jako: analýza slabé fáze.*

### Fáze 7 — Smart cube (později)

Druhá implementace `SplitSource` přes Web Bluetooth (`source: 'smartcube'`),
případně rekonstrukce tahů. Datový model se kvůli tomu **nemění**.
