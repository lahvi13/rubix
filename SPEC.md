# Rubix — specifikace

Offline PWA trenažér na Rubikovu kostku pro speedcubing.

## 1. Cíle a hranice

**Cíl:** trenažér na 3×3 pro cubery od prvního složení po rychlý průměr — timer, historie,
statistiky, drill algoritmů, fázové splity, průvodce pro začátečníky. **Veřejná aplikace**,
zdarma a bez účtů, distribuce přes URL na Cloudflare (sdílí se veřejně, např. na Redditu).
Původně to byl osobní nástroj pro autora a pár známých; z veřejného provozu plyne:

- **adresa je trvalá.** IndexedDB patří originu, takže změna domény znamená, že každý
  uživatel přijde o data, pokud předtím neexportuje. Doména se nemění
- **verzová podlaha prohlížeče se hlídá**, ne předpokládá: `lib/browser-support.ts` ověří,
  že prohlížeč umí CSS, na kterém aplikace stojí (dnes iOS 17.5+, viz IOS-CHECKLIST.md),
  a starší dostane srozumitelnou hlášku místo bezbarvé stránky. Co podlahu posune,
  přidá se tam
- **ztráta dat je největší riziko.** Safari maže data neinstalované stránky po týdnu bez
  návštěvy, proto timer na iOS po pár solvech vyzve k přidání na plochu; připomínka
  zálohy hlídá zbytek
- **zpětná vazba** jde přes mail na obrazovce About (předmět nese verzi a commit)
- **jen 3×3.** Další disciplína se přidává až na výslovnou poptávku;
  datový model (`puzzle`) s ní počítá. Návrh, jak na 2×2 a další metody, je
  ve fázi 7
- **anglicky a česky.** Jazyk je volba zařízení (`localStorage`, přepínač v Nastavení),
  ne součást dat: uložené solvy, session ani export žádný jazyk nenesou a soubor
  zálohy je mezi jazyky přenosný. Další jazyk znamená další soubor v `src/lib/strings/`
- **venku je aplikace anglicky.** Jedna URL servíruje oba jazyky, takže `index.html`,
  og: tagy a manifest mluví jedním jazykem pro všechny — a je to angličtina, protože
  to je i výchozí jazyk aplikace. Vyjednávání jazyka ani vlastní URL `/cs`
  s předrenderovaným českým HTML kvůli vyhledávačům se nedělá: znamenalo by to
  serverový kód, což je non-goal. Vědomá cena, ne opomenutí

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
- co hodiny ukazují **během běhu**, je volba (`timer.runningDisplay`): setiny,
  desetiny, celé sekundy, nebo nic („Solving“). Týká se i živých časů fází.
  Měření se nemění a zastavený čas se ukáže vždy celý
- zastavení jakoukoliv klávesou nebo dotykem **kdekoliv na obrazovce** (během běhu leží
  přes celou plochu neviditelná vrstva); ESC během běhu = zahodit pokus bez uložení
- během běhu je scramble i statistiky skryté (režim „pouze čas“)
- po zastavení zůstane na obrazovce výsledek (čas, mini-statistiky, rychlá penalta)
  až do začátku dalšího pokusu; další scramble se ukáže **hned**, jakmile je solve
  uložený — ruce jdou rovnou míchat, potvrzovací tlačítko by byl krok navíc
  (tak to dělá i csTimer). Scramble právě dokončeného solvu se do té doby
  neukazuje, aby se nepletl s tím, který se má míchat

### 3.2 Scramble

- WCA random-state scramble přes cubing.js; počítá se ve workeru, který si cubing.js
  drží sám — aplikace kolem něj **nestaví vlastní worker vrstvu** (viz CLAUDE.md)
- prefetch: další scramble se generuje hned po zobrazení aktuálního; požadavky se řadí
  za sebe, dva běžící solvery naráz položí i slušný telefon
- náhled zamotaného stavu: **plochý rozvin kreslí aplikace sama** (stejný model
  i skin jako trenažér, žádný chunk navíc), 3D přes `<twisty-player>`
  — přepíná to nastavení `ui.twistyMode`, vypnout celý náhled jde přes
  `timer.showScramblePreview`. Rozvin se kreslí **bílou nahoru** (skin se otočí),
  protože v té poloze je scramble definovaný. Animovaná kostka je těžký chunk,
  a proto se do ní nikdy nepřepíná samo — z náhledu se scramble dá přehrát
  tlačítkem a obrázek se pak vrátí
- scramble se ukládá ke každému solvu jako string; při reimportu se nikdy neregeneruje
- ruční vložení scramblu (paste) pro trénink konkrétní situace
- **sdílený scramble**: obrázek solve nese vedle tahů i rozvin (bílou nahoru jako
  na timeru) a sdílení k němu přidá zprávu s odkazem
  `#/timer?scramble=R_U-_F2&beat=14370` — tahy v zápisu alg.cubing.net (mezera `_`,
  čárka `-`), aby je messenger neusekl, a finální čas v ms k překonání (u DNF chybí).
  Všechno je za `#`, takže server scramble nikdy nevidí. Otevřený odkaz scramble
  připne na timer se zdrojem `'shared'` a štítkem „k překonání“, adresu vrátí na
  `#/timer` (reload ho nepřipne znovu) a po solvu řekne pod časem, jak to dopadlo —
  přednost má jen osobní rekord. Odkaz se posílá jako `text`, ne `url`: aplikace,
  které berou obrázek, URL vedle něj zahazují
- **sdílený průměr**: „Sdílet“ u ao5 / ao12 ve statistikách pošle stejný odkaz
  s pěti / dvanácti parametry `scramble` v pořadí a průměrem v `beat` (delší okna
  by daly odkaz, na který nikdo neťukne). Timer je naservíruje jeden po druhém se
  štítkem „Sdílený ao5 · 2/5“, výsledky drží v paměti vedle připnutého scramblu
  a po posledním spočítá průměr stejným pravidlem jako statistiky — ten má
  přednost i před osobním rekordem, protože honil se průměr, ne ten jeden solve

### 3.3 Historie

- seznam solvů aktivní session, nejnovější nahoře, virtualizovaný
- detail solvu: čas, penalta, scramble, náhled, splity, tagy, poznámka, časové razítko
- dodatečná editace: penalta, tagy, poznámka, hvězdička, i samotný `rawMs` (překlep)
  — každá editace nastaví `editedAt`
- mazání solvu (tombstone), hromadné mazání označených; každé mazání solvů
  se dá ~5 s vzít zpět (viz 5, „Omyl a návrat")
- sessiony: založení, přejmenování, archivace, smazání; právě jedna aktivní session
  na kombinaci `puzzle + mode`
- **archivace a smazání nejsou totéž.** Archivovaná session zmizí z přepínače, ale
  její solvy pořád platí — PB single je nad všemi freestyle sessiony puzzle a
  metody a archivací se nemění. Osobní rekord, který se hne při úklidu seznamu session,
  není rekord. Kdo chce solvy pryč z čísel, session smaže: to vezme i všechny
  její solvy (tombstony pro session i pro každý solve). Karta se předtím zeptá
  podruhé a řekne, kolika solvů se to týká; po smazání se dá — stejně jako u solvů
  — ~5 s vzít zpět. Smazání tagu je vratné taky, včetně návratu na solvy, ze kterých
  ho to strhlo
- když aktivní session zmizí (smazáním nebo archivací), aktivní se stane některá
  ze zbývajících — nezakládá se nový Default vedle starého
- přepínání sessions nemá vlastní obrazovku: otevírá se ze jména session tam, kde je
  napsáno — na timeru, v historii a ve statistikách. Zvolená session je aktivní
  session, tedy zároveň to, co je vidět, i to, kam padne další složení

### 3.4 Statistiky

Počítáno vždy nad **finálními** časy (viz 4.4), v rámci aktivní session,
kromě PB, které je globální per `puzzle` a metodu.

**Metoda je to, co dělá dvě složení srovnatelná** (rozhodnuto 2026-10-12, když
k CFOP přibyl Roux a ZZ). Zůstává vlastností session, ne složení: session je
řada srovnatelných časů a ao5 přes dvě metody neříká nic o žádné. Metoda u
složení by chtěla migraci, přepínač na timeru a filtr v každém pohledu uvnitř
session; kdo si chce jednou složit jinak, má na to druhou session. Z toho:

- **rozsahy „Všechny session“ a „Posledních 100“ čtou jen session metody, ve
  které se právě měří** — průměry, rekordy, grafy, cíl, praxi i fáze. Průměr
  dvacetivteřinového CFOP a minutového Rouxu je číslo o ničem. Když se tím
  něco vynechá, říká to řádek s počtem („2 složení · jen Roux“); dokud jsou
  všechny session jedné metody, obrazovka je stejná jako dřív
- **PB single se vede pro každou metodu zvlášť**, napříč všemi jejími session
  včetně archivovaných. První Roux pod minutu je rekord, ať CFOP dělá cokoli —
  na timeru, v historii, v detailu i ve statistikách (`getMethodPbSolve`)
- **jméno session s přepínačem je ve statistikách ve všech rozsazích.** Dřív
  jen u „Tato session“ — napříč session přepnutí nic neměnilo. Teď se jím
  dojde k číslům druhé metody, a bez něj by se k nim ze statistik nedalo dostat
- **timer metodu jmenuje**, jakmile jsou session v užívání ve víc metodách
  (`useMethodLabel`, stejné pravidlo jako u řádků ve výběru session): session
  se nemusí jmenovat po metodě, a ta rozhoduje, co je rekord. Stojí na konci
  řádku s ao5 a ao12, pod přepínači inspekce a fází — z náhledů vybráno před
  vlastním řádkem pod přepínačem Fáze, který panel zvětšil. Je tam i v session
  bez jediného složení: po založení se na metodu ptá člověk nejspíš
- **stejným pravidlem ji jmenuje historie, detail solvu a sdílené obrázky**
  — jednoho solvu i průměru („Best ao5 · Roux“) — (2026-10-13). V historii vedle jména session („Večerní · Roux · 40
  složení“): hvězdičky v seznamu jsou rekordy metody, a je potřeba říct
  které. V detailu v řádku pod časem, podle session **toho solvu** — ze
  statistik se otevírají i solvy z jiné session. Na obrázku v záhlaví
  („Single · Roux“): cestuje bez aplikace a rekord je rekordem metody. V
  řádcích seznamu ne — historie ukazuje jednu session, bylo by to totéž slovo
  u každého solvu

- current / best ao5, ao12, ao50, ao100
- PB single, PB každého okna
- session mean (aritmetický průměr všech neDNF solvů), median
- směrodatná odchylka (populační, nad neDNF solvy)
- DNF rate, +2 rate
- histogram časů (šířka koše odvozená z rozsahu, min. 0,5 s)
- trend rolling ao12 a pod ním rolling ao50 (line chart, osa X = index solvu); ao50
  ukazuje, jestli je dnešní ao12 změna formy, nebo jen výkyv
- **filtr podle tagu**: pod volbou rozsahu řada tagů, jen když nějaký tag existuje.
  Zvolený tag omezí všechno na obrazovce — průměry, grafy, rekordy, cíl, praxi i fáze —
  na solvy s tagem; PB single zůstává globální. U „Posledních 100“ se nejdřív filtruje
  tag a pak bere posledních 100 (posledních 100 OH solvů, ne OH solvy z posledních 100).
  Jeden tag najednou, zvolený svítí a řádek pod ním ho jmenuje, aby se filtrované číslo
  nečetlo jako celkové. Volba se pamatuje (`stats.tagId`); tag mezitím smazaný se čte
  jako žádný

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
  statické obrázky kreslí aplikace, animovanou kostku přebarví `lib/twisty-skin.ts`
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
- **twisty má barvy skinu** (`lib/twisty-skin.ts`): cubing.js na barvy nastavení
  nemá, ale přes `experimentalCurrentThreeJSPuzzleObject()` vydá three.js objekt
  kostky a každá nálepka je mesh s vyměnitelným materiálem. Každá kostka dostane
  vlastní materiály (stěny, zašedlé nálepky, plast) a shader ji stínuje podle
  toho, kam nálepka míří — stejnými faktory jako statický obrázek (`SIDE_SHADE`),
  takže se kostka po nahrazení obrázku nezmění ani o pixel. Je to zásah do vnitřku
  knihovny: po upgradu cubing.js ověřit v prohlížeči; když se vnitřek změní,
  kostka jen zůstane v barvách cubing.js
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
- drill mód (vlastní obrazovka): náhodný případ z vybrané podmnožiny s náhodným
  AUF a otočením kostky (`y`-rodina — `x`/`z` by sundaly žlutou z vršku), měření
  času stejným timerem jako běžný solve. **Scramble není setup případu**: setup
  je obrácený algoritmus, takže kdo ho přečte pozpátku, má odpověď dřív, než
  začne čas. Stav případu (s centry na místě) vyřeší solver cubing.js a ukáže
  se obrácené řešení — jen tahy stěnami, bez vztahu k drillovanému algoritmu.
  Než dorazí, timer je zamčený; když solver selže (offline při první návštěvě),
  ukáže se setup. Recognition scramble nepotřebuje, kreslí jen kostku.
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

Splity dělí solve na fáze (u CFOP cross / F2L / OLL / PLL, u Rouxu FB / SB /
CMLL / LSE, u ZZ EOCross / F2L / LL). **Fáze patří metodě, a statistiky fází
se čtou jen ze složení té metody** — jako všechno ostatní, co se čte napříč
session (viz 3.4, `solvesOfMethod`). Do 2026-10-12 se tabulka fází na „Všechny
session“ počítala ze všech složení: sloupce Rouxu tak stály na jediném Roux
složení, kdežto Celkem a počet na všech CFOP — a protože CFOP i ZZ mají fázi
s klíčem `f2l`, pod ZZ session by si poslední vrstva ZZ vzala OLL a PLL ze
složení CFOP. Detail složení si fáze bere z metody session, ve které složení
leží, ne z obrazovky, která ho otevřela. Fáze se berou
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
- **Ručně napsaný čas hranice se čte tak, jak se zobrazuje** (setiny). Čas, který
  se zobrazuje stejně jako sousední hranice, **je** ta hranice (fáze nulové délky =
  skip); čas, který se zobrazuje jako konec solvu, u poslední hranice znamená „tady
  solve skončil“ a hranice se odebere. Jinak by opsané „1:01.86“ padlo pár ms před
  uložený konec a z PLL by byla 0.00 s, která není nulová, a tak se počítá jako best.
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
  toho, jak dlouho trvala. Barvy se přiřazují **podle pořadí** —
  první fáze bílá (cross), poslední žlutá (poslední vrstva), mezi tím zbylé barvy
  nálepek (`lib/phase-colours.ts`). Metoda, o které aplikace nikdy neslyšela, tak
  dostane čitelný pruh. **Dvě fáze mají barvu podle jména** (2026-10-13, z
  náhledů): první blok Rouxu je **modrý** — je to modrý blok, jako je druhý
  zelený, a šedá o něm neříkala nic — a EOCross v ZZ **oranžový**: je to cross
  a k tomu orientace všech hran, pod bílou vypadal jako pomalý cross z CFOP, a
  oranžovou nezačíná žádná jiná metoda, takže se tři metody poznají podle
  první barvy. F2L a poslední vrstva ZZ nechávají barvy CFOP, jsou to tytéž věci
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
  nikdy nejsou týž solve; vpravo proto stojí nejlepší single, ne jejich součet.
  Skip (fáze nulové délky) se do něj nepočítá, stejně jako u zvýraznění v historii.
  Každé číslo v řádku otevře solve, ve kterém padlo; průměry žádný solve nemají
- **trend fází** je stohovaný plošný graf klouzavého průměru: výška je celý solve,
  takže zrychlený kříž je vidět dvakrát — jako užší pásmo i jako nižší strop.
  Okno je **5**, ne 12 jako u trendu ao — fázově měřených solvů je míň než obyčejných,
  takže vyhrává nejmenší standardní okno. Do grafu jdou **jen solvy, kde je známá
  délka každé fáze**: graf, jehož díly nedávají dohromady solve, je horší než
  kratší graf. Body se proto číslují **mezi fázově měřenými solvy**, ne pořadím
  v session, a tooltip to říká („116. složení s fázemi“) — vedle trendu ao,
  kde týž solve nese číslo 320, by holé „Složení 116“ četlo jako chyba
- zdroj každého splitu je uložen (`mic` / `smartcube` / `manual`) — ruční je zatím
  jediný, který se zapisuje

**Fáze hlasem (krok 2 — zatím jen jako zkouška, viz fáze 6):** uživatel na konci
fáze řekne krátké slovo („hop“) a obě ruce mu zůstanou na kostce. Původní návrh
(klepnout na stůl / kostku + energetický práh) je opuštěný: klepnutí je krátký
širokopásmový ráz stejně jako cvaknutí vrstvy a energie je od sebe neodliší.
Rozhodnuto při stavbě zkoušky:

- **rozhoduje periodicita, hlasitost je jen brána.** `domain/audio/onset.ts`
  (pásmo 150–1000 Hz, hop 5 ms) se každý hop ptá, jestli se posledních 40 ms
  opakuje s periodou hlasu (70–400 Hz, normovaná autokorelace ≥ 0,5).
  Rozhodovat nejdřív podle energie znamenalo, že dlouhé chrastění tahů držel
  detektor „obsazený“ a slovo řečené během otáčení se ztratilo (test to chytil)
- **periodicita nestačí — soudí se celý zvuk** (detektor 2). První zkouška na
  telefonu (v1, rozhodovala po 50 ms znělosti) slyšela „hlas“ každou 1,5 s;
  ve tichu fungovala, ruchy v místnosti (vrznutí, cinknutí, řeč vedle) brala
  jako „hop“. Znělé hopy se teď sbírají do jednoho zvuku, který končí 150 ms
  bez znělosti, a posoudí se až celý podle délky (souvislá řeč a televize se
  slijí do delšího), **průměrné** periodicity a vrcholu nad pozadím (mluví se
  kousek od telefonu, ruchy jdou přes místnost) — prahy viz detektor 4 níž.
  Rozhodnutí přijde až po konci slova, onset se datuje zpátky na jeho začátek
- **každý posouzený zvuk se zapisuje i s tím, podle čeho se soudil** (délka,
  periodicita, výška, stabilita výšky, hlasitost) — přijatý i odmítnutý. Další
  ladění se dělá proti skutečné místnosti, ne proti odhadu; nikdy se neukládá
  zvuk, jen tahle čísla
- **odmítnutý zvuk říká proč** (detektor 3): verdikt `voice | long | short |
  quiet | unclear | repeat`, při víc důvodech ten první v tomhle pořadí. Test v
  Nastavení vypisuje posledních pár zvuků s verdiktem a čísly a dají se
  zkopírovat — v2 na telefonu „hop“ občas nezaznamenal a nebylo vidět proč
- **konec zvuku se měří od jeho vlastního vrcholu, ne od pozadí; hlasitost
  rozhoduje** (detektor 4). Test v3 na telefonu: pět „hop“ bylo +61–70 dB nad
  pozadím, nic jiného v místnosti víc než +18 — ale čtyři byla odmítnutá jako
  „moc dlouhé“, protože dozvuk místnosti po tak hlasitém slově zůstal nad
  prahem a zněl dál periodicky. Hop teď patří ke zvuku jen do 20 dB pod
  vrcholem zvuku; práh hlasitosti je **30 dB** (uprostřed mezery, s rezervou
  na telefon dál na stole), a protože hlavní práci dělá hlasitost, zbytek je
  volnější: 60–600 ms, průměrná periodicita ≥ 0,55
- **kalibrace na hlas řešitele** (detektor 5). Dva testy s přesně pěti „hop“:
  hop vždy +64–68 dB a 104–123 Hz (hlasitost ±4 dB), a přesto prošla falešná
  „hop“ na 250–320 Hz kolem +35 dB — a jedno takové těsně před skutečným
  slovem ho zahodilo jako `repeat`. V Nastavení se proto kalibruje: telefon
  tam, kde leží při skládání, 5× „hop“; pak se bere jen zvuk ve výšce ±35 %
  kolem té naměřené (`pitch` = „jiný hlas“) a nejvýš o 15 dB tišší (nikdy pod
  30 dB). Kalibrace nebere prvních pět „hlasů“ (v tom testu by to byla většinou
  falešná), ale **největší skupinu pěti navzájem podobných** (±6 dB, výška
  ±20 %) a z ní medián; `audio.voiceLoudnessDb` / `audio.voicePitchHz`,
  device-local, 0 = nekalibrováno. Bez kalibrace platí pravidla detektoru 4
- **výška z rozhodování vypadla, kalibruje se jen hlasitost** (detektor 6).
  Pásmo začíná na 150 Hz, nad základním tónem hlubokého hlasu (~110 Hz), takže
  odhad výšky skáče na harmonické: táž „hop“ v jednom testu vyšla 111, 178, 205
  a 320 Hz — kalibrace nenašla pět podobných a kontrola výšky slova odmítala
  jako „jiný hlas“. Hlasitost přitom ve všech čtyřech testech dělila spolehlivě
  (hop +60–70 dB, jinak nejvýš +39). Výška zůstává jen v diagnostice;
  `audio.voicePitchHz` zmizel (device-local, žádná záloha ho nenese). Dvě „hop“
  ještě vyšla 600 ms dlouhá, proto zvuk končí 15 dB (ne 20) pod vrcholem a limit
  je 800 ms
- **nová kalibrace jde do běžícího detektoru, mikrofon se znovu neotevírá.**
  Otevření s rozběhem trvá kolem 1,5 s a první „hop“ hned po kalibraci do té
  mezery padl (naměřený jen jeho tišší konec, „moc potichu“)
- **nic se nesoudí, dokud detektor neslyšel místnost** (500 ms) a nuly od
  probouzejícího se mikrofonu se do pozadí nepočítají — první vteřina testu
  jinak vycházela „+112 dB“
- **po přijatém „hop“ se 600 ms další nepřijme** (`repeat`). Důrazné „hop“ drží
  „p“ zavřené a po uvolnění ještě krátce zazní hlas; v2 to občas počítala
  dvakrát. Konce fází jsou od sebe sekundy, takže to nic nestojí
- **práh plave:** brána je 6 dB nad 20. percentilem hladiny za posledních 1,5 s.
  Chrastění, které trvá, se do percentilu dostane za zlomek sekundy; slovo ani
  cvaknutí ne
- **hlas nikdy nezastaví solve** — posouvá jen vnitřní hranice; poslední fázi
  ukončí fyzický stisk jako dnes
- `AudioWorklet` (`workers/onset-processor.ts`) posílá stránce jen čísla snímků a
  hladinu, nikdy vzorky. Hodiny zvuku se převádějí na `performance.now()` z
  heartbeatů (minimum ze zpoždění posledních ~2 s). Nejde o rozpoznávání řeči a
  nikdy nesmí odejít žádný zvuk mimo zařízení
- **stínový režim (co je postavené):** přepínač v Nastavení (`audio.voiceShadow`,
  device-local) — při měření po fázích mikrofon poslouchá **vedle ťukání**, časy
  dál určuje ťuknutí. Po solvu se hlas spáruje s ťuknutími (`domain/audio/shadow.ts`,
  okno ±400 ms, nejbližší páry napřed) a pod pruhem fází se ukáže „Hlas 3/3 · +40
  +60 +30 ms“; v Nastavení souhrn (zachyceno / falešné poplachy / typický posun ±
  rozptyl), živý měřič, test (slyšená „hop“ i ignorované zvuky) a „zkopírovat
  podrobnosti“. Syrové záznamy (`audio.voiceShadowLog`, posledních 100 solvů)
  nesou verzi detektoru, souhrn počítá jen s aktuální. Do exportu nejdou
- mikrofon je otevřený jen na timeru ve fázovém režimu se zapnutou zkouškou a
  jen když je stránka vidět

Až stínová data řeknou, že hlas stačí, splity se budou zapisovat se
`source: 'mic'` a přiřazovat k fázím **v pořadí** podle definice metody;
chybějící hranice je povolená — přesně ten případ, na který je pravidlo
„nezměřeno" výše.

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
  session, do které člověk zrovna měří). Hned po importu ale timer i historie
  ukazují starou, často prázdnou session, takže výsledek nabídne u každé
  importované 3×3 session tlačítko **„Přepnout na …“** — přepne se až na ťuknutí
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
  a úvod na ni odkazuje — tahy jsou hned v kroku 1. **Vypínač stránky je až na
  konci**: kdo už kostku složí, tam řekne, že to má z menu zmizet; vrátit jde
  v nastavení, což je u vypínače napsané. Vedle něj stojí i to, kam dál
  (kroky 2+3 = F2L, 4+5 = OLL, 6+7 = PLL) — to patří člověku, který už skládá,
  ne tomu, kdo kostku drží poprvé
- **text kroku jsou krátké body, ne odstavce**: čtenář má kostku v obou rukou a
  hledá další pohyb, ne další odstavec. Pod body zvlášť a ztlumeně **Pozor**
  (chyba, která rozbije zbytek složení) a **Tip** (co dělat, když kostka
  nevypadá jako na obrázku). Vysvětlivky jdou vypnout a stránka pak zůstane
  jako tahák — body zmizí, obrázky a popisky u nich zůstanou
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
- **krok 1 nemá případ ze sady**, protože kříž se neskládá z algoritmů. Místo
  toho ukáže **dvě situace**, do kterých hranu dovede společné pravidlo
  (natoč vrškem hranu ke středu její druhé barvy, celou kostkou ji dej dopředu):
  bílá nahoře → `F2`, bílá míří na čtenáře → `U' R' F R`. Jsou to karty jako
  každý případ na stránce a ťuknutí otevře **list jako u ostatních případů**,
  jen lehčí: kostka (jen bílé hrany a středy barevně), ovládání a tahy. Stav
  učení, varianty a pokusy patří k algoritmu, který se učí, ne ke dvěma tahům
  z obrázku — proto to není list případu a sada `beginner` kvůli nim neroste. Test je spouští: bílá nálepka leží tam, kde
  říká popisek, a tahy kříž opravdu dokončí. **Hotový kříž je až pod nimi,
  jako cíl** (`stickering: 'cross'`: kříž a všechny středy barevně, zbytek
  šedě — bez středů není proti čemu shodu barev číst)
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
  scrambleSource: ScrambleSource; // 'generated' | 'own' (napsaný) | 'history' (složený znovu) | 'shared' (z odkazu); DB v5
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
  progress: CaseProgress; // 'new' | 'learning' | 'known'; DB v6. Uživatelův jako label —
                          // seed ho přenese; první drill posune 'new' na 'learning', 'known' jen ručně.
                          // 2-Look případ a jeho dvojče v plné sadě (CASE_TWINS v packs.ts: rohy
                          // OLL, celé PLL; hrany OLL ne) mají progress společný — zapisuje se
                          // oběma naráz a seed srovná rozjeté páry na ten pokročilejší.
                          // Algoritmy a volba aktivního zůstávají každému případu zvlášť
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
| `solves.[sessionId+penalty+rawMs]` | PB single metody: nejrychlejší složení každé její session, dva řádky na session (DB v8) |
| `solves.[mode+updatedAt]` | co chybí v záloze, po druzích — složení, pokusy v drillu, pokusy o rozpoznání (DB v7) |
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
| `timer.holdThresholdMs` | 0 | `300` |
| `timer.inspectionEnabled` | 0 | `false` |
| `timer.inspectionCues` | 0 | `[8000, 12000]` |
| `timer.showScramblePreview` | 0 | `true` |
| `timer.splitMode` | 0 | `'total'` |
| `timer.runningDisplay` | 0 | `'hundredths'` (`tenths` / `seconds` / `hidden` — jen co hodiny ukazují během běhu) |
| `timer.showNextRecord` | 0 | `true` (řádek pod průměry na timeru: pod jaký čas musí příští solve na nejlepší ao5 / ao12 session) |
| `ui.theme` | **1** | `'dark'` |
| `ui.font` | 0 | `'sans'` |
| `ui.textSize` | **1** | `'medium'` |
| `ui.clockSize` | **1** | `'large'` |
| `ui.clockFace` | 0 | `'digital'` |
| `ui.twistyMode` | 0 | `'3D'` |
| `ui.cubeSkin` | 0 | `'classic'` |
| `ui.showLearn` | 0 | `true` |
| `ui.learnExplanations` | 0 | `true` |
| `ui.learnMethod` | 0 | `''` |
| `ui.installNudgeDismissed` | **1** | `false` |
| `trainer.twoLookDefault` | 0 | `true` |
| `trainer.showAlgs` | 0 | `true` |
| `trainer.showRotationAlgs` | 0 | `true` |
| `trainer.setId` | 0 | `'f2l'` |
| `trainer.lastLevels` | 0 | `[]` |
| `trainer.drillSetId` | 0 | `'pll'` |
| `trainer.drillMode` | 0 | `'solve'` |
| `trainer.drillCaseIds` | 0 | `[]` |
| `trainer.crossFront` | 0 | `'F'` |
| `stats.chartWindow` | 0 | `100` |
| `stats.phaseTrendMode` | 0 | `'stacked'` |
| `stats.phaseTrendSmoothed` | 0 | `false` |
| `stats.scope` | 0 | `'all'` |
| `stats.goalMs` | 0 | `0` (bez cíle) |
| `stats.trendByDay` | 0 | `false` |
| `stats.tagId` | 0 | `''` (bez tagu) |
| `data.lastExportAt` | **1** | `0` |
| `data.lastExportBytes` | **1** | `0` |
| `audio.voiceShadow` | **1** | `false` |
| `audio.voiceShadowLog` | **1** | `[]` |
| `audio.voiceLoudnessDb` | **1** | `0` |
| `data.backupReminderSnoozedAt` | **1** | `0` |

Zdroj pravdy je `SETTING_DEFAULTS` v `db/repositories/settings-repository.ts`,
podle kterého je tahle tabulka opsaná; co je vázané na zařízení, říká
`DEVICE_LOCAL_PREFIXES` tamtéž (do zálohy nejde).

### 4.6 Seed data

Při prvním spuštění (a při zvýšení `packVersion`) se seedují `methods`, `algSets`,
`algCases`, `algorithms` ze statických JSON souborů v `src/db/seed/`.
Seed je **idempotentní upsert podle `id`** a nikdy nepřepíše řádek se `source: 'user'`
ani `isCustom: 1`.

### 4.7 Formát exportu

```jsonc
{
  "format": "rubix-export",
  "formatVersion": 3,
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
formátů žije v `src/db/migrations/import/`. Verze 2 přibyla s `scrambleSource`
(DB v5); upgrade z 1 doplní chybějící `scrambleSource` i `label` u případů,
který DB v3 přidala bez změny formátu — zálohy z doby před ním jinak nešly obnovit. Verze 3 přibyla s `progress` u případů (DB v6); upgrade z 2 ho doplní jako `'new'`. Verze 4 přibyla se `scrambleSource: 'shared'`; upgrade z 3 soubor nemění, číslo se zvedlo, aby starší aplikace takový soubor odmítla jako novější, ne jako poškozený.

## 5. Obrazovky

| # | Obrazovka | Obsah |
|---|---|---|
| 1 | **Timer** | scramble v mřížce (tah na buňku) + náhled, velký čas (setiny tišeji), inspekce s ubývajícím kruhem, přepínač „po fázích“, pruh běžících i dokončených fází, poslední solve s rychlou penaltou, mini-statistiky (ao5/ao12, session mean jen na širší obrazovce) a pod nimi, jen když to jde, čas, pod který musí příští solve, aby padl nejlepší ao5 / ao12 session. Během solvu je na obrazovce jen hodiny — vycentrované na viewport a o kus větší |
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
| 12 | **About** | co aplikace je a pro koho, instalace (Android tlačítko, iOS postup), kde jsou data, verze s kontrolou updatu, sdílení odkazu, kontakt, poděkování |

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
v `styles/tap-targets.css`, importovaném za styly obrazovek, které přebíjí, aby si je
nemusela pamatovat každá komponenta zvlášť.

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
2. **Fáze hlasem** (`AudioWorklet`) za tímtéž rozhraním. Fázové časy se ručně
   používají a odkládání kostky kvůli ťuknutí je to, co brzdí — proto se staví,
   ale **nejdřív jako stínový režim**: detektor, párování s ťuknutím a souhrn
   v Nastavení stojí (3.6), hlas zatím nic nezapisuje. Jestli ho pustit k
   `Split.source = 'mic'`, rozhodnou stínová data z reálných solvů na telefonu
   (kolik hranic zachytí, kolik falešných poplachů, jak stálý je posun). Model se
   kvůli tomu nemění a smart cube (fáze 8) řeší totéž přesněji.

**Vedený solve** (scramble → cross → F2L → OLL → PLL s mezičasy) patří sem, ne do
drillu: drill měří jeden případ, tohle měří jeden solve po fázích.
→ *Použitelné jako: analýza slabé fáze.*

### Fáze 7 — Další metody a další kostky (Roux je hotový, ZZ se staví, zbytek je návrh)

**Roux — rozhodnuto 2026-10-09, staví se v tomto pořadí:**

1. **Metoda u session.** Seedovaná metoda Roux se čtyřmi fázemi **FB · SB · CMLL ·
   LSE** — LSE je jedna fáze, ne EO / UL-UR / M vrstva: proběhne za pár vteřin M a
   U a tři ťuknutí navíc by stála víc, než změří. Metoda se volí **ve formuláři
   nové session** (CFOP | Roux, předvyplněná metodou aktivní session), ne
   globálním nastavením — přejít na Roux znamená založit si Roux session.
   **Existující session si metodu nechává**, její splity patří k fázím, pod
   kterými byly změřeny. Ve výběru session se metoda píše k řádku, až když jich
   seznam míchá víc. První session na zařízení je CFOP.
2. **Průvodce pro začátečníky Roux** (autor si o něj řekl) — **hotový**. Stránka
   Učení má přepínač **CFOP | Roux**. Otevře se na průvodci, který byl čtený
   naposled (`ui.learnMethod`); dokud si čtenář žádný nevybral, na tom podle
   metody aktivní session. Původně rozhodovala session pokaždé — jenže kdo se
   Roux učí, měří ještě v CFOP session a stránka se mu při každém návratu
   přepnula zpátky. Sedm kroků
   jako u CFOP: levý blok, pravý blok, rohy žlutou nahoru (Sune), rohy na místo
   (Jb), orientace hran (šipka a `M' U M`), boční hrany (`M2`), střední vrstva
   (`U2 M2 U2 M2`, `U2 M U2 M'`). Struktura podle „ROUX_guide_rev4“, vysvětlení
   bloků podle „Beginners guide to 3x3 cube with Roux“, situace podle „Roux
   Beginner Supplemental Guide“. Pravý blok a hrany jsou situace (obrázek =
   složený stav s vysunutými dílky, jako u crossu); každý krok má vlastní
   zvýraznění (jen levý blok, oba bloky, jen žlutá rohů, jen žlutá a bílá šesti
   hran, jen dvě boční hrany). Kostka stojí jako v těch průvodcích: žlutá
   nahoře, modrá vlevo, červená vpředu (`y'` oproti skinům).

   **Po autorově prvním složení (2026-10-12) přepsaný.** Levý blok nemá žádné
   situace — obrázky `F'` a `B` se četly jako dva tahy k naučení; skládá se
   intuitivně, text říká jen co a v jakém pořadí a krok ukazuje hotový blok
   (`goal`, kreslený z levého předního rohu). Kroky 5–7 naopak nenechávají nic
   na zkoušení, protože tam se člověk z CFOP ztratí: každý říká, **co spočítat**,
   a pro každou odpověď má obrázek s držením a tahy.
   - **Krok 5**: počet špatných hran (0/2/4/6). Dva nástroje — `M' U M` (přetočí
     UF, UL, UR a DF; zezadu `M U M'`) a výměna `M' U2 M` (UF ↔ DF, nic
     nepřetočí). Čtyři špatné → šipka přímo nebo jednou výměnou; dvě → `M' U M`
     s právě jednou špatnou vzadu; šest → `M' U M` odkudkoli. Špatná hrana
     je na obrázku **fialová** tam, kde by dobrá měla žlutou nebo bílou
     (`MARKED` v pohledech, `MARKED_STICKER` ve skinech; platí i pro sadu
     „Orientace hran“ v trenažéru, je to tentýž obrázek). Šedá všude jinde
     znamená „nedívej se sem“, a tady se šedé hrany měly počítat. Přehrávaná
     kostka je dál šedá — její maska patří nálepce, ne tomu, kam míří.
   - **Krok 6**: kde jsou dvě boční hrany. `M2` a `U` samy **nestačí** — když
     jsou nahoře vedle sebe nebo jedna dole a druhá nahoře, je potřeba výměna
     (`M U2 M'` / `M' U2 M`); původní text tvrdil opak a přesně tam se autor
     zasekl.
   - **Krok 7**: kolik ze čtyř hran sedí k oběma středům. Žádná → tečky
     (`U2 M2 U2 M2` s pruhem jedné barvy nahoře), jedna → tři hrany v kruhu
     (nesedící hrana nahoře, sedící pod ní, `U2 M U2 M'`).

   Všechny tři postupy jsou tak, jak je text říká, **projeté přes každý stav**,
   ve kterém je lze potkat (32 rozložení špatných hran, 2 880 stavů před krokem
   6, 24 před krokem 7) na modelu kostky z `domain/cube` — jednorázově, mimo
   repo. V repu zůstávají testy obrázků (`steps.test.ts`): každý obrázek je
   to, co jeho popisek tvrdí, a jeho tahy nechají to, co slibuje. Situace, která
   krok nedokončí, nese `next` — co po ní následuje — aby se kostka kreslila
   tak, jak ji člověk při skládání potká.
3. **Trenažér seskupený podle metody + CMLL.** Řada sad má řádek na metodu
   (CFOP · Roux), jakmile jich je víc. **2-Look CMLL** (7 orientací + Jb a Y, podle
   „2-Look CMLL“ PDF) je hotová a průvodce z ní bere Sune a Jb; celá sada je jeho
   „rychlejší cesta“, jako 2-Look OLL/PLL u CFOP. Sada patří Rouxu přes
   `set.method` v packu. **Plné CMLL — hotové.** 42 případů ve skupinách O, H, Pi,
   U, T, S, As, L z „Kian's CMLLs“: tučný algoritmus je hlavní (u H Columns a
   L Diag jsou tučné dva, bere se první), ostatní jsou alternativy (81). Názvy
   mají předponu skupiny („H Columns“) — „Columns“ je v pěti skupinách a drill
   rozpoznávání nabízí odpovědi podle názvu. Tři překlepy listu jsou opravené
   ručně (`F''`, `(U)'`, `( U)`) a ověřené spuštěním. 2-Look CMLL je jeho
   dvoukrokový pohled (přepínač 2-Look | Plná). Obrázek shora s barvami rohů
   i jejich boků, hrany šedě.

   **Co znamená „vyřešeno“ u CMLL.** Kian sám píše, že půlka algoritmů otočí
   hrany, a některé nechají otočenou střední vrstvu. Případ je proto vyřešený,
   když stojí oba bloky a čtyři rohy nahoře (s libovolným dorovnáním U) — šest
   hran a středy střední vrstvy jsou věc dalšího kroku (`isSolvedAsShown` se
   stickeringem `blocksAndCorners`). Kostka se před posouzením **nestaví podle
   středů** (tah M by je posunul a kostku by to převrátilo); místo toho se
   porovná se složenou kostkou otočenou o 0–3 čtvrtiny kolem svislé osy, protože
   drill případ ukazuje i v jiných barvách. Tím měřítkem prochází test sad i
   dorovnání v drillu, pro všechny alternativy ze všech 16 úhlů.
4. **Orientace hran — hotová.** Sada „Orientace hran“ (`roux-eo`): 11 případů ve
   skupinách podle počtu špatných hran (2 / 4 / 6). Kianových 9 z „roux_EO“ plus
   dva zrcadlové z „ROUX_guide_rev4“ (obrácená šipka, obrácená úhlopříčka), které
   Kian řeší otočením kostky; rev4 je řeší bez něj. Hlavní algoritmus Kianův, u
   šipky `M' U M` jako v průvodci; alternativy z rev4 (algoritmus, který rev4
   uvádí u „4 edges on top“, ve skutečnosti řeší Plus a je zařazený tam). Vyřešeno
   = bloky a rohy beze změny a žlutá i bílá všech šesti hran nahoře nebo dole
   (`lseOrientation`), kostka posuzovaná, jak leží. Krok 5 průvodce otevírá šipku
   z této sady a „Všechny případy“ ukážou celou.
5. **Druhý blok — hotový.** Sada „SB“ (`roux-sb`) z listu „Second Block
   Algs“, část „Front Pair Cases with DR Solved“: přední pár (roh + hrana) do
   předního pravého slotu, když levý blok, hrana pod pravým středem a zadní pár
   už stojí. **47 případů**: 41 míst, kde pár může být jako u F2L, a 6 navíc
   s hranou ve střední vrstvě — ta je tu volná, a proto jsou řešení kratší než
   F2L. Skupiny jako u F2L (spodní barva na boku / nahoře, roh ve slotu, hrana
   ve slotu, pár ve slotu) plus „Hrana ve střední vrstvě“; „spodní barva“,
   protože Roux žádný cross nemá. První algoritmus buňky je hlavní, ostatní
   alternativy (106); co list značí „free slot“, je `multiSlot` (14) — rozbije
   zadní pár, a rozhoduje o tom, **co algoritmus udělá**, ne poznámka: jeden
   takový list neoznačil. Opravy listu ověřené spuštěním: v buňce 36 `F'` místo
   `F` (jak je vytištěný, rozbije levý blok), `(R U R' U')3` rozepsané. Vtipná
   buňka a poslední dvě strany („Louis' Multislotting“ — DR nesložená, dva páry
   naráz) v sadě nejsou. Vyřešeno = oba bloky stojí, horní vrstva a střední
   vrstva jsou věc dalších kroků (`blocks`, posuzováno, jak kostka leží).
   Obrázek jako u druhého kroku průvodce: oba bloky barevně, zbytek šedě,
   modrá vlevo.

   **Doplněno na 65 (2026-10-12).** Úplná sada (SBLS na speedcubedb.com) má
   65 případů: 41 jako F2L a **24** s hranou dole ve střední vrstvě (roh ve
   třech natočeních nahoře nebo ve slotu × hrana dole vpředu nebo vzadu × dvě
   natočení). List jich z těch 24 má šest. Zbylých 18 (SB 48–65) je ze
   SpeedCubeDB: první algoritmus stránky jako hlavní, její další jako
   alternativy — jen pro těchto 18, stávajících 47 má alternativy dál jen z
   listu, ať se zdroje nemíchají. Porovnáno na modelu kostky, ne podle názvů:
   případ je poloha rohu a hrany až na otočení vrchu. Ze stránky nefungují dva
   algoritmy (jeden rozbije levý blok, druhý je překlep) a v sadě nejsou.

   **Názvy a skupiny podle SpeedCubeDB.** Případ se jmenuje stavem rohu a
   místem hrany — `Dp DB` je roh ve slotu s bílou dopředu a hrana dole vzadu —
   ne číslem: z předního pravého rohu není hrana dole vzadu vůbec vidět a název
   je jediné, co říká, kde je. Roh: `U` / `Up` / `Um` nahoře (bílá nahoru /
   doprava / dopředu), `D` / `Dp` / `Dm` ve slotu (správně / dopředu /
   doprava); hrana: `UB UR UF UL FR DF DB`, jen `U` vedle rohu ve slotu, a `m`,
   když je otočená. Šest skupin podle rohu (14 · 14 · 14 · 7 · 8 · 8) a každý
   nadpis končí kódem v závorce, takže první půlku názvu vysvětluje on —
   stránka sama `p` a `m` nevysvětluje. Názvy jsou **spočítané z kostky**, ne
   opsané: automatické čtení stránky přiřadilo jednomu případu při dvou čteních
   dvě různé výchozí pozice. Vyšlo týchž 65 názvů, jaké má stránka, a test sad
   každý název čte z kostky znovu. Případy jsou kreslené s rohem nad slotem
   (a hranou vpravo, když je roh ve slotu), sedm z nich kvůli tomu dostalo
   otočení vrchu před algoritmus. Id zůstala (`sb-1` … `sb-65`), postup a
   pokusy se drží jich, ne názvu.
6. **OH algoritmy CMLL — hotové**, jako alternativy ke stávajícím případům
   (`others`), z listu „CMLL OH (right and left handed)“. List má stejných 42
   případů pod stejnými názvy jako „Kian's CMLLs“, u každého algoritmus pro
   levou a pro pravou ruku. **58 nových** (alternativ je teď 139), 25 už v sadě
   bylo — test sad hlídá, že žádný případ nenabízí tytéž tahy dvakrát. Každý prošel stejným měřítkem jako zbytek sady. U H Column, H Row a
   L Pure kreslí OH list případ z jiného úhlu než hlavní list, takže algoritmus
   dostal otočení vrchu dopředu (sloučené s tím, které už měl). Levoruký T Rows
   případ neřeší a jednotahové opravy jsou dvě různé — hádat se nebude, v sadě
   není. Karta případu je nijak neoznačuje: jsou to „vestavěné · jinak“ jako
   ostatní alternativy.
7. **EOLR — hotové.** Sada „EOLR“ (`roux-eolr`) z listu „Roux EO + ULUR“:
   orientace hran a obě boční hrany jedním algoritmem, tedy rychlejší cesta
   přes kroky 5 a 6 průvodce. **56 případů** — každý celý algoritmus listu; šest
   jeho řádků jsou poznámky „pokračuj jiným případem“, ne algoritmy. Skupiny
   jsou tvary špatných hran pod názvy ze sady EO (list je značí `Arrow`, `6`,
   `4/0`, `2o/2`, `2o/0`, `0/2`, `2a/0`, `2a/2`, `1/1 F`, `1/1 B` — shodu určilo
   spuštění, ne obrázek), případ se jmenuje kódem listu a místy, kde boční hrany
   jsou (`2a/2 UF UL`); kódy a pozice se nepřekládají.

   **Co znamená „vyřešeno“ u EOLR** (`eolr`, posuzováno, jak kostka leží): list
   to neříká, zjistilo se to spuštěním všech řádků ze všech stavů, na které
   pasují. Bloky a rohy beze změny, všech šest hran orientovaných a boční hrany
   **obě dole ve střední vrstvě** (jeden `M2` od domova), nebo už doma. Střední
   vrstva smí zůstat **o čtvrt otáčky pootočená** — nechává ji tak 22 z 56
   algoritmů a středy srovná až poslední krok. Orientace se pak čte jinak:
   čtyři hrany střední vrstvy mají žlutou/bílou do strany (otočka, která vrátí
   středy, otočí i je), boční hrany pořád nahoru nebo dolů.

   Případ není algoritmus pozpátku ze složené kostky — ten by boční hrany
   postavil jinam, než kde je řádek čeká. Každý má vlastní `setup`: cílová
   pozice a z ní algoritmus pozpátku, vybraný tak, aby nahoře byl žlutý nebo
   bílý střed, špatné hrany dávaly tvar skupiny a boční hrany stály, kde říká
   název (test sad to u každého kontroluje). Horní rohy sedí k blokům, kromě
   dvou případů, kde algoritmus dovede boční hrany až domů jen z jednoho
   natočení vrchu (`6 DF DB`, u něhož to list píše, a `1/1 F UB DF`, u něhož
   ne). Obrázek je ten ze sady EO s bočními hranami v jejich barvách: špatná
   boční hrana má nahoře modrou nebo zelenou místo fialové.
8. **Řádek sad v trenažéru:** název metody je tučně a v barvě textu (je to
   nadpis řádku, ne popisek), sady Rouxu se jmenují zkratkami jako sady CFOP —
   **SB · CMLL · EO · EOLR**. „Orientace hran“ a „Druhý blok“ se na řádek
   telefonu s dalšími sadami nevešly.
9. **Případ Rouxu začíná se středy na místě.** Drill dostane scramble od
   řešiče, který umí jen otáčky stěn — a ty středy nikdy nepohnou. Případ, jehož
   výchozí pozice má pootočenou střední vrstvu (algoritmus pozpátku s lichým
   nebo polovičním součtem M), se tak naskramblovat nedá a drill ukázal náhradní
   text: algoritmus pozpátku, tedy odpověď. Zjištěno až zkouškou v prohlížeči
   (2026-10-12) u 25 případů SB, většiny EOLR a šesti případů EO, které tak
   chodily od 1.23.0; jednotkové testy to nevidí, řešič v nich neběží. Takový
   případ má vlastní `setup`: nejdřív otočka střední vrstvy, pak algoritmus
   pozpátku — bloky i tvar špatných hran jsou stejné, středy doma. Test sad to
   teď vyžaduje u každého případu každé sady.
10. **Levoruký algoritmus se pozná.** Vestavěná alternativa, která točí levou
    stranou a pravou vůbec, má na kartě případu „vestavěný · levou rukou“ místo
    „jinak“ (`domain/alg/hand.ts`). Čte se z tahů, neukládá se: OH list dává
    ke každému případu algoritmus pro každou ruku a zrcadlové vložení v F2L je
    totéž. Pravoruké OH algoritmy označené nejsou — pravou rukou je i hlavní.
11. **Průvodce končí seznamem sad** se zkratkami řečenými jednou celé (SB, CMLL,
    EO, EOLR a ke kterému kroku patří) a čtyřmi fázemi, po kterých timer Roux
    měří (FB · SB · CMLL · LSE, každá s kroky, které pokrývá) — zkratky na řádku
    trenažéru ani fáze timeru jinak nikde vysvětlené nejsou.
12. **Tečka „rozbije jiný slot“ zná Roux.** Pravidlo bylo psané pro F2L: pár
    je doma a pod horní vrstvou něco nesedí. U EOLR tak dostalo tečku 14 z 56
    karet — každá, jejíž algoritmus nechal střední vrstvu, kde byla, protože
    dvě boční hrany dole v ní vypadají jako rozbitý slot. `costsASlot` teď
    dostává, na co se sada dívá: u druhého bloku je jediný slot k rozbití zadní
    pár (posuzováno, jak kostka leží), u kroků po blocích žádný není.
13. **Přehrávaná kostka ví, jak stojí.** Masky Rouxu se určují podle toho, kde
    je vlevo a vpravo (`maskByHome`), a k tomu potřebují otočení, ve kterém je
    případ držený (`standing`). Dostával ho jen průvodce; karta případu v
    trenažéru a oba drilly ne, takže maska vzala „bloky“ z kostky před otočením:
    svítil předek a zadek, střed pravého bloku a hrana pod ním (i jejich modré
    protějšky) zešedly. Od 1.23.0 tak hrály i sady EO a EOLR. Statický obrázek
    byl správně, proto to bylo vidět až při přehrávání — a jen v prohlížeči.
14. **Zdroje v O aplikaci:** vedle J Perm jsou tam Kianovy listy (sady Rouxu) a
    SpeedCubeDB (doplněné případy druhého bloku).
15. **Sady rohů stojí jako zbytek Rouxu, a 3D kostka má bloky.** CMLL i 2-Look
    CMLL se kreslily, jak je kostka zapsaná (zelená vpředu, červená vlevo),
    takže krok 4 průvodce říkal „vlevo nad modrým blokem“ a obrázek měl vlevo
    červené headlights. Teď stojí `y'` jako SB, EO i EOLR: modrá vlevo, červená
    vpředu (`ROUX_ORIENTATION`). Šipky u prohození se kvůli tomu čtou proti
    středům kostky, jak leží, ne proti kostce, jak je zapsaná — jinak na
    otočené kostce vyšla místo jedné výměny změť tří.

    Přehrávaná kostka u 2-Look CMLL, EO a EOLR ukazuje i **oba bloky** (a u hran
    i hotové rohy): co stojí, podle toho se čte, co se hýbe, a čtyři žluté
    nálepky na šedé kostce neříkaly, jak je držená. Statický obrázek zůstává
    úsporný — na šedé je fialová špatná hrana vidět nejlíp. Je to vědomá výjimka
    z pravidla, že kostka v pohybu ukazuje totéž co obrázek.
16. **Později:** drill prvního bloku spíš ne (viz
   rozhovor 2026-10-12): chtěl by vlastní solver a řešení prvního bloku se
   netrénuje na čas z náhodné pozice, ale plánováním při inspekci.

Zdroje dodal autor jako PDF (CMLL, druhý blok, EO, EO + ULUR, OH CMLL,
začátečnický průvodce); obsah se z nich přebírá, nehádá.

**ZZ — rozhodnuto 2026-10-12, staví se v tomto pořadí:**

Autor ZZ nikdy neskládal, takže obsah je celý ze zdroje: tutoriál na
<https://www.zzmethod.com/> (EO, EOCross, ZZF2L, LL), čtený z jeho repa
`crystalcuber/zz-method-docs`. Podle něj se rozhodlo i to, která ZZ to je:

- **EOCross, ne EOLine.** Zdroj EOLine pro dvě ruce nedoporučuje ani jako
  mezikrok — F2L po EOLine je jiná dovednost a nemá smysl učit se obě.
- **Poslední vrstva jde 3 kroky → OCLL + PLL → ZBLL.** COLL, se kterým počítal
  rozbor z 2026-09-24 níž, zdroj neučí vůbec, a v sadách proto není.
- **Kostka stojí jako ve zdroji: žlutá nahoře, modrá vpředu** (`y2` proti
  zápisu skinů, `ZZ_STANDING`), červená vpravo a oranžová vlevo. Původně tu
  stálo „jako u CFOP, zelená vpředu“ — jenže obrázky F2L v trenažéru se kvůli
  barvám kreslí otočené o čtvrt (`y'`, zelená vedle oranžové splývá), a čtvrt
  otáčky je u ZZ jiná kostka: které hrany jsou špatné, se čte proti přední a
  zadní stěně. Půl otáčky osu nechá a slot vpředu vpravo je modrá s červenou.
  Po scramblu (bílá nahoře, zelená vpředu) stačí kostku překlopit dopředu, a
  ukázková složení na webu zdroje jdou točit tak, jak jsou napsaná.

1. **Metoda u session.** Seedovaná metoda ZZ se třemi fázemi **EOCross · F2L ·
   LL**, volená ve formuláři nové session jako Roux. **LL je jedna fáze**, ne
   OCLL a PLL: tak metodu dělí zdroj, je to o ťuknutí míň a otázka, na kterou
   mají splity ZZ odpovědět, je „kolik stojí EOCross a kolik za to vrátí F2L“ —
   OLL a PLL zná autor z CFOP a jejich časy by nic nového neřekly. Rozhoduje se
   jednou: fáze metody se po prvních změřených solvech už měnit nedají, a ZBLL
   by dělení na dva kroky stejně zrušila. CFOP i Roux mají fáze čtyři, takže
   tři ještě žádná obrazovka neviděla — timer, historii a statistiky ověřit
   v prohlížeči na 412 px.
2. **Průvodce ZZ — hotový.** Třetí volba přepínače na stránce Učení (CFOP |
   Roux | ZZ). Zdroj předpokládá, že čtenář už kostku složit umí a čte notaci —
   je to krok od CFOP dál jako Roux, ne první složení. Sedm kroků, stavěných
   jako ty v Rouxu:
   - **Špatné hrany** — krok bez jediného tahu. **Jedna nálepka na hranu a tři
     odpovědi podle její barvy.** Nahoře a dole se čte nálepka, která míří
     nahoru nebo dolů, v prostřední vrstvě ta vpředu nebo vzadu — dvanáct
     „vnitřních“ míst (`isInnerPlace`). Žlutá nebo bílá tam znamená dobrou
     hranu, červená nebo oranžová špatnou, a u modré nebo zelené rozhodne
     druhá nálepka té hrany: se žlutou nebo bílou je špatná. Každá ze tří barev
     je **obrázek s verdiktem a důvodem vedle** (`rules`), kostka z rohu, ze
     kterého se drží: `readsPole`, `readsSide` a `readsFront` — ten kreslí jen
     tři hrany, které jsou z toho rohu vidět celé, s druhou nálepkou žlutou
     nebo bílou. První popisek navíc říká, **kam se dívat, po stěnách** (U a D
     všechny čtyři hrany, F a B dvě vedle středu, R a L nic): obrázek ukáže tři
     stěny ze šesti. Text říká, že barvy mají role podle středů a co na těch
     místech má složená kostka, pojem kotví v tom, co čtenář zná z CFOP (hrana
     poslední vrstvy bez žluté nahoře), a říká počítat po vrstvách. Proč
     zrovna těch dvanáct míst, je v tipu: R, L, U a D z nich nálepku neodnesou
     ani na ně nepřinesou, jen čtvrtotáčka F nebo B (hlídá test).
     Pod obrázky **příklad na vyzkoušení** (`figures`), dvakrát tatáž
     rozvinutá kostka: s hranami a středy v barvách (`allEdges`) a sedmi tahy,
     kterými ji čtenář udělá ze složené, a s odpovědí, šest špatných fialově
     (`badEdges`), po dvou v každé vrstvě. Krok tak nekončí u „zkus si to“ bez
     výchozí pozice. Mezi nimi byla chvíli třetí, jen s nálepkami, které se
     čtou; vysvětlovala, co tehdy neříkaly popisky, a s důvody v nich byla
     navíc.

     První verze měla pravidla jako dvě věty s devíti místy („nahoře, dole,
     nebo v prostřední řadě přední či zadní stěny“) a autor ji hned vrátil:
     moc informací najednou a nedá se to představit. Druhá je kreslila jako
     dvě sady míst, kde barva být nesmí (červená a oranžová na vnitřních
     místech, žlutá a bílá na ostatních) — logicky totéž co dnes, jenže každou
     hranu bylo potřeba porovnat s oběma obrázky, a autor se přes krok s
     kostkou v ruce dostal jen stěží (2026-10-13). Třetí měla tři obrázky s
     holým verdiktem („žlutá nebo bílá: dobrá“) a autor se hned zeptal proč a
     proti čemu se to porovnává — odtud důvod u každého verdiktu a stěny v
     prvním popisku. Mezikrok s pěti obrázky (zvlášť složená kostka jako
     měřítko, modrá se zelenou nadvakrát) autor zkrátil sám: když to říkají
     popisky, stačí tři. Obrázek pravidla zůstává i
     se sbalenými vysvětlivkami — jeho věta je pravidlo, ne komentář
   - **Oprava hran** — cíl napřed: čtyři špatné na přední stěně a `F`. Pak
     **jak je tam dostat**: špatná hrana mimo přední stěnu leží na U, R, D
     nebo L, a tou stěnou se otočí dopředu — vystřídá jednu hranu přední
     stěny, ostatní tři se nehnou (`R' F`). Vystřídala-li by jinou špatnou,
     jde to na tři tahy: stěnou, na které leží, na jinou stěnu, tou dopředu, a
     první stěnu zpátky (`R' U R F`); hranu vzadu, na kterou nestačí ani to,
     přesune `B2` (v tipu). Text jmenuje stěny písmeny a říká „na přední
     stěnu“: první znění s obraty „místo má svou stěnu“ a „odsuň, dovez, vrať“
     autor vrátil jako těžkopádné — dovézt kam? Počty mají obrázek, kde nejsou čtyři: dvě →
     jedna vpředu se třemi dobrými, otáčka udělá čtyři; šest → tři vpředu s
     jednou dobrou, zbudou čtyři. Osm a dvanáct jsou čtyři a čtyři, deset jako
     šest. Špatná hrana je fialová **celá**, obě nálepky: z rohu kostky je
     často vidět jen jedna, a krok je o tom, kde špatné jsou, ne proč.
     První verze říkala jen „přenes je na přední stěnu“ a jak, nechala na
     zkoušení — na rozdíl od Rouxu, kde má obrázek každá odpověď
   - **Cross** jen tahy R, L, U, D, `F2` a `B2`. S dobrými hranami míří bílá
     nahoře vždy nahoru a v prostřední vrstvě dopředu nebo dozadu — dva obrázky
     a hotový cross
   - **První dvě vrstvy** se otevřou na **dvou tvarech, ze kterých se pár
     vkládá** (spojený `R U' R'`, rozdělený `R U R'`), a na pravidle, čím se
     smí otáčet: kdo se do ZZ pustí, F2L z CFOP zná, a to nové jsou tyhle dvě
     věci. Čtyři kroky zdroje — cesta k oběma tvarům odkudkoli — jsou za
     tlačítkem „Jak se k nim dostat“ (`more`), pět obrázků v pořadí, v jakém
     se jde: dílek ven ze slotu, dva dotýkající se od sebe, a tři barvy, které
     může mít vršek rohu (bílá, stejná jako vršek hrany, ta druhá). Sedm
     obrázků naráz se četlo jako sedm věcí k naučení. Vše pro slot vpředu
     vpravo; ostatní tři jsou v tipu (`L'` místo `R`, zadní se zvedají opačně)
   - **Poslední vrstva** jsou poslední tři kroky průvodce CFOP — tytéž případy,
     obrázky i „všechny případy“ (7 + 2 + 4, tedy OCLL, CP a EPLL zdroje) —
     jen bez kroku „cross poslední vrstvy“: ten je hotový od prvního kroku, a
     to je celá odměna metody. Kroky 6 a 7 mají i text společný, krok 5 říká,
     proč tam cross už je a že se kostka odteď zase smí otáčet

   **Ověřeno spuštěním na modelu kostky, jednorázově a mimo repo:** obě
   formulace špatné hrany (pravidla zdroje a „nálepka, která patří nahoru,
   dolů nebo do prostřední řady vpředu a vzadu“) se shodují na všech hranách
   20 000 scramblů; hranu přetočí jen čtvrtotáčka F nebo B, vždy všechny čtyři;
   z každého z 2 048 rozložení špatných hran jde potřebný počet donést na
   jednu stěnu nejvýš pěti tahy. **Dovážení hran, jak ho text říká** — stěnou,
   na které hrana leží, jinak odsuň–dovez–vrať, jinak `B2` — prošlo všech
   2 048 rozložení: vždy skončí, nejvýš 13 tahy, průměrně 7 (úplné, ne
   nejkratší). Čtení jednou nálepkou hlídá test v repu
   (`edge-orientation.test.ts`): s `isBadEdge` se shodne na každé hraně 200
   zamíchaných kostek, každé držené pěti způsoby.
   **Postup F2L, jak ho text říká, prošel každý
   stav páru** — 192 s otevřenými sloty a 75 u posledního slotu, pro každý ze
   čtyř slotů — bez chyby, nejvýš 18 tahů na pár. V repu zůstávají testy
   obrázků (`steps.test.ts`): každý je to, co jeho popisek tvrdí, jeho tahy
   nechají, co slibuje, a žádný nerozbije cross, jiný slot ani dobrou hranu.

   Přehrávaná kostka u opravy hran nenosí fialovou, ale barvy hran a středů:
   přetočení hrany je výměna jejích barev mezi místy, a to maska ukázat
   neumí — stejná vědomá výjimka jako u Rouxu. Čtení špatných hran je v
   `domain/cube/edge-orientation.ts` (`isBadEdge`, `badEdgeCount`), odkud ho
   vezme i drill z kroku 3. `LearnScreen` už nevětví přes `isRoux`: úvod,
   zdroj a závěr má každá metoda jako záznam.

   Strategii podle počtu (osm, deset, dvanáct; „začni stěnou, kde jich je
   nejvíc“) doplnil druhý zdroj, který autor dodal: tutoriál Conrada Ridera
   (<https://cube.rider.biz/zz.php?v=beginner>). Jen tu: jinak učí EOLine a
   F2L z bloků, tedy jinou ZZ, a nemá otevřenou licenci. Texty průvodce jsou
   vlastní, ne překlad žádného z obou.
   **Kroky 3 až 5 jsou od 2026-10-13 pozastavené.** Autor průvodce prošel s
   kostkou, metoda mu nesedla a do trenažéru ani drilu ji dávat nechce;
   průvodce a metoda u session zůstávají. Vrátit se k nim má smysl, jen kdyby
   ZZ začal skládat — sady, které nikdo neprojde s kostkou v ruce, by šly ven
   neodzkoušené.
3. **Drill rozpoznání EO.** Scramble a otázka „kolik hran je špatných?“ — to
   jediné, co je na ZZ doopravdy nové a co se musí stihnout při inspekci.
   Odpověď je spočítaná z modelu kostky. Podoba (počet, nebo ťuknutí na hrany)
   se rozhodne z náhledu.
4. **Řádek ZZ v trenažéru.** Sada dnes patří jedné metodě (`AlgSet.methodId`),
   ZZ ale sdílí PLL a kus OLL s CFOP. Metoda proto dostane **vlastní seznam
   sad** — statický, v `domain/alg/sets.ts` vedle pořadí sad, ne v databázi:
   packy jsou statické taky a obejde se to bez migrace. `AlgSet.methodId`
   zůstává, čím byl. Případy jsou tytéž řádky, takže postup v nich je s CFOP
   společný sám od sebe. Na řádku: **F2L** (krok 5), **OCLL** — sedm případů
   skupiny „Cross“ ze sady OLL, zbylých padesát v ZZ nenastane — a **PLL**;
   CP a EPLL jsou obě skupiny 2-Look PLL. Jestli je OCLL pohled na skupinu,
   nebo dvojče jako 2-Look sady, rozhodne drill. Algoritmy, které zdroj uvádí
   jinak než pack (Antisune, L a H u OCLL, Z perm, část PLL), přibudou jako
   alternativy; každý ověřený spuštěním.
5. **Sada ZZF2L.** Stávající F2L nestačí: zhruba dvě třetiny hlavních algoritmů
   základní sady používají F, B, široké tahy nebo otočení kostky. Zdroj je
   tabulka „ZZF2L Cases“, na kterou tutoriál odkazuje (autor ji dodal jako
   xlsx): **čtyři listy, FR / FL / BR / BL, po 83 případech** — poslední slot
   (20), hrana ve slotu (9), roh ve slotu (9), oba dílky ve slotech (45). Ke
   každému jeden až tři algoritmy a zvlášť sloupec řešení, která využijí
   jiný volný slot (včetně keyhole). **Případ je v tabulce obrázek, ne text**,
   takže který případ algoritmus řeší, řekne kostka, ne buňka — jako u listů
   Rouxu. Pár řádků tabulky samo sahá na F nebo S; projdou, jen když hrany
   nechají dobré. Co je potřeba rozhodnout, až na sadu dojde: jeden slot se
   zrcadlením, nebo všechny čtyři (přední a zadní slot se v ZZ řeší jinak,
   protože se kostka neotáčí), a kolik z 83 případů ukázat — zdroj sám říká,
   že případy s oběma dílky ve slotech se až na pár neučí, vybere se jiný pár.
6. **Později.** Drill EOCrossu chce vlastní solver a jinou techniku než cross:
   stavů je 24 milionů (2¹¹ orientací × 11 880 rozmístění čtyř hran) proti
   necelým 200 tisícům, tabulka vzdáleností se do telefonu nevejde. ZBLL (493
   případů) je samostatný projekt; zdroj na ni jen odkazuje do cizích tabulek.

**Zdroj a licence.** Repo je MIT (© 2023 crystalcuber) a obsahuje jen 34
algoritmů poslední vrstvy; řešení F2L a ZBLL jsou v cizích tabulkách. Web
blokuje AI crawlery a jeho podmínky zakazují použít obsah k trénování nebo
vývoji generativních modelů. To se tu neděje, ale je to důvod navíc psát texty
vlastní, zdroj uvést v O aplikaci a autorům dát o aplikaci vědět.

**Zbytek fáze — nápad z 2026-09-24, předřazený smart cube.** Zapsaný rozbor, ne
rozhodnutí:
**obsah (fáze metod, algoritmy) se bude brát ze zdrojů, které dodá autor** —
Roux ani ZZ sám neskládá, takže volba fází a algoritmů není na odhadu.
Zdroje, které autor doporučil:

- **Roux:** <https://sites.google.com/view/kianroux/>
- **ZZ:** <https://www.zzmethod.com/>

**Co už stojí.** Datový model s tím počítá od začátku: fáze splitů jsou
`Method.phases` (CFOP je jen seedovaný záznam), `Session.methodId`,
`AlgSet.methodId`, `Method.puzzle`; typ `Puzzle` zná všechny WCA disciplíny, solvy
i sessiony nesou `puzzle` a aktivní session i PB se vedou po disciplínách. Splity,
průměry fází a jejich barvy (přidělené podle pořadí, ne jména) snesou libovolný
počet fází. Model kostky zná slice (`M`), wide (`r`) tahy i rotace. Scramble pro
2×2 a další disciplíny umí cubing.js stejně jako pro 3×3.

**Co je dnes natvrdo 3×3 CFOP:** `const PUZZLE = '333'` na sedmi obrazovkách
(timer, historie, statistiky, výběr session, drilly), nová session dostává
`methodId: 'cfop'`, trenažér (pořadí a úrovně sad, `diagramFor`, ověřování sad
v `packs.test.ts`), cross drill s vlastním solverem a průvodce pro začátečníky.
Import z csTimeru už dnes natáhne i 2×2, 4×4, pyraminx… sessiony — v databázi
jsou, jen je žádná obrazovka neukáže.

**Postup, každý krok použitelný sám o sobě:**

1. **Volba disciplíny a metody** (nejdřív kostka, pak metoda, která k ní patří;
   dělat obojí najednou, ať se nastavení nepředělává dvakrát). Výchozí metoda
   v Nastavení, nové sessiony ji převezmou; **existující session si metodu
   nechává** — její splity patří k fázím, pod kterými byly změřeny. Timer,
   historie a statistiky pro zvolenou disciplínu fungují samy; jiné kostky než 3×3
   mají zatím jen textový scramble. Rozsah zhruba jedno sezení.
2. **Náhled scramblu 2×2 ve vlastním skinu.** 2×2 se chová jako rohy 3×3 (R na 2×2
   udělá s rohy totéž co R na 3×3), takže stačí stávající model a kreslit jen
   rohové nálepky — rozvin a pohled od rohu v mřížce 2×2. Háček: 3D animaci 2×2
   kreslí cubing.js jiným rendererem (PG3D, ne `Cube3D`), takže `lib/twisty-skin.ts`
   na ni nesáhne — buď barvy cubing.js, nebo nový průzkum.
3. **Trenažér podle metody.** Metoda musí **vlastnit seznam sad**, ne sada jednu
   metodu: OLL/PLL sdílí CFOP a ZZ (dnes je to `AlgSet.methodId`, tedy změna modelu
   s migrací). Sady po jedné, každou ověřit spuštěním jako OLL/PLL — zhruba den na
   sadu podle kvality zdrojů:
   - **ZZ:** rozhodnuto jinak, viz „ZZ — rozhodnuto 2026-10-12“ výš (EOCross,
     bez COLL, seznam sad na metodu mimo databázi)
   - **Roux:** fáze FB → SB → CMLL → LSE (jestli LSE dělit na EOLR + 4c, rozhodnou
     zdroje); nově CMLL (42), případně EOLR. LSE (jen M a U) by chtělo nový druh
     obrázku, CMLL stačí pohled shora
   - **2×2:** Ortega (7 + 5), CLL (42), EG-1 / EG-2 (po 42); ověřitelné na stejném
     modelu přes rohy 3×3
4. **Drilly intuitivních fází** (EOLine, první blok Rouxu) až nakonec — každý chce
   vlastní solver jako cross drill a první blok i jiný pohled na kostku (zleva).

Průvodce je pro CFOP, Roux i ZZ (viz výše); pro další metody se
rozhodne, až na ně dojde.

### Fáze 8 — Smart cube (později)

Druhá implementace `SplitSource` přes Web Bluetooth (`source: 'smartcube'`),
případně rekonstrukce tahů. Datový model se kvůli tomu **nemění**.
