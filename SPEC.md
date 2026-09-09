# Rubix — specifikace

Offline PWA trenažér na Rubikovu kostku pro speedcubing.

## 1. Cíle a hranice

**Cíl:** osobní trenažér — timer, historie, statistiky, drill algoritmů, fázové splity.
Používá autor a pár známých, distribuce přes URL na Cloudflare.

**Non-goals (platí pro celý projekt):**

- žádný backend, žádné API, žádná autentizace, žádné uživatelské účty
- žádná telemetrie o uživateli, crash reporting ani jiný odchozí síťový provoz za běhu.
  Jediná výjimka je **Cloudflare Web Analytics** (počet zobrazení stránky, žádná data
  o solvech, žádné id zařízení) — podmínky, za kterých tam smí být, jsou v CLAUDE.md,
  „Co se nikdy nedělá", bod 1
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
  na 8 s a 12 s (jen lokální beep, žádný TTS). Zbývající čas kreslí i **pruh pod
  číslem**, který ubývá — s cubem v obou rukou se to čte bez čtení. Pruh, ne kruh
  kolem číslic: hodiny můžou být v sedmisegmentovém písmu o polovinu širším a ve
  třech velikostech, a kruh, který sedne jedné kombinaci, leze do ostatních.
  Pruh i číslo mění barvu na stejných cue jako pípání, aby si neodporovaly
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
- mazání solvu (tombstone), hromadné mazání označených; každé mazání solvů
  se dá ~5 s vzít zpět (viz 5, „Omyl a návrat")
- sessiony: založení, přejmenování, archivace; právě jedna aktivní session
  na kombinaci `puzzle + mode`
- přepínání sessions nemá vlastní obrazovku: otevírá se ze jména session tam, kde je
  napsáno — na timeru, v historii a ve statistikách. Zvolená session je aktivní
  session, tedy zároveň to, co je vidět, i to, kam padne další složení

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
- **případ může mít víc vestavěných algoritmů**: vlastní odpověď packu
  (`<case>-pack`), tentýž postup s otočenou kostkou (`-pack-grip`, schovaný za
  `trainer.showRotationAlgs`) a **jiné řešení téhož případu** (`-pack-other-N`,
  pole `others` v packu). To poslední se neschovává — seznam variant je přesně
  na to — a aktivní se nestane samo; U permy tak vedle sebe nabízejí verzi se
  slice tahy i bez nich. Každý extra se ověřuje spuštěním stejně jako hlavní
  algoritmus
- **statický náhled případu kreslí aplikace sama** (`components/CubeDiagram.tsx`)
  z vlastního modelu kostky (`domain/cube/`), ne `<twisty-player>`: na jedné
  obrazovce je až 57 náhledů a tolik custom elementů telefon nedá. Twisty se
  načítá až ve chvíli, kdy si uživatel nechá algoritmus **přehrát**
- **náhled je obrázek, ne strom elementů**: SVG se poskládá jako text
  (`components/cube-diagram-svg.ts`), zapamatuje podle klíče
  `skin|muted|view|stickering|stav` a vykreslí jediným `<img>`. Kostka z 54 obdélníků
  krát 57 případů byly přes tisíc uzlů na obrazovku a telefon je layoutoval
  vteřiny, během kterých nereagovalo nic — ani ťuknutí, ani zápis do DB
  (měřeno: 1189 → 82 uzlů, 14 → 3 dlouhé úlohy). Překreslí se, až když se
  změní skin nebo případ; karty mají `content-visibility: auto`, takže to,
  co není vidět, nestojí nic
- pohled podle sady: PLL a OLL jako klasický LL diagram (OLL jen orientace,
  žlutá/šedá), F2L isometricky s obarveným jen řešeným párem
- u permutačních případů se kreslí **šipky, kam který kus patří** (výměna =
  jedna obousměrná šipka); bez nich se v PLL nedá orientovat
- **kde je přehrávání, je vidět i krok**: při přehrání scramblu (timer) i
  algoritmu (detail případu) dostane právě otáčený tah tečku pod sebou.
  Index se bere z twisty modelu (`experimentalModel.currentMoveInfo`,
  `patternIndex`) — vlastní hodiny by se od kostky na obrazovce během pár tahů
  rozešly. V DOM je to `aria-current="step"`, takže to není jen barva
- **skiny**: barevná schémata nálepek (`lib/cube-skins.ts`, nastavení `ui.cubeSkin`);
  proto vlastní vykreslování — twisty si barvy určuje sám
- **téma**: světlé / tmavé / podle systému (`ui.theme`, device-local). Paleta je
  jedna sada CSS proměnných zapsaná přes `light-dark()`, takže systémovou volbu
  řeší samo CSS a výslovná volba je jen `data-theme` na `<html>` (`lib/theme.ts`).
  Náhledy případů jsou obrázky, na které CSS nedosáhne, takže skin má `muted`
  (nálepky, na kterých případ nezáleží) zvlášť pro každé téma — na bílé kartě
  by tmavý odstín byl blok inkoustu
- **písmo**: Inter (text) a JetBrains Mono (tahy, časy) jsou **v buildu**
  (`src/fonts/`, variabilní, latin + latin-ext, OFL) — nic se nesmí tahat ze
  sítě a systémový stack vypadá na každém zařízení jinak. Volba `ui.font`
  přepíná mezi zabaleným sans, zabaleným mono a systémovým písmem; scramble a
  algoritmy jsou monospace vždycky. Písma musí být i v precache service workeru
  (`globPatterns` ve `vite.config.ts`), jinak by je aplikace měla jen při prvním
  spuštění
- **velikosti**: `ui.textSize` je jeden násobitel na kořenové velikosti písma —
  všechny rozměry ve stylopisu jsou v `rem`, takže roste i rozestup, ne jen
  písmena. `ui.clockSize` mění zvlášť běžící čas (`--clock-size`), který se čte
  z větší dálky než zbytek. Obojí je device-local: je to o obrazovce, která je
  před uživatelem, ne o tom, co má kdo rád. Vstupní pole mají
  `font-size: max(1rem, 16px)` — pod 16 px si telefon při zaostření stránku
  přiblíží, a škála tuhle hranici nesmí podlézt
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
- vlastní případy (`isCustom: 1`) — vlastní název, setup alg, sada.
  **Vědomě odložené, ne opomenuté** (viz fáze 5)

- **režim „poznej případ"** (přepínač *Solve it / Name it* na drill obrazovce): ukáže
  kostku a ptá se, který případ to je. Nic se neprovádí, kostka není potřeba —
  je to jediný trénink, který jde dělat cestou v tramvaji
  - **vidíš jen to, co bys viděl při solvu**: horní stěna a dvě boční
    (izometrický pohled, stickering podle sady — u OLL žlutá/šedá, u PLL barvy).
    Plný LL diagram se čtyřmi bočními pruhy se tu **nepoužívá**, protože ten
    kostka v ruce nikdy neukáže. Šipky u PLL taky ne — prozradily by odpověď
  - **zbylé dvě strany jsou na jedno ťuknutí** („Turn round" = pohled z druhého
    rohu, `y2`). Neplatí se za to DNF, platí se **časem** — přesně jako když
    otočíš kostku u stolu. U části OLL případů to jinak z jednoho rohu nejde
  - **odpovídá se ťuknutím na kartu, ne psaním ani výběrem ze jmen**: šest karet
    s diagramem toho případu, jak ho kreslí trenažér. Rozptylovači se berou
    **nejdřív ze stejné tvarové rodiny** (`group`) — šest náhodných z 57 by šlo
    poznat bez dívání
  - měří se `performance.now()` od vykreslení otázky (v efektu, tedy po
    vykreslení) do ťuknutí. Špatná odpověď = **DNF**; případ se pojmenuje tak
    jako tak, protože „poznal jsem to a nevím, jak se to jmenuje" je přesně ten
    stav, ze kterého má režim dostat ven
  - ukládá se do `solves` s `mode: 'recognition'`, do vlastní aktivní session,
    stejným způsobem jako drill. Per-case statistiky se počítají zvlášť (ao5
    rozpoznání ≠ ao5 řešení; jedno je vteřina, druhé pět) a v detailu případu
    jsou dvě sekce vedle sebe
  - **po odpovědi se vypíše i algoritmus**, a to pro ten úhel, ve kterém byl případ
    ukázaný: před ním stojí AUF, který k tomu patří. Nehledá se inverzí scramblu, ale
    **zkusí se všechny čtyři** a vezme se ten, po kterém kostka opravdu složí — vlastní
    algoritmus si AUF může nést sám a inverze scramblu by o něm nevěděla. AUF se kreslí
    **odděleně** od algoritmu: patří k téhle otázce, ne k případu (`domain/recognition/angle.ts`)
  - **celá otázka se musí vejít na obrazovku** — kostka a karty se porovnávají mezi
    sebou a scrollovat mezi nimi znamená pamatovat si, co bylo nahoře. Čtyři řádky
    ovládání (sada, 2-Look/Full, režim, výběr případů) stály 244 px z 915 a jsou to
    volby na jednou za sezení, takže jsou **složené do jednoho řádku**, který říká, na
    čem jsou (`OLL · Name it · 57 / 57`). Kostka má v šířce i `dvh` člen a „Next case"
    se po odpovědi objeví **vedle „Turn round"** pod kostkou — obě věci, co se dělají
    s kostkou, v jedné řadě, nad kartami a vždycky vidět. Pod kartami byl na nízkém
    displeji pod okrajem a každé kolo stálo scroll
  - sada i zaškrtnuté případy jsou **společné s drillem** (`trainer.drillSetId`,
    `trainer.drillCaseIds`) — vybrat si desítku, co ti nejde, se nemá dělat dvakrát
  - **cross tenhle režim nemá** (není co poznávat) a pod dva případy v poolu taky ne
- **vlastní název případu** (`AlgCase.label`): OLL se jmenuje „OLL 43" a nikdo při
  solvu nemyslí „čtyřicet tři". Uživatel si případ pojmenuje v jeho detailu; prázdné
  pole vrací název packu. Je to **nové pole, ne přepsané `name`** — seed přepisuje
  `name` při každém startu, takže přejmenování by vydrželo do dalšího spuštění;
  `label` se přenáší přes seed stejně jako barva triggeru (`existing?.label ?? null`).
  Název packu zůstává vidět pod tím vlastním, protože to je jméno, které používají
  všechny tabulky a videa venku

Drilly se ukládají do stejné tabulky `solves` s `mode: 'drill'` a `caseId`,
pokusy o rozpoznání s `mode: 'recognition'`. Do hlavních statistik a PB
**nevstupují** ani jedny (filtr `mode === 'freestyle'`).

### 3.6 Fázové splity

Splity dělí solve na fáze (u CFOP cross / F2L / OLL / PLL). Fáze se berou
z `Method.phases` aktivní session, **nikdy z enumu v kódu** — jiná metoda je pak
data, ne migrace.

**Vedený solve** je volba přímo na obrazovce timeru (`timer.splitMode`), ne další
obrazovka: „jen celkový čas" / „po fázích". Ve fázovém režimu ťuknutí (mezerník
nebo dotyk kdekoliv) ukončí právě běžící fázi a rovnou začne další; ťuknutí
za poslední fází zastaví čas. Během běhu je pod časem vidět **jen jméno fáze**
a její pořadí — vedení je celý smysl režimu, další číslo by jen odvádělo oči
od kostky.

**Sémantika (rozhodnuto při stavbě fáze 6, krok 1):**

- **Split je vnitřní hranice fáze.** Poslední fázi uzavírá `rawMs` solvu, takže
  čtyřfázová metoda ukládá nejvýš tři splity. Split na `rawMs` by byl duplikát
  čísla, které už existuje, a každá pozdější oprava času by ho musela dorovnávat.
  Invariant je pak triviální: `0 <= atMs[i] <= atMs[i+1] < rawMs`.
- **Vynechaná fáze je fáze nulové délky** — dvě hranice ve stejný čas. Nepotřebuje
  vlastní příznak ani tlačítko; při solvu se prostě ťukne dvakrát po sobě.
- **Chybějící hranice není vynechaná fáze, ale „nezměřeno".** Chybí-li hranice
  **uvnitř** zaznamenaných, je neznámá délka fáze před ní i po ní, protože známý je
  jen jejich součet: do průměrů nesmí ani jedna a pruh je kreslí jako jeden šedý blok.
- **Kde skončila poslední zaznamenaná hranice, tam solve skončil.** Fázi, do které
  solve dojel, se dopočítá z pořadí (poslední hranice + 1) a uzavírá ji `rawMs`;
  pozdější fáze se nestaly. Smazat poslední hranici v detailu proto znamená
  „tuhle fázi jsem neměřil **a dál už jsem nedojel**" — informaci o pozdějších
  fázích nese jen ta hranice. Vrátit ji je jedno ťuknutí a pruh i tabulka to hned
  ukážou, takže se to nedá udělat omylem a nevšimnout si.
- **Ťuknutí nejde vzít zpět.** Ruce jsou na kostce a undo by chtělo další gesto;
  oprava patří do detailu solvu, kde se splity stejně editují. Žádný práh proti
  zákmitu prstu — `refractoryMs` je věc onset detektoru, ne dotyku.
- **ESC zahodí celý pokus i se splity**, jako u běžného solvu. ESC má jeden význam
  a nedělá se z něj „smaž poslední split".
- **Fázový solve smí skončit dřív než na poslední fázi.** Ťuknutí **podržené** přes
  `holdThresholdMs` ukončí solve tam, kde je — skip OLL nebo PLL nesmí nutit
  doťukávat fáze, které se nestaly. Čas se bere z okamžiku **stisku**, takže držení
  nic nestojí. Na poslední fázi zastavuje stisk okamžitě, jak to timer dělal vždycky.
- `splits: []` zůstává „neměřeno". Fázový solve ukončený už v první fázi tedy
  nezaznamená nic — není co dělit.
- Fázový režim je jen freestyle timer; drill měří jeden případ, ne solve po fázích.

**Zobrazení a editace:**

- po dokončeném solvu (a v detailu solvu) **pruh fází**: blok na fázi, široký podle
  toho, jak dlouho trvala. Barvy se přiřazují **podle pořadí, ne podle jména** —
  první fáze bílá (cross), poslední žlutá (poslední vrstva), mezi tím zbylé barvy
  nálepek (`lib/phase-colours.ts`). Metoda, o které aplikace nikdy neslyšela, tak
  dostane čitelný pruh
- detail solvu: posun času kterékoliv hranice (edituje se **kumulativní** čas, protože
  ten je uložený a posun jedné hranice má změnit přesně dvě fáze), doplnění chybějící
  fáze (vloží se doprostřed bloku, který dělí), smazání jedné hranice i celé sady.
  Posun mimo sousední hranice se **odmítne**, neořízne — tiše oříznutý čas je špatný
  čas, o kterém se uživatel nedozvěděl
- **oprava `rawMs` zahodí hranice, které se do zkráceného solvu nevejdou** — split
  za koncem solvu není split
- **pruh je jedna komponenta ve třech hustotách** (`PhaseBar`, prop `detail`), ne kus
  kódu na obrazovku: `shape` = jen proužek (seznam pod běžícím timerem, kde jde vidět
  akorát tvar), `shares` = procentní podíl každé fáze napsaný do jejího bloku
  (historie a detail solvu), `labels` = jména a časy pod pruhem (dokončený solve pod
  hodinami)
- **podíly se počítají z `rawMs`** — z času, který se doopravdy točil. Inspekce v něm
  není a `+2` nepatří do žádné fáze; kdyby se počítalo z výsledného času, každý podíl
  by se o stejný vymyšlený kus zmenšil. Zaokrouhluje se metodou největšího zbytku,
  aby čísla pod jedním pruhem dala 100
- **v historii je zvýrazněný nejlepší výsledek a nejlepší dosažená délka každé fáze**
  — vždycky nad tím, co filtry pustí, ne nad celou session, a bez DNF i bez
  vynechaných fází (skip je případ, který nepřišel, ne rychle složené OLL; jinak by
  jediný skip zůstal nejlepším OLL napořád). Nejlepší čas
  je barvou, nejlepší fáze prstencem kolem svého bloku. **Řádek, který drží
  aspoň jedno z toho, se celý rozsvítí** (vyzvednutý podklad + accent hrana) a dostane
  hvězdičku k času — ta je v accentu a nadepsaná, aby se nepletla se ztlumenou
  hvězdičkou „mám ho v oblíbených" v meta řádku. Historie proto čte celý
  vyfiltrovaný výběr a stránkuje ho až při vykreslení: nejlepší čas, který se zlepší
  tím, že uživatel odroluje níž, není nejlepší čas
- statistiky: průměrné časy fází nad session, po oknech ao5 / ao12 / ao50 / ao100 / ALL.
  Sloupce fází se počítají nad **týmiž solvy, které projdou trimem** daného průměru,
  takže se při kompletně zaznamenaných hranicích sečtou na celkový čas vpravo
  (jediná výjimka je solve s `+2` — penalta nepatří do žádné fáze). Do tabulky
  vstupují **jen solvy měřené po fázích**; okno přes všechny solvy by bylo skoro
  vždycky prázdné
- řádek **Best** je nejrychlejší, co která fáze kdy byla. Je to jediný řádek, jehož
  sloupce se **nemají** sečíst na celkový čas — nejlepší kříž a nejlepší PLL skoro
  nikdy nejsou týž solve; vpravo proto stojí nejlepší single, ne jejich součet
- **trend fází** je stohovaný plošný graf klouzavého průměru: výška je celý solve,
  takže zrychlený kříž je vidět dvakrát — jako užší pásmo i jako nižší strop.
  Okno je **5**, ne 12 jako u trendu ao — fázově měřených solvů je míň než obyčejných,
  takže vyhrává nejmenší standardní okno. Do grafu jdou **jen solvy, kde je známá
  délka každé fáze**: graf, jehož díly nedávají dohromady solve, je horší než
  kratší graf
- zdroj každého splitu je uložen (`mic` / `smartcube` / `manual`) — ruční je zatím
  jediný, který se zapisuje

**Detekce nástupu zvuku (krok 2, zatím se nestaví — viz fáze 6):** uživatel na konci
fáze klepne na stůl / kostku, `AudioWorklet` počítá krátkodobou energii a onset je
překročení adaptivního prahu nad klouzavým průměrem + `refractoryMs` (default 250 ms)
na potlačení zákmitů; kalibrace v nastavení (výběr vstupu, práh, gain, live meter,
test detekce). **Nejde o rozpoznávání řeči** a nikdy nesmí odejít žádný zvuk mimo
zařízení. Splity se přiřazují k fázím **v pořadí** podle definice metody a chybějící
hranice je povolená — přesně ten případ, na který je pravidlo „nezměřeno" výše.

Model je navržený tak, aby změna sémantiky nebolela: splity jsou **embedded pole
uvnitř solvu** (ne vlastní tabulka, žádné cizí klíče k migraci), `phase` je volný
`string` do `methods.phases[].key`, časy jsou **kumulativní od startu** (z nich lze
dopočítat délky fází, obráceně to při chybějící fázi nejde) a celý blok nese vlastní
`splitsSchemaVersion`, takže lze migrovat jen splity bez zásahu do zbytku DB.

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
- **import z csTimeru** je jednosměrný a jen přidává (viz 3.8)
- **CSV export solvů** je bonus pro tabulkové procesory, ne záloha: jeden řádek
  na solve (čas, penalta, scramble, poznámka, tagy, délky fází ve sloupcích),
  jde jen ven a nikdy se nečte zpátky. Datum je `YYYY-MM-DD HH:MM:SS` v místním
  čase, soubor začíná BOM (jinak Excel rozbije diakritiku v poznámce)

### 3.8 Import z csTimeru

Jednosměrná cesta dovnitř pro člověka, který přichází z csTimeru. Umí obě jeho
varianty exportu: **JSON** z Export/Import → *Export to file* (csTimer mu dává
příponu `.txt`, takže se formát pozná podle obsahu, ne podle jména) a **CSV**
jedné session.

**Formát je odečtený ze zdrojáku csTimeru** (`src/js/stats/stats.js`,
`src/js/timer.js`), ne odhadnutý — jeden solve je

```
[[penalta, konec fáze N, konec fáze N-1, …, konec fáze 1], scramble, komentář, unix sekundy, rozšíření?]
```

a rozhodují dvě věci: `penalta` je `0` / `2000` (+2) / `-1` (DNF) a index 1 je
**surový** čas — csTimer zobrazuje `penalta + čas`, takže uložené číslo je čas
před penaltou, přesně jako `rawMs` tady. Hranice fází jdou od indexu 2
**pozpátku** (ťuknutí, které ukončilo první fázi, se zapisuje jako poslední),
jsou kumulativní od startu, a obrácené dávají naše pořadí.

**Co se mapuje:** čas → `rawMs`, penalta → `penalty` (vždy `penaltySource:
'manual'` — naše inspekce ji nenastavila), scramble, komentář → `note`,
timestamp → `startedAt` i `createdAt` (solve patří do doby, kdy se stal),
název session z `properties.sessionData`, typ scramblu → `puzzle` podle
prefixu (`333*`, `222*`, `444*`, `555*`, `pyr*`, `skb*`, `sq1/sqr*`, `clk*`,
`mgm*`). Inspekci csTimer neexportuje, takže `inspectionMs: null`.

**Pravidla, na kterých import stojí:**

- **fáze jen při shodném počtu.** Solve měřený na tolik fází, kolik jich má naše
  metoda (CFOP = 4), dostane splity; jakýkoli jiný počet se naimportuje **bez
  fází** — hranice mezi fázemi, které neumíme pojmenovat, by se musela hádat
  (csTimer umí až 10 fází a počet se bere per solve, ne z nastavení session —
  ty dvě věci se rozejdou, jakmile si člověk počet fází přenastaví). **Kolik
  solvů takhle o fáze přijde, říká náhled** — tichý úbytek by vypadal jako chyba
- **nikdy se nemíchá do stávající session.** Každá csTimer session je nová
  session pod svým jménem a **žádná se nestane aktivní** (import nesmí odsunout
  session, do které člověk zrovna měří)
- **opakovaný import nic nepřidá.** Duplicita = stejný `startedAt` a stejný
  `rawMs`; klíč se staví i ze souboru samotného, takže dvakrát zapsaný solve
  přijde jednou. Session, ze které by nezbylo nic nového, se **vůbec nezaloží**
  — jinak by každý další import nechával prázdné session
- **co neumíme, se řekne.** Session na 6×6 nebo na cokoli, pro co tu není
  puzzle, se vypíše v náhledu; rozbitý řádek se přeskočí a na konci je soupis
  s důvody (nečitelný čas, penalta, datum, rozbitý řádek) — celý import na
  jednom řádku nespadne
- **náhled napřed, zápis až po potvrzení**, jako u vlastního importu
- **zápis po dávkách** (250 řádků) s ukazatelem průběhu; 3000 solvů je běžná
  velikost a jedna transakce přes všechny by blokovala hlavní vlákno (a je to
  přesně ten druh dlouhé Dexie transakce, co commituje moc brzo)

**CSV umí míň a říká to:** nese formátované časy (setiny, +2 už v čase),
žádný název session a žádné puzzle. Jde tedy dovnitř jako 3×3 pod jménem
souboru a náhled na to upozorní — bezztrátový je JSON.

### 3.9 Průvodce metodou pro začátečníky

Samostatná obrazovka (**Learn**) se sedmi kroky jednoho celého složení: kříž,
rohy spodní vrstvy, hrany prostřední vrstvy, kříž poslední vrstvy, celá horní
stěna, rohy na místo, hrany na místo.

- **není to obrázková stránka**: každý případ na ní je skutečný případ z
  existující sady, kreslený stejným kódem jako v trenažéru, otevíratelný do
  stejného listu případu a přehratelný
- **nikam neposílá na drill**: měřit jeden případ na čas je věc někoho, kdo už
  kostku složí, a tahle stránka je pro dny předtím. Ze stejného důvodu se sada
  `beginner` nenabízí ani v seznamu sad na drillu — je to cesta jedním složením,
  ne sada k procvičování
- **nahoře je notace** (rozbalovací, tentýž `NotationReference` jako v trenažéru)
  a **vypínač stránky**: kdo už kostku složí, tady řekne, že to má z menu zmizet.
  Vrátit jde v nastavení, což je u vypínače napsané
- **stránka uvádí zdroj**, ze kterého metoda i pořadí kroků vycházejí
  (badmephisto.com) — odkaz, na který se klikne, ne požadavek, který by appka
  sama poslala
- **jeden algoritmus na krok, ne sada**: kroky 5–7 se otevírají jediným
  algoritmem, který ten krok celý zvládne opakováním, plus obrázky **jak kostku
  natočit** v ostatních případech (bez vlastního algoritmu). Přepínač pod tím
  ukáže krok tak, jak ho zná někdo rychlý — u kroku 5 celých sedm rohových OLL,
  u kroků 6 a 7 dvoulookové PLL. Jsou to dvě úrovně, ne skrývačka: sedm případů
  naráz je přesně to, po čem začátečník kostku odloží
- **vlastní sada `beginner`** (7 případů, 4 skupiny): rohy a hrany prvních dvou
  vrstev (metoda je staví po jednom kousku, což F2L nedělá) a po jednom
  algoritmu na rohy a hrany poslední vrstvy. Ty poslední dva jsou tu proto, že
  cyklus tří rohů (`R' F R' B2 R F' R' B2 R2`) nechá hrany úplně na pokoji a
  cyklus tří hran (`R U' R U R U R U' R' U' R2`) nechá na pokoji rohy — dva
  poslední kroky se tak nemůžou navzájem rozbít, což u dvoulookového PLL neplatí.
  V trenažéru se sada nenabízí — vedle F2L by četla jako druhý způsob téhož —
  ale drillovat jde
- **obrázky „jak držet“ se ověřují spuštěním** (`features/learn/steps.test.ts`),
  ne přečtením: každý drží algoritmus, kterým se z té situace ven leze, a test
  kontroluje, že je to **týž** algoritmus kroku (mezi opakováními smí být jen
  `U`), že obrázek nesahá pod poslední vrstvu a že sedí pravidlo, které je u něj
  napsané — u dvou žlutých rohů kouká žlutá nálepka předního levého rohu dopředu,
  u žádného doleva
- **krok 1 nemá případ**, protože kříž se neskládá z algoritmů. Místo něj je
  obrázek hotového kříže (`stickering: 'cross'`: kříž a všechny středy barevně,
  zbytek šedě — bez středů není proti čemu shodu barev číst)
- **každý krok se kreslí z místa, kde se odehrává**: rohy spodní vrstvy přes
  `stickering: 'bottomLayer'` (spodní vrstva a ten jeden roh, kdekoli je;
  prostřední vrstva ještě není a její hrana plovoucí nahoře jen mate), hrany
  prostřední přes `firstTwoLayers`, poslední vrstva přes `corners` / `edges`
- **skrytelné v nastavení** (`ui.showLearn`): kdo kostku skládá, tuhle obrazovku
  nepotřebuje. Mizí jen z menu — `#/learn` funguje dál, protože záložka na ni je
  člověk, který ji chce

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
type SolveMode = 'freestyle' | 'drill' | 'recognition';
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
  caseId: string | null;  // vazba na AlgCase, jen pro drill a recognition

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
  name: string;           // packu; seed ho přepisuje při každém startu
  label: string | null;   // jak tomu říká uživatel; pack na něj nikdy nesáhne
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

// Délky fází v pořadí metody. Klíče fází musí přijít zvenčí (Method.phases),
// protože Solve o své metodě nic neví. ms === null = hranice není známá nebo
// se tam solve vůbec nedostal; poslední zapsanou fázi uzavírá rawMs.
phaseDurations(splits: Split[], phaseKeys: string[], rawMs: number): PhaseDuration[]
// Totéž pro kreslení: fáze kolem chybějící hranice splynou do jednoho bloku.
phaseSegments(splits: Split[], phaseKeys: string[], rawMs: number): PhaseSegment[]
```

### 4.5 Nastavení (klíče)

| key | deviceLocal | default |
|---|---|---|
| `timer.holdThresholdMs` | 0 | 300 |
| `timer.inspectionEnabled` | 0 | 1 |
| `timer.inspectionCues` | 0 | `[8000, 12000]` |
| `timer.showScramblePreview` | 0 | `true` |
| `timer.splitMode` | 0 | `'total'` |
| `ui.theme` | 1 | `'system'` |
| `ui.font` | 0 | `'sans'` |
| `ui.textSize` | **1** | `'medium'` |
| `ui.clockSize` | **1** | `'medium'` |
| `ui.twistyMode` | 0 | `'2D'` |
| `ui.cubeSkin` | 0 | `'classic'` |
| `ui.showLearn` | 0 | `true` |
| `trainer.twoLookDefault` | 0 | `false` |
| `trainer.showAlgs` | 0 | `false` |
| `trainer.showRotationAlgs` | 0 | `true` |
| `trainer.drillSetId` | 0 | `'pll'` |
| `trainer.drillMode` | 0 | `'solve'` |
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
| 1 | **Timer** | scramble v mřížce (tah na buňku) + náhled, velký čas (setiny tišeji), inspekce s ubývajícím kruhem, přepínač „po fázích“, pruh běžících i dokončených fází, poslední solve s rychlou penaltou, mini-statistiky (ao5/ao12/session mean). Během solvu je na obrazovce jen hodiny — vycentrované na viewport a o kus větší |
| 2 | **Historie** | seznam solvů session s pruhem fází u měřených (s procentním podílem v každém bloku), zvýrazněný nejlepší výsledek i nejlepší délka každé fáze ve vyfiltrovaném výběru, filtry (tag, penalta, hvězdička), hromadné akce. Čas u solvu je hodina; u staršího než dnešek i den (a rok, pokud je z jiného) — stejně jako v seznamu na timeru |
| 3 | **Detail solvu** | modal/drawer: čas, scramble + náhled, splity, tagy, poznámka, editace |
| 4 | **Sessiony** | seznam, založení, přejmenování, archivace, přepnutí aktivní |
| 5 | **Statistiky** | karty s ao/PB/mean/SD/DNF rate, průměrné a nejlepší časy fází po oknech, stohovaný trend fází, histogram, trend rolling ao12 |
| 6 | **Trenažér — sady** | PLL / OLL / F2L, progress a nejslabší případy |
| 7 | **Trenažér — případ** | `<twisty-player>`, varianty algoritmů, statistiky případu |
| 8 | **Drill** | timer nad náhodným případem z vybrané podmnožiny |
| 9 | **Nastavení** | timer, vzhled, kalibrace mikrofonu s live meterem |
| 10 | **Data** | export (JSON záloha + CSV solvů), import (preview + merge/replace), import z csTimeru, smazání všech dat, troubleshooting |
| 11 | **Learn** | průvodce metodou pro začátečníky: sedm kroků jednoho složení, každý s jedním algoritmem a přepínačem na všechny případy kroku; skrytelná v nastavení |

Navigace: **hamburger menu** v hlavičce se všemi routami; hlavička ukazuje název
aktuální obrazovky. Je **přišpendlená k hornímu okraji** — cesta ze stránky musí
zůstat po ruce, jakkoli hluboko je člověk dole — a jakmile se stránka posune,
zúží se (na telefonu je ten pruh cennější pro obsah než pro titulek). Stránka
roluje celá, ne uvnitř rámu pod lištou; menu visí na hlavičce, takže se otevírá
tam, kde je tlačítko, které ho otevřelo. Timer je výchozí route. (Původně tu byl dolní tab bar na
mobilu — obrazovek je ale víc, než se do něj vejde, a s trenažérem a nastavením
jich bude ještě víc.) Dokud je menu otevřené, klávesy patří jemu, ne timeru.

Každá akce, po které obrazovka vypadá stejně jako předtím (export, import,
smazání dat), musí říct, že se stala — `components/Notice.tsx`.

**Omyl a návrat.** Co jde vzít zpět, se bere zpět; co ne, se potvrzuje. Mazání
solvů (jednoho, označených i všech pokusů na případu) smaže hned a na ~5 s
nabídne návrat — lišta dole přes celou aplikaci (`app/UndoBar.tsx` nad kanálem
v `lib/undo.ts`), protože smazaný solve se ruší odjinud, než kde se smazal.
Dialog by u mazání solvu byl daň z každého překlepnutého času a proti reflexu
stejně neochrání. Návrat vrací řádek přesně jak byl, **včetně smazání tombstonu**
— jinak by ho příští import smazal znovu. Potvrzení zůstává tam, kde návrat není:
„smazat všechna data" (odpočet, aby druhé tlačítko nebylo pokračováním prvního
pohybu) a „delete all" u pokusů na případu (arm + druhé ťuknutí, aby se celá
historie případu nesmazala jedním minutím).

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
statistiky per case, vlastní varianty algoritmů.
→ *Použitelné jako: samostatný trenažér algoritmů.*

**Vlastní případy (`isCustom: 1`) se zatím nedělají — vědomé rozhodnutí.**
Přizpůsobit si člověk chce **algoritmus** („T perm dělám jinak"), a to hotové je.
Vlastní *případ* chce správně napsaný setup alg, jinak se nenakreslí, a dává smysl
hlavně na COLL/ZBLL nebo F2L v druhém slotu — učivo, ke kterému se většina lidí
nedostane. Za tu obrazovku, validaci a další místo, kde se dá něco rozbít, to zatím
nestojí.

Odložit to je levné, protože instalatérství stojí: seed se řádku s `isCustom: 1`
nedotkne, `detachCase()` osiří pokusy smazaného případu, drill bere případy z poolu
a diagram se počítá ze setupu. Až to bude potřeba, přibude formulář a nic se
nemigruje.

### Fáze 6 — Fázové splity

**Dva samostatně použitelné kroky, a druhý není rozhodnutý:**

1. **Ruční mezičasy — hotové.** Vedený solve jako volba v timeru („jen celkový čas“ /
   „po fázích“), ťuknutí ukončí fázi a rovnou začne další, poslední zastaví čas.
   Zápis splitů do solvu, pruh fází po solvu, zobrazení a editace splitů v detailu,
   průměrné časy fází ve statistikách. Žádný mikrofon, žádné nové riziko.
   **Sémantika splitů je rozhodnutá a zapsaná v 3.6.**
2. **Detekce nástupu zvuku** (`AudioWorklet`) za tímtéž rozhraním. **Zatím se
   nestaví**: jestli se vyplatí, se pozná až podle toho, jestli se fázové časy
   doopravdy používají. Model se kvůli tomu nemění (`Split.source`), takže
   rozhodnutí smí přijít později — a smart cube (fáze 7) řeší totéž přesněji.
   Chybí k němu onset detektor za rozhraním `SplitSource` a kalibrace v nastavení;
   všechno ostatní (uložení, editace, statistiky) už stojí z kroku 1.

**Vedený solve** (scramble → cross → F2L → OLL → PLL s mezičasy) patří sem, ne do
drillu: drill měří jeden případ, tohle měří jeden solve po fázích.
→ *Použitelné jako: analýza slabé fáze.*

### Fáze 7 — Smart cube (později)

Druhá implementace `SplitSource` přes Web Bluetooth (`source: 'smartcube'`),
případně rekonstrukce tahů. Datový model se kvůli tomu **nemění**.
