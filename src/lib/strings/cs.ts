/**
 * The Czech copy. Typed as the English object with its literals widened, so
 * the compiler is what notices a key that was added on one side only.
 *
 * Tykání throughout — the reader is somebody practising, not somebody being
 * addressed by an institution. Times keep the decimal point they are written
 * with everywhere in cubing (12.34, not 12,34), and the vocabulary the sport
 * itself uses stays English: cross, F2L, OLL, PLL, AUF, ao5, DNF, +2, PB.
 */

import { totalRecords, type RecordCounts } from '../../domain/transfer/backup-reminder';
import type { Strings } from './en';
import { plural } from './plural';

/**
 * Druhy záznamů jako jedna fráze: „120 složení a 45 pokusů v drillu“. Věty kolem
 * ní ji uvádějí dvojtečkou — sloveso by se se seznamem několika počtů shodovalo
 * jen těžko.
 */
function records(counts: RecordCounts): string {
  const attempts = (count: number) => `${count} ${plural(count, 'pokus', 'pokusy', 'pokusů')}`;
  const parts = [
    counts.freestyle > 0 ? `${counts.freestyle} složení` : null,
    counts.drill > 0 ? `${attempts(counts.drill)} v drillu` : null,
    counts.recognition > 0 ? `${attempts(counts.recognition)} o rozpoznání` : null,
    counts.algorithms > 0
      ? `${counts.algorithms} ${plural(counts.algorithms, 'vlastní algoritmus', 'vlastní algoritmy', 'vlastních algoritmů')}`
      : null,
  ].filter((part) => part !== null);
  return new Intl.ListFormat('cs', { type: 'conjunction' }).format(parts);
}

export const cs: Strings = {
  appName: 'Rubix',
  common: {
    dismiss: 'Zavřít',
  },
  playback: {
    play: 'Přehrát',
    pause: 'Pozastavit',
    resume: 'Pokračovat',
    step: 'Další tah',
    back: 'Předchozí tah',
  },
  scramble: {
    label: 'Scramble',
    loading: 'Generuji scramble…',
    failed: 'Scramble se nepovedl — ťukni pro další pokus',
    next: 'Nový scramble',
    replay: 'Přehrát scramble',
    showPreview: 'Zobrazit náhled',
    hidePreview: 'Skrýt náhled',
    edit: (scramble: string) => `Změnit scramble: ${scramble}`,
    field: 'Scramble ke složení',
    hint: 'Napiš nebo vlož vlastní — třeba ze soutěže. Platí pro jedno složení, pak jsou scrambly zase náhodné.',
    invalid: "Tohle není scramble — piš tahy jako R U' F2.",
    use: 'Použít',
    sources: {
      own: 'Vlastní scramble',
      history: 'Scramble z historie',
      shared: 'Sdílený scramble',
    },
    sharedRun: (count: number, at: number) => `Sdílený ao${count} · ${at}/${count}`,
    toBeat: (time: string) => `k překonání ${time}`,
    unpin: 'Zpět na náhodný scramble',
  },
  timer: {
    holdToStart: 'Podrž pro start',
    holdToStartInspection: 'Podrž a pusť pro start',
    releaseToStart: 'Pusť pro start',
    releaseToInspect: 'Pusť pro inspekci',
    inspectionHint: 'Ťukni pro inspekci',
    keys: {
      holdToStart: 'Podrž mezerník pro start',
      holdToStartInspection: 'Podrž mezerník a pusť pro start',
      inspectionHint: 'Mezerník spustí inspekci',
      tapToEndPhase: 'Mezerník ukončí fázi · podržením složení ukončíš',
    },
    locked: 'Řešení je odhalené — pokračuj tlačítkem Další',
    lockedDone: 'Hotovo — pokračuj tlačítkem Další',
    /* Zkratka jen sem, kde se dva přepínače perou o šířku s názvem session;
       celé slovo dostane čtečka i nastavení. */
    inspectionToggle: 'Insp',
    inspectionToggleLabel: 'Inspekce',
    cancelled: 'Pokus zahozen',
    phaseToggle: 'Fáze',
    phaseToggleLabel: 'Fáze',
    tapToEndPhase: 'Ťukni pro konec fáze · podrž pro konec složení',
    releaseToFinish: 'Pusť pro konec',
    solving: 'Skládáš',
    recordPb: 'Osobní rekord',
    recordSession: 'Rekord session',
    recordPhases: (phases: string) => `Nejlepší ${phases}`,
    recordPhaseJoin: ' · ',
    goalMark: '✓',
    challengeBeaten: (target: string, margin: string) => `Překonáno ${target} o ${margin}`,
    challengeTied: (target: string) => `Vyrovnáno ${target}`,
    challengeMissed: (target: string, margin: string) => `Na ${target} chybělo ${margin}`,
    challengeMissedDnf: (target: string) => `${target} nepřekonáno`,
    challengeAverage: (count: number, time: string) => `ao${count} ${time}`,
    challengeTiedMark: '=',
    challengeMissedMark: '✗',
  },
  splits: {
    bestPhase: (phase: string) => `Nejlepší ${phase} této session`,
    title: 'Fáze',
    phaseAverages: 'Průměry fází',
    shareBar: (n: number | 'all') =>
      n === 'all'
        ? 'Jak se průměr všech složení s fázemi dělí mezi fáze'
        : `Jak se aktuální ao${n} dělí mezi fáze`,
    phaseTrend: 'Vývoj fází',
    phaseTrendSolve: (index: number) => `${index}. složení s fázemi`,
    best: 'Nejlepší',
    total: 'Celkem',
    all: 'Vše',
    length: 'Délka',
    endsAtColumn: 'Konec v',
    endsAt: 'konec v',
    endsAtStop: 'na konci',
    addSplit: 'Přidat',
    removeSplit: 'Odebrat',
    clear: 'Smazat časy fází',
    none: 'Toto složení bylo měřeno celé, bez fází.',
    measuredNote: (measured: number, total: number) =>
      `${measured} z ${total} složení ${plural(measured, 'má', 'mají', 'má')} měřené fáze; zbytek byl měřený celý, bez fází.`,
    trendAxes: (count: number) =>
      `Vodorovně: posledních ${count} složení měřených po fázích, od nejstaršího.`,
    smoothing: 'Vyhladit',
    smoothingOn:
      'Vyhlazeno: každý bod je průměr toho složení a čtyř předchozích, takže extrémy nevyskočí.',
    smoothingTooltip: 'Průměr tohoto složení a čtyř předchozích.',
    smoothingOff: 'Každé složení tak, jak bylo naměřeno.',
    modeStacked: 'Na sobě',
    modeSeparate: 'Zvlášť',
    modeShare: 'Podíl',
    modeStackedNote: 'Fáze na sobě, takže výška je celé složení.',
    modeSeparateNote: 'Každá fáze od nuly, takže jde sledovat jedna samostatně.',
    modeShareNote: 'Každá fáze jako procento složení, ať trvalo jakkoli dlouho.',
  },
  solve: {
    expandList: 'Další složení',
    collapseList: 'Zpět na timer',
    plusTwo: '+2',
    dnf: 'DNF',
    delete: 'Smazat',
    confirmDelete: 'Smazat?',
    confirmDeleteLabel: 'Smazat toto složení — potvrď dalším ťuknutím',
    empty: 'Zatím žádná složení. Podrž pro start.',
    emptyKeys: 'Zatím žádná složení. Podrž mezerník pro start.',
    autoPenalty: 'z inspekce',
  },
  undo: {
    action: 'Zpět',
    /* „složení“ se nesklonuje, ale sloveso u něj ano. */
    deleted: (count: number) =>
      count === 1
        ? 'Složení smazáno.'
        : `${count} složení ${plural(count, 'smazáno', 'smazána', 'smazáno')}.`,
    restoring: 'Vracím složení zpět',
    putBack: 'Vracím zpět',
    tagDeleted: (name: string) => `Tag „${name}“ smazán.`,
    sessionDeleted: (name: string, solves: number) =>
      solves === 0
        ? `Session „${name}“ smazána.`
        : `Session „${name}“ smazána i s ${solves} složení.`,
    moved: (count: number, session: string) =>
      count === 1
        ? `Složení přesunuto do ${session}.`
        : `${count} složení ${plural(count, 'přesunuto', 'přesunuta', 'přesunuto')} do ${session}.`,
  },
  sheet: {
    previous: 'Předchozí',
    next: 'Další',
    position: (at: number, total: number) => `${at} / ${total}`,
  },
  nav: {
    timer: 'Timer',
    history: 'Historie',
    stats: 'Statistiky',
    learn: 'Pro začátečníky',
    trainer: 'Trenažér',
    drill: 'Dril',
    settings: 'Nastavení',
    data: 'Data',
    about: 'O aplikaci',
    openMenu: 'Otevřít menu',
    closeMenu: 'Zavřít menu',
    more: 'Více',
    screens: 'Obrazovky',
  },
  puzzle: {
    title: 'Kostka',
    switch: (name: string) => `Kostka: ${name}. Přepnout kostku`,
    names: {
      '333': '3×3',
      '222': '2×2',
      '444': '4×4',
      '555': '5×5',
      pyram: 'Pyraminx',
      skewb: 'Skewb',
      sq1: 'Square-1',
      clock: 'Clock',
      minx: 'Megaminx',
    },
    nothingYet: (name: string) =>
      `Dril pro ${name} tu zatím není. Průvodce, sady v trenažéru, timer i statistiky už pro ni jsou.`,
  },
  stats: {
    empty: 'V této session zatím nejsou žádná složení.',
    emptyAll: 'Zatím žádná složení.',
    scope: 'Která složení',
    allSessions: 'Všechny session',
    thisSession: 'Tato session',
    recent: (count: number) => `Posledních ${count}`,
    solvesOf: (read: number, total: number) => `Posledních ${read} z ${total} složení`,
    bestSingle: 'Nejlepší čas',
    recentBest: (count: number) => `Nejlepší z posledních ${count}`,
    tagFilter: 'Jen složení s tímto tagem',
    tagLabel: 'Tag',
    withTag: (name: string) => `s tagem ${name}`,
    methodOnly: (method: string) => `jen ${method}`,
    emptyTag: 'S tímto tagem zatím žádná složení.',
    solveCount: (count: number) => `${count} složení`,
    averages: 'Průměry',
    current: 'Aktuální',
    best: 'Nejlepší',
    pbSingle: 'PB single',
    sessionBest: 'Rekord session',
    mean: 'Průměr',
    nextRecord: 'Na rekord stačí',
    nextRecordBelow: (n: number, time: string) => `ao${n} pod ${time}`,
    median: 'Medián',
    stdDev: 'Směr. odchylka',
    dnfRate: 'Podíl DNF',
    plusTwoRate: 'Podíl +2',
    distribution: 'Rozložení časů',
    trend: 'Vývoj',
    bySolve: 'Po složeních',
    byDay: 'Po dnech',
    trendNeedsSolves: 'Klouzavý ao12 začíná dvanáctým složením.',
    dailyMean: 'Průměr',
    dailyBest: 'Nejlepší',
    solvesLabel: 'Složení',
    dailyAxes:
      'Každý bod je jeden den tréninku: čára je jeho průměr, tečka jeho nejlepší složení. Dole se počítají kalendářní dny, takže pauza je vidět jako úsek bez bodů.',
    practice: 'Trénink',
    sections: 'Sekce',
    navDistribution: 'Rozložení',
    toTop: 'Zpět nahoru',
    toTopMark: '↑',
    streak: 'Série',
    dayCount: (count: number) => `${count} ${plural(count, 'den', 'dny', 'dní')}`,
    daysPractised: 'Dnů tréninku',
    solvesInDays: (days: number) => `Složení za ${days} ${plural(days, 'den', 'dny', 'dní')}`,
    daysOf: (active: number, total: number) => `${active} z ${total}`,
    practiceNote: (days: number) =>
      `Složení po dnech za posledních ${days} ${plural(days, 'den', 'dny', 'dní')}.`,
    trendSeries: 'ao12',
    longTrendSeries: 'ao50',
    singleSeries: 'Single',
    windowTitle: (at: 'current' | 'best' | object, n: number) =>
      at === 'best' ? `Nejlepší ao${n}` : at === 'current' ? `Aktuální ao${n}` : `ao${n}`,
    windowTrimNote: (trim: number) =>
      trim === 1
        ? 'Nejrychlejší a nejpomalejší složení se škrtají (v závorce); průměr je ze zbytku.'
        : `${trim} ${plural(trim, 'nejrychlejší', 'nejrychlejší', 'nejrychlejších')} a ${trim} ${plural(trim, 'nejpomalejší', 'nejpomalejší', 'nejpomalejších')} složení se ${plural(trim, 'škrtá', 'škrtají', 'škrtá')} (v závorce); průměr je ze zbytku.`,
    windowDnfNote: 'Více DNF, než kolik jich jde škrtnout, takže průměr je DNF.',
    trimmed: 'nepočítá se',
    goal: 'Cíl',
    goalHint: 'Nastav si cílový čas a uvidíš, jak často se pod něj dostaneš.',
    goalFormat: 'Minuty a sekundy jako 1:30, nebo 1 30, když klávesnice nemá dvojtečku.',
    goalSet: 'Nastavit cíl',
    goalTime: 'Cílový čas',
    goalPlaceholder: '1:30',
    goalSave: 'Uložit',
    goalCancel: 'Zrušit',
    goalChange: 'Změnit',
    goalRemove: 'Odebrat',
    goalName: (time: string) => `Sub ${time}`,
    goalRecent: (count: number) => `Posledních ${count} složení`,
    goalAll: (count: number) => `${plural(count, 'Všechna', 'Všechna', 'Všech')} ${count} složení`,
    goalSeries: 'Cíl',
    records: 'Rekordy',
    recordKind: 'Který rekord',
    noRecords: (n: number) =>
      n === 1 ? 'Zatím žádné rekordy.' : `Zatím žádný ao${n} — je na něj potřeba ${n} složení.`,
    firstRecord: 'první',
    allRecords: (count: number) => `Zobrazit všech ${count}`,
    fewerRecords: 'Zobrazit méně',
    histogramSeries: 'Složení',
    loadingCharts: 'Načítám grafy…',
    penalties: 'Penalizace',
    dnfShort: 'DNF',
    plusTwoShort: '+2',
    solveIndex: 'Složení',
    distributionAxes:
      'Každý sloupec je rozsah časů; výška říká, kolik složení do něj spadá.',
    trendAxes:
      'Čára je průměr dvanácti složení končících v daném bodě; tečky jsou samotná složení, od nejstaršího.',
    trendAxesLong:
      'Zelená čára je průměr dvanácti složení končících v daném bodě, modrá padesáti; tečky jsou samotná složení, od nejstaršího. Zelená pod modrou znamená, že jsi rychlejší než v poslední době.',
    andUp: 'a více',
    bestAo12: 'Nejlepší ao12',
    containsCurrent: 'Sem spadá aktuální ao12',
    touchBar: 'Ťukni na sloupec a uvidíš jeho rozsah a počet.',
  },
  history: {
    empty: 'Těmto filtrům nic neodpovídá.',
    noSolves: 'V této session zatím nejsou žádná složení.',
    loadMore: 'Načíst další',
    detailTitle: 'Detail složení',
    solveAgain: 'Složit tento scramble znovu',
    close: 'Zavřít',
    rawTime: 'Čas',
    invalidTime: 'Zadej 12.34 nebo 1:23.45 — případně 1 23.45, bez dvojtečky',
    star: '★',
    mark: '⚑',
    marked: 'Označeno',
    noteMark: '✎',
    hasNote: 'Má poznámku',
    personalBest: 'Osobní rekord',
    sessionBest: 'Rekord této session',
    tags: 'Tagy',
    newTag: 'Nový tag',
    note: 'Poznámka',
    inspection: 'inspekce',
    edited: 'upraveno',
    select: 'Vybrat složení',
    startSelecting: 'Vybrat',
    stopSelecting: 'Hotovo',
    selected: (count: number) => `Vybráno: ${count}`,
    matchedOf: (matched: number, total: number) => `${matched} z ${total}`,
    deleteSelected: 'Smazat',
    moveTo: 'Přesunout do…',
    moveTitle: 'Přesunout do session',
    filterBy: 'Filtrovat podle',
    penaltyLabel: 'Penalizace',
    markSolve: 'Označit složení',
    filterMarked: 'Filtrovat označená',
    filterRecords: 'Filtrovat rekordy',
    filterDay: 'Filtrovat podle dne',
    days: 'Dny',
    today: 'Dnes',
    yesterday: 'Včera',
    allDays: 'Všechny dny',
    noDays: 'Do této session se zatím nic nenaměřilo.',
    editTags: 'Uprav tagy',
    tagName: 'Název tagu',
    noTags: 'Zatím žádné tagy. Tag vytvořený zde jde přidat na jakékoliv složení.',
    tagOnSolves: (count: number) => `na ${count} složení`,
  },
  sessions: {
    defaultName: 'Výchozí',
    title: 'Session',
    label: 'Session',
    create: 'Vytvořit',
    switchSession: 'Přepnout session',
    activeBadge: 'aktivní',
    solveCount: (count: number) => `${count} složení`,
    rename: 'Přejmenovat',
    archive: 'Archivovat',
    restore: 'Obnovit',
    showArchived: 'Zobrazit archivované',
    noOther: 'Žádná jiná session není.',
    deleteWarning: (count: number) =>
      count === 0
        ? 'V této session nejsou žádná složení.'
        : `Smazáním přijdeš i o ${count} složení — zmizí z průměrů i z osobního rekordu.`,
    confirmDelete: 'Smazat session',
    cancel: 'Zrušit',
    namePlaceholder: 'Název nové session',
    method: 'Metoda',
  },
  learn: {
    intro:
      "Sedm kroků od zamíchané kostky ke složené. Na obrázcích je bílá dole a žlutá nahoře. Co znamenají písmena jako R nebo U', ukáže tlačítko Notace.",
    explanations: 'Vysvětlivky',
    stepsNav: 'Kroky',
    hide: 'Odebrat tohoto průvodce z menu',
    hideHint:
      'Až budeš skládat bez čtení, můžeš zrychlit: rychlejší metoda spojí kroky po dvou — z 2 a 3 je F2L, ze 4 a 5 OLL, z 6 a 7 PLL — a všechny najdeš v Trenažéru. Průvodce pak vyhoď z menu; v nastavení ho vrátíš zpět.',
    source: 'Metoda i pořadí kroků vychází z průvodce pro začátečníky na',
    sourceLink: 'badmephisto.com',
    loading: 'Načítám případy…',
    crossCaption: 'Hotový cross: pod každým středem hrana, která s ním sdílí barvu.',
    crossCases: {
      whiteUp: 'Bílá nahoře: otoč přední stěnou dvakrát.',
      whiteFront: 'Bílá míří na tebe: hrana jde dolů oklikou přes pravou stěnu.',
    },
    showCases: 'Všechny případy',
    hideCases: 'Zpět na jeden algoritmus',
    warning: 'Pozor:',
    tip: 'Tip:',
    steps: {
      cross: {
        title: 'Cross',
        points: [
          'Bílý střed dolů. Kolem něj postavíš kříž ze čtyř hran, které mají bílou nálepku.',
          'Najdi bílou hranu v horní vrstvě a otáčej vrškem (U), dokud její druhá barva nestojí u středu stejné barvy.',
          'Natoč celou kostku, ať je hrana vpředu, a pošli ji dolů podle toho, kam míří bílá — obě možnosti jsou na obrázcích.',
        ],
        warning: 'druhá barva každé bílé hrany musí sedět se středem vedle.',
        tip: 'bílá hrana uprostřed nebo dole na špatném místě? Nejdřív ji dostaň nahoru: otoč stěnou, ve které je, vrškem ji odsuň stranou a stěnu vrať zpátky.',
      },
      corners: {
        title: 'Rohy spodní vrstvy',
        points: [
          'Najdi nahoře roh s bílou a otáčej vrškem (U), dokud nestojí nad svým místem — mezi středy svých barev.',
          'Podívej se, kam míří bílá nálepka (doprava, dopředu, nebo nahoru), a použij algoritmus pro ten případ.',
        ],
        tip: 'roh, který je dole, ale špatně, vyhoď nahoru kterýmkoli z těchto tří algoritmů.',
      },
      middle: {
        title: 'Hrany prostřední vrstvy',
        points: [
          'Najdi nahoře hranu bez žluté.',
          'Otoč vrškem (U), aby stála vpravo a její boční barva seděla s pravým středem.',
          'Barva nahoře řekne, jestli jde dopředu, nebo dozadu — podle toho vyber algoritmus.',
        ],
        tip: 'hranu, která je uprostřed, ale špatně, vyhoď nahoru: natoč celou kostku, aby byla vpravo vpředu, a spusť algoritmus Hrana dopředu.',
      },
      edgeOrientation: {
        title: 'Cross poslední vrstvy',
        points: [
          'Teď záleží jen na žluté nahoře, ne na tom, kde díly jsou.',
          'Najdi svůj tvar (čáru, L, nebo tečku), drž kostku jako na obrázku a spusť algoritmus pod ním.',
          'U tečky spusť oba po sobě.',
        ],
        tip: 'malé f otočí přední stěnu i prostřední vrstvu za ní najednou.',
      },
      cornerOrientation: {
        title: 'Orientace poslední vrstvy',
        points: [
          'Na celou žlutou stěnu stačí jeden algoritmus: opakuj ho, dokud není hotová. Víc než tři spuštění to nikdy nepotřebuje.',
          'Před každým spuštěním natoč kostku podle obrázků — podle toho, kolik rohů už má žlutou nahoře.',
        ],
      },
      cornerPermutation: {
        title: 'Prohození rohů',
        points: [
          'Hledej headlights („světla“): dva rohy na jedné straně se stejnou barvou.',
          'Natoč celou kostku, aby byly vzadu, a spusť algoritmus. Hrany se nehnou.',
        ],
      },
      edgePermutation: {
        title: 'Prohození hran',
        points: [
          'Otáčej vrškem (U), dokud není jedna strana celá jednobarevná.',
          'Natoč celou kostku, aby tato strana byla vzadu, a spusť algoritmus. Rohy se nehnou.',
          'Až sedne poslední hrana, máš složeno.',
        ],
      },
    },
    holds: {
      oneOriented: 'Jeden roh má žlutou nahoře: otáčej vrškem, dokud nebude vpředu vlevo.',
      twoOriented:
        'Dva rohy mají žlutou nahoře: otáčej vrškem, dokud roh vpředu vlevo nemá žlutou na přední stěně.',
      noneOriented:
        'Žádný roh nemá žlutou nahoře: otáčej vrškem, dokud roh vpředu vlevo nemá žlutou na levé stěně.',
      headlights: 'Headlights vzadu: zbylé tři rohy se protočí na svá místa.',
      noHeadlights:
        'Žádné headlights: spusť algoritmus odkudkoli a objeví se.',
      oneSide: 'Hotová strana vzadu: zbylé tři hrany se protočí.',
      noSide:
        'Žádná strana není hotová: spusť algoritmus odkudkoli a jedna bude.',
    },
    method: 'Metoda',
    rouxIntro:
      'Roux je o něco pokročilejší metoda než CFOP vedle: méně algoritmů, víc vlastního přemýšlení. Sedm kroků: blok na každé straně, rohy nahoře dvěma algoritmy a nakonec posledních šest hran jen tahy M a U. Obrázky mají žlutou nahoře, bílou dole a modrou prvního bloku vlevo. Tlačítko Notace vysvětlí písmena jako M nebo r.',
    rouxSource: 'Kroky vycházejí z průvodců Rouxu od Kiana Mansoura a komunity Rouxu, na',
    rouxSourceLink: 'Kianově webu o Rouxu',
    rouxNext: {
      lead: 'Až budeš skládat bez čtení, zrychlí tě sady v trenažéru. Jmenují se zkratkami, pod kterými je potkáš všude:',
      sets: [
        { name: 'SB', text: 'second block, druhý blok: 65 míst, kde pár může být, každé s vlastním algoritmem. Ke kroku 2.' },
        { name: 'CMLL', text: 'corners of the last layer, rohy poslední vrstvy: kroky 3 a 4 jedním algoritmem. 2-Look CMLL je mezistupeň na dva.' },
        { name: 'EO', text: 'edge orientation, orientace hran: každý tvar špatných hran rovnou, bez cesty přes šipku. Ke kroku 5.' },
        { name: 'EOLR', text: 'EO a k tomu levá a pravá hrana: kroky 5 a 6 jedním algoritmem.' },
      ],
      more: 'V session založené jako Roux měří timer čtyři fáze (tlačítko Fáze): FB – first block, první blok, krok 1; SB – druhý blok, krok 2; CMLL – rohy, kroky 3 a 4; LSE – last six edges, posledních šest hran, kroky 5 až 7.',
      hide: 'Pak tohoto průvodce odeber z menu; v Nastavení ho vrátíš zpět.',
    },
    rouxBlockCaption: 'Hotový levý blok při pohledu zleva zepředu.',
    rouxSituations: {
      pairInFront: 'Pár vpředu, roh vlevo: zvedni slot, vlož pár a vrať ho.',
      pairColourUp: 'Pár vzadu se zelenou nahoře: překlop ho a vlož.',
      arrow: 'Šipka: tři špatné hrany nahoře, hrot nad čtvrtou dole vpředu.',
      fourOnTop: 'Čtyři špatné nahoře: přední vyměň za dobrou pod ní. Zbudou tři – šipka.',
      twoAndTwo:
        'Dvě nahoře, dvě dole: dobrou horní natoč dopředu a vyměň ji za špatnou pod ní.',
      twoBad:
        'Dvě špatné: otoč vrškem, ať je vzadu právě jedna z nich – nahoře, nebo dole. Tohle z nich udělá čtyři.',
      sixBad: 'Všech šest špatných: spusť to odkudkoli a zbudou dvě.',
      sideEdgesDown:
        'Obě dole proti sobě, modrá vpředu: natoč nad ni zelené rohy, M2 a vrškem dorovnej.',
      sideEdgesDownMirror:
        'Totéž se zelenou vpředu: nad ni patří modré rohy, takže vrškem na druhou stranu.',
      sideTopOpposite:
        'Obě nahoře proti sobě: natoč je dopředu a dozadu a M2 pošle obě dolů. Pak první algoritmus.',
      sideOneDown:
        'Jedna dole vpředu: druhou natoč nahoře dozadu a tohle ji spustí dolů. Pak první algoritmus.',
      sideTopAdjacent:
        'Obě nahoře vedle sebe: natoč je dopředu a doprava. Tohle pošle dolů obě. Pak první algoritmus.',
      dots: 'Tečky: nahoře pruh jedné barvy, vpředu střed mezi dvěma hranami jiné barvy.',
      threeCycle:
        'Tři hrany v kruhu: vpředu nahoře hrana, která nesedí k žádnému středu, pod ní ta, která sedí.',
    },
    rouxHolds: {
      headlightsLeft:
        'Headlights – dva rohy stejné barvy na jedné straně: otáčej vrškem, dokud nebudou vlevo nad modrým blokem.',
    },
    rouxSteps: {
      firstBlock: {
        title: 'Levý blok',
        points: [
          'Modrý střed vlevo, bílá dolů. Vlevo postavíš blok 1×2×3: bílo-modrou hranu dole a před ní i za ní pár rohu s hranou – hotový je na obrázku.',
          'Na blok není žádný algoritmus, skládá se intuitivně. Zbytek kostky je zatím volný, takže smíš otáčet čímkoli – hlídej jen to, co už z bloku stojí.',
          'Nejdřív dej bílo-modrou hranu pod modrý střed, bílou dolů.',
          "Pak dva páry: hranu páru dej dopředu dolů, roh do horní vrstvy tak, aby bílá nebyla nahoře, a spoj je tahem M' – nebo M2, když barvy nesedí. Pár otoč vrškem doleva a polož ho vedle hrany, nejdřív ten zadní.",
        ],
        tip: 'znáš F2L z CFOP? Je to stejný pár rohu s hranou, jen bez otáčení celé kostky: modrá zůstává vlevo a co by udělalo otočení, udělá střední vrstva (M).',
      },
      secondBlock: {
        title: 'Pravý blok',
        points: [
          'Stejný blok vpravo kolem zeleného středu – jenže už smíš otáčet jen U, R, r a M; zbytek drží levý blok.',
          'Nejdřív bílo-zelená hrana: dej ji nahoru bílou nahoru, nad zelený střed, a R2 ji položí dolů.',
          'Páry spoj jako vlevo a vlož je shora tahy R nebo r – obrázky ukazují obě cesty.',
        ],
      },
      cornerOrientation: {
        title: 'Rohy žlutou nahoru',
        points: [
          'Teď záleží jen na čtyřech rozích nahoře, hrany přijdou na řadu nakonec.',
          'Jeden algoritmus je všechny otočí žlutou nahoru: opakuj ho, dokud nejsou. Před každým během drž kostku podle toho, kolik rohů už má žlutou nahoře.',
        ],
      },
      cornerPermutation: {
        title: 'Rohy na místo',
        points: [
          'Hledej headlights: dva rohy na jedné straně se stejnou barvou.',
          'Otoč vrškem, ať jsou vlevo, a spusť algoritmus. Pak vrškem dorovnej rohy k blokům.',
        ],
      },
      edgeOrientation: {
        title: 'Hrany nahoru nebo dolů',
        points: [
          'Zbývá šest hran: čtyři nahoře a dvě dole, vpředu a vzadu. Nejdřív otoč M, ať je nahoře žlutý nebo bílý střed.',
          'Hrana je dobrá, když její žlutá nebo bílá míří nahoru nebo dolů, a špatná, když míří do strany. Spočítej špatné: vždycky jich je sudý počet – žádná, dvě, čtyři, nebo šest. Na obrázcích je špatná hrana nahoře fialová.',
          "Čtyři špatné dávají šipku: tři nahoře a jedna dole. Otoč vrškem, ať je hrot šipky – prostřední z těch tří – nad špatnou hranou dole, a M' U M udělá ze všech dobré.",
          'Nemáš šipku? Najdi svůj počet na obrázcích pod ní: každý říká, jak kostku držet a čím otočit, a dovede tě k šipce.',
        ],
        tip: "M' U M přetočí čtyři hrany najednou – přední, levou a pravou nahoře a přední dole. Když je špatná hrana dole vzadu, udělej to zezadu: hrot dozadu a M U M'.",
      },
      sideEdges: {
        title: 'Boční hrany',
        points: [
          'Žluto-modrá a žluto-zelená hrana patří nahoru nad bloky. Vkládají se zdola: obě musí být dole proti sobě, jedna vpředu a druhá vzadu.',
          'Pak se podívej na barvu té přední. Otoč vrškem, ať mají dva rohy nad ní tu druhou barvu – nad modrou hranou zelené rohy. M2 zvedne obě hrany k jejich rohům a vrškem dorovnáš boky: to jsou první dva obrázky, pro každou barvu jeden.',
          'Nejsou obě dole? Další obrázky je tam dostanou z každé jiné pozice – a pak přijde na řadu jeden z prvních dvou. Žádný z těch tahů hranu nepřetočí.',
        ],
        tip: "jedna dole vzadu a druhá nahoře? Totéž z druhé strany: horní natoč dopředu a M' U2 M.",
      },
      middleSlice: {
        title: 'Střední vrstva',
        points: [
          'Zbývá jen střední vrstva: čtyři hrany a středy. Teď otáčej jen M a U2.',
          'Hrana sedí, když obě její barvy souhlasí se středy vedle ní. Spočítej, kolik ze čtyř hran sedí.',
          'Všechny čtyři: zbývá jen dotočit M.',
          'Žádná – tečky: otoč M, ať je nahoře pruh jedné barvy, a pak U2 M2 U2 M2. Pruh udělat nejde? Spusť to jednou i tak a půjde.',
          "Jedna – tři hrany v kruhu: vedle hrany, která sedí, je jedna, která nesedí k žádnému ze svých středů. Otoč M, ať je nahoře a ta sedící přímo pod ní, a pak vpředu U2 M U2 M', vzadu U2 M' U2 M.",
          'Nakonec dotoč M, ať jsou středy doma: kostka je složená.',
        ],
      },
    },
    zzIntro:
      "ZZ si na začátku připlatí za pohodlný zbytek: než se cokoli postaví, otočí se všechny hrany tak, aby další skládání nepotřebovalo tah přední ani zadní stěnou a žádné otáčení celé kostky. Sedm kroků: najít špatné hrany, opravit je, cross, čtyři páry jen tahy R, L a U a poslední vrstva, která už má žlutý cross hotový. Počítá s tím, že kostku už složit umíš. Obrázky mají žlutou nahoře, bílou dole a modrou vpředu. Tlačítko Notace vysvětlí písmena jako R nebo U'.",
    zzSource: 'Kroky vycházejí z tutoriálu ZZ od crystalcubera a týmu ZZMethod.com, na',
    zzSourceLink: 'zzmethod.com',
    zzNext: {
      lead: 'Až budeš skládat bez čtení, algoritmy nejdřív pomůžou u poslední vrstvy. V trenažéru jsou pod CFOP, které je má společné:',
      sets: [
        { name: 'OCLL', text: 'orient the corners of the last layer, orientace rohů poslední vrstvy: sedm případů, každý s vlastním algoritmem – druhý krok 2-Look OLL. Ke kroku 5.' },
        { name: 'PLL', text: 'permute the last layer, prohození poslední vrstvy: kroky 6 a 7 jedním algoritmem. 2-Look PLL je mezistupeň na dva.' },
      ],
      more: 'V session založené jako ZZ měří timer tři fáze (tlačítko Fáze): EOCross – hrany a cross, kroky 1 až 3; F2L – čtyři páry, krok 4; LL – last layer, poslední vrstva, kroky 5 až 7.',
      hide: 'Pak tohoto průvodce odeber z menu; v Nastavení ho vrátíš zpět.',
    },
    zzRules: {
      readsPole:
        'Na každé hraně se čte jedna nálepka. Na horní (U) a spodní (D) stěně jsou to všechny čtyři hrany, na přední (F) a zadní (B) jen dvě – vlevo a vpravo od středu, na pravé (R) a levé (L) žádná. Je tam žlutá nebo bílá: dobrá. Na ta místa patří – hrana je otočená správně, i když ještě neleží na svém místě.',
      readsSide:
        'Červená nebo oranžová na týchž místech – na U a D, vedle středu na F a B: špatná. Na ta místa nepatří nikdy, takže hrana je přetočená.',
      readsFront:
        'Modrá nebo zelená na týchž místech – na U a D, vedle středu na F a B: rozhodne druhá nálepka té hrany, na sousední stěně. Je žlutá nebo bílá: špatná. Na čtené místo patřila ona. Je červená nebo oranžová: dobrá.',
    },
    zzFigures: {
      tryIt:
        'Zkus si to: složená kostka, žlutá nahoře a modrá vpředu, a tahy pod obrázkem. Kolik hran je špatných?',
      answer: 'Šest – ty fialové: dvě nahoře, dvě v prostřední vrstvě a dvě dole.',
    },
    zzSituations: {
      fourOnFront: 'Čtyři špatné hrany na přední stěně: F a všechny čtyři jsou dobré.',
      gather:
        "Tři vpředu, čtvrtá nahoře vpravo. Leží na pravé stěně a vpředu vpravo je dobrá hrana: R' otočí tu špatnou dopředu. Pak F.",
      aside:
        "Tři vpředu, čtvrtá vzadu vpravo. Vpředu vpravo už špatná je, takže na tři tahy: R' zvedne hranu nahoru, U ji otočí dopředu, R vrátí pravou stěnu. Pak F.",
      twoBad:
        'Dvě špatné: na přední stěnu dej jen jednu z nich, ke třem dobrým. F udělá ze dvou čtyři špatné a pokračuješ jako se čtyřmi.',
      sixBad: 'Šest špatných: na přední stěnu dej tři, k jedné dobré. Po F zbudou čtyři.',
      crossTop: 'Bílá nahoře, nad středem své druhé barvy: půlotáčka tou stěnou.',
      crossMiddle: 'Bílá míří na tebe v prostřední vrstvě: spodek stranou, hranu dolů, spodek zpátky.',
      joined: 'Spojený a mimo stěnu slotu: zvedni slot, natoč pár nad něj a vrať ho.',
      split: 'Rozdělený, roh nad svým slotem: zvednutí slotu je spojí. Pár vrať nad slot a dolů.',
      stuck:
        'Dílek ve slotu: zvedni slot, otáčej vrškem, dokud na té stěně není žádný z obou dílků, a slot vrať.',
      touching: 'Dotýkají se, nejsou spojené: roh nad slot, zvedni ho, vrškem o půl a vrať.',
      whiteUp:
        'Bílá na vršku rohu: natoč hranu nad střed její boční barvy. Zvedni slot, roh natoč nad hranu a slot vrať. Spojený.',
      topsMatch:
        'Na vršku obou stejná barva: roh dozadu vpravo. Zvedni slot, roh tím uhne; hranu natoč dozadu, vedle místa, kde byl, a slot vrať. Spojený.',
      topsDiffer:
        'Na vršku různé barvy: roh dozadu vpravo, zvedni slot, ale hranu pošli doleva, od něj pryč. Rozdělený.',
    },
    zzPairsMore: {
      lead: 'V tomto pořadí: dílek ven ze slotu, dva dotýkající se od sebe, a pak podle barvy na vršku rohu – bílá, stejná jako na vršku hrany, nebo ta druhá.',
      show: 'Jak se k nim dostat',
      hide: 'Jen ty dva tvary',
    },
    zzSteps: {
      badEdges: {
        title: 'Špatné hrany',
        points: [
          'Žlutý střed nahoru, modrý dopředu – a tak kostka zůstane, dokud nejsou hotové první dvě vrstvy.',
          'Hrana je buď dobrá, nebo špatná – přetočená, jako hrana poslední vrstvy bez žluté nahoře. ZZ je spočítá všech dvanáct, než udělá cokoli jiného.',
          'Barvy mají role podle středů: žlutá a bílá patří nahoru a dolů, modrá a zelená dopředu a dozadu, červená a oranžová do stran.',
          'Na každé hraně čti jednu nálepku: nahoře a dole tu, která míří nahoru nebo dolů, v prostřední vrstvě tu vpředu nebo vzadu. Složená kostka má na těch místech jen žlutou a bílou a v prostřední vrstvě modrou a zelenou – červenou a oranžovou nikdy.',
          'Hrana je dobrá, když je tam ta z jejích dvou barev, která tam patří: žlutá nebo bílá, a když je hrana nemá, modrá nebo zelená. Tři obrázky jsou všechno, co tam můžeš vidět.',
          'Počítej po vrstvách: čtyři hrany nahoře, čtyři uprostřed, čtyři dole. Špatných vyjde vždycky sudý počet; je-li jich víc než dobrých, počítej ty dobré. Zkus si to na kostce pod obrázky.',
        ],
        tip: 'proč zrovna tahle místa? Tahy R, L, U a D z nich žádnou nálepku neodnesou a žádnou na ně nepřinesou – to umí jen čtvrtotáčka F nebo B. Špatná hrana se proto bez ní domů nedostane, a dobrá ji nepotřebuje.',
      },
      edgesGood: {
        title: 'Oprava hran',
        points: [
          'Hranu přetočí jen čtvrtotáčka přední (F) nebo zadní (B) stěny – všechny čtyři hrany té stěny najednou, špatné na dobré a dobré na špatné. Ostatní tahy (R, L, U, D, F2, B2) hrany jen přesouvají.',
          'Cíl: čtyři špatné hrany na přední stěně. Pak F a všechny čtyři jsou dobré.',
          'Špatná hrana, která na přední stěně není, leží na horní (U), pravé (R), spodní (D) nebo levé (L) – někdy na dvou z nich. Otoč tou stěnou, až bude hrana vpředu. Vystřídá tam jednu hranu přední stěny; ostatní tři se nehnou.',
          "Vystřídala by jinou špatnou hranu? Pak to chce tři tahy: stěnou, na které hrana leží, ji přesuň na jinou stěnu, tou ji otoč dopředu a první stěnu vrať zpátky. Na třetím obrázku je to R' U R.",
          'Špatných hran může být i jiný počet než čtyři. Dvě a šest ukazují poslední dva obrázky. Osm nebo dvanáct opravuj po čtyřech. Deset začni jako šest: tři na přední stěnu k jedné dobré, po F jich zbude osm.',
        ],
        tip: 'totéž jde vzadu s B – začni tou z obou stěn, na které je špatných víc. Zbyla vzadu špatná hrana, která nejde dopředu ani na tři tahy? B2 ji přesune na druhou stranu.',
      },
      cross: {
        title: 'Cross',
        points: [
          'Čtyři bílé hrany kolem bílého středu dole, každá sedí se středem vedle – stejný cross jako v CFOP.',
          'Otáčet se teď smí jen R, L, U, D, F2 a B2. S dobrými hranami to stačí: bílá nikdy nemíří nešikovně. Nahoře míří nahoru, v prostřední vrstvě dopředu nebo dozadu.',
          'Nahoře: otáčej vrškem, dokud hrana nestojí nad středem své druhé barvy, a pak tou stěnou otoč o půl.',
          'V prostřední vrstvě: dolů ji pošle jedna otáčka stěny, na které je. Nejdřív natoč spodek, ať je její místo pod ní, a potom ho vrať.',
        ],
        warning: 'čtvrtotáčka F nebo B nebo otočení celé kostky, a hrany se musí počítat znovu.',
        tip: 'kroky 1 až 3 se dohromady jmenují EOCross. Časem se plánují najednou, ještě před prvním tahem.',
      },
      pairs: {
        title: 'První dvě vrstvy',
        points: [
          'Čtyři páry do čtyř slotů jako v CFOP – jen se kostka neotáčí a F ani B se nehýbou. Slot zvedá jeho vlastní stěna, R pro dva vpravo a L pro dva vlevo, a zbytek udělá vršek.',
          'Pár se vkládá ze dvou tvarů, spojený nebo rozdělený: dva obrázky.',
          'Co bys řešil přes F, B nebo otočení kostky, má místo toho cestu k jednomu z těch dvou tvarů. Projde ji tlačítko pod obrázky.',
        ],
        tip: "obrázky ukazují slot vpředu vpravo. Vpředu vlevo je to zrcadlově, L' místo R. Zadní sloty se zvedají opačně: vpravo R', vlevo L.",
      },
      cornersUp: {
        title: 'Orientace poslední vrstvy',
        points: [
          'Žlutý cross už stojí – za to se na začátku otáčely hrany. Zbývá otočit čtyři rohy a odteď se kostka zase smí otáčet celá.',
          'Stačí jeden algoritmus: opakuj ho, dokud není stěna žlutá. Víc než tři spuštění to nikdy nepotřebuje.',
          'Před každým spuštěním natoč kostku podle obrázků – podle toho, kolik rohů už má žlutou nahoře.',
        ],
      },
    },
    guideNames: {
      '222-layers': 'Po vrstvách',
      '222-ortega': 'Ortega',
    },
    pocket: {
      intro:
        "Tři kroky od zamíchané kostky 2×2 ke složené. Nazpaměť stačí dvě věci: čtyři tahy a jeden krátký algoritmus. Na obrázcích je bílá dole a žlutá nahoře. Co znamenají písmena jako R nebo U', ukáže tlačítko Notace.",
      source: 'Metoda a její tři kroky jsou z návodu na 2×2 pro začátečníky na',
      sourceLink: 'jperm.net',
      hideHint:
        'Až budeš skládat bez čtení, rychlejší cesta je Ortega, druhý průvodce nahoře na stránce: stěna místo vrstvy a pak dva z dvanácti algoritmů.',
      steps: {
        whiteLayer: {
          title: 'Bílá vrstva',
          points: [
            "Skoro celou kostku složí čtyři tahy: R U R' U'. Opakuj je, dokud je ruce neumí samy – po šesti opakováních je kostka zase tam, kde byla.",
            'Vyber si kterýkoli bílý dílek a drž kostku tak, aby jeho bílá mířila dolů. Ten dílek je hotový a odteď zůstává dole.',
            'Najdi další bílý dílek v horní vrstvě. Má-li s hotovým společnou ještě jinou barvu než bílou, patří vedle něj na tu stranu. Nemá-li žádnou, patří naproti němu.',
            'Otáčej vrškem (U), dokud dílek nestojí přímo nad svým místem, a chyť kostku tak, aby to místo bylo vpředu vpravo. Pak opakuj čtyři tahy, dokud není dole bílou dolů – kolikrát, říkají obrázky.',
          ],
          tip: 'bílý dílek je dole, ale na špatném místě nebo otočený? Dej ho dopředu vpravo a udělej čtyři tahy jednou: vyjede nahoru.',
        },
        place: {
          title: 'Žluté dílky na místa',
          points: [
            'Bílá zůstává dole. Každý žlutý dílek teď půjde do svého rohu; kam míří jeho žlutá, je zatím jedno.',
            'Dílek je na svém místě, když jsou jeho dvě další barvy stejné jako dvě barvy spodního dílku pod ním – dva obrázky.',
            'Otáčej vrškem (U), dokud není na místě aspoň jeden dílek, a spočítej je. Všechny čtyři: krok je hotový.',
            'Jeden: dej ho dopředu vpravo. Dva vedle sebe: otoč vrškem dál, až bude na místě jen jeden, a dej dopředu vpravo ten. Dva naproti sobě: dej dopředu vpravo kterýkoli z nich.',
            'Udělej algoritmus a spočítej je znovu. Ještě ne čtyři? Projdi krok ještě jednou.',
          ],
          tip: 'algoritmus jde po rukou. Vršek pravou rukou a pravá strana nahoru, vršek levou rukou a levá strana nahoru. Pak obojí znovu, jen strany jdou dolů.',
        },
        turn: {
          title: 'Žlutá dolů',
          points: [
            'Otoč celou kostku vzhůru nohama: bílá nahoře, žluté dílky dole.',
            'Podívej se na spodní dílek vpředu vpravo. Míří žlutou dolů: je hotový. Jinak opakuj čtyři tahy, dokud jeho žlutá nemíří dolů – dvakrát nebo čtyřikrát, jak je na obrázcích.',
            'Potom otoč jen spodní vrstvou (D), ať je vpředu vpravo další nehotový dílek, a udělej totéž.',
            'S posledním dílkem se vršek složí zpátky sám. Může zbýt už jen pootočit spodkem.',
          ],
          warning:
            'bílá vrstva se cestou rozpadne a tak to má být. Neopravuj ji a neotáčej celou kostkou, jen spodní vrstvou – a čtyři tahy vždycky dodělej všechny, i když dílek vypadá hotový už po třech.',
          tip: 'zbyl jeden otočený dílek a všechno ostatní je složené? To otáčením vyřešit nejde: kostka byla špatně sestavená a jeden roh je potřeba vyndat a vrátit správně.',
        },
      },
      situations: {
        whiteRight: 'Bílá míří doprava: jednou',
        whiteUp: 'Bílá míří nahoru: třikrát',
        whiteFront: 'Bílá míří dopředu: pětkrát',
        oneInPlace: 'Jeden dílek na místě, vpředu vpravo',
        yellowRight: 'Žlutá míří doprava: dvakrát',
        yellowFront: 'Žlutá míří dopředu: čtyřikrát',
      },
      figures: {
        inPlace:
          'Dílek vpředu vpravo je na svém místě: má stejné dvě barvy jako dílek pod ním, i když jeho žlutá míří dopředu.',
        notInPlace: 'Tenhle není: jedna z jeho barev na dílku pod ním chybí.',
      },
      goal: 'Bílá vrstva hotová: boky sedí dokola.',
    },
    ortega: {
      intro:
        '2×2 tak, jak se skládá rychle: tři kroky a dvanáct algoritmů. Jedna stěna libovolné barvy, protější stěna přes OLL a obě vrstvy naráz přes PBL. Na obrázcích je ta stěna bílá; několik algoritmů znáš z 3×3.',
      source: 'Metoda, její algoritmy i jejich jména jsou od J Perma na',
      sourceLink: 'jperm.net',
      hideHint:
        'Až budeš mít těch dvanáct v rukou, dalším krokem je CLL a po něm EG. Pak průvodce odeber z menu; v Nastavení ho vrátíš zpět.',
      steps: {
        face: {
          title: 'Jedna stěna',
          points: [
            'Slož jednu stěnu v jedné barvě. Boky nemusí sedět – proto je to rychlejší než celá vrstva.',
            'Čtyři tahy z prvního průvodce dostanou na místo každý dílek, ale kratší je lepší: najdi dva dílky, které už drží u sebe, a přidej k nim další dva.',
            'Pak tu stěnu drž dole, pro další dva kroky.',
          ],
          tip: 'časem se stěna naplánuje během prohlídky, ještě před prvním tahem. Málokdy potřebuje víc než pět nebo šest tahů.',
        },
        oll: {
          title: 'Horní stěna (OLL)',
          points: [
            'Otoč horní stěnu na žlutou. Sedm případů, každý má svůj algoritmus.',
            'Který to je, řeknou žluté nálepky: kolik jich míří nahoru – jedna, žádná, nebo dvě – a kam míří ostatní.',
            'Otáčej vrškem (U), dokud není žlutá tam, kde ji má obrázek, a udělej algoritmus. Spodní stěna zůstane, jak byla.',
          ],
          tip: 'těch sedm jsou rohové případy z dvoukrokového OLL na 3×3 – L se tam jmenuje Bowtie. Algoritmus odtamtud bez širokého tahu funguje i tady.',
        },
        pbl: {
          title: 'Obě vrstvy (PBL)',
          points: [
            'Obě stěny jsou hotové, jen dílky v každé vrstvě nejsou na svých místech. Pět případů podle toho, co je špatně ve které vrstvě.',
            'Dívej se na každou vrstvu zvlášť. Strana, kde jsou obě její nálepky jedné barvy, je pruh. Čtyři pruhy: vrstva je hotová. Jeden: jsou prohozené dva dílky vedle sebe. Žádný: dva naproti sobě.',
            'Případ vyber podle obou vrstev dohromady. Otáčej vrškem (U) a spodkem (D), dokud nejsou pruhy tam, kde je má obrázek, udělej algoritmus a případně ještě dotoč vršek nebo spodek.',
          ],
          tip: 'Adj U a Diag U jsou permutace T a Y z PLL na 3×3. Je špatně jen spodek a vršek je hotový? Otoč kostku vzhůru nohama a je to jeden z těch pěti.',
        },
      },
      faceCaption: 'Stěna hotová: dole celá bílá, boky jakkoli.',
    },
  },
  trainer: {
    progress: { new: 'Nový', learning: 'Učím se', known: 'Umím' },
    progressLabel: 'Jak ho umím',
    progressKnown: (known: number, total: number) => `Umím ${known} z ${total}`,
    progressLearning: (count: number) => `učím se ${count}`,
    empty: 'Zatím žádné sady algoritmů.',
    loading: 'Načítám případy…',
    twoLook: '2-Look',
    fullSet: 'Full',
    levelBasic: 'Základní',
    levelAdvanced: 'Pokročilé',
    levelExpert: 'Expert',
    play: 'Přehrát',
    loadingPlayer: 'Načítám kostku…',
    variants: 'Algoritmy',
    packAlg: 'vestavěný',
    packAlgGrip: 'vestavěný · s otočením',
    packAlgOther: 'vestavěný · jinak',
    packAlgLeft: 'vestavěný · levou rukou',
    packAlgSlot: 'vestavěný · rozbije jiný slot',
    markOwn: 'tvůj vlastní algoritmus',
    markCostsSlot: 'rozbije jiný slot',
    ownAlg: 'tvůj',
    ownAlgPlaceholder: "Tvůj vlastní algoritmus, např. R U R' U'",
    addAlg: 'Přidat',
    invalidAlg: 'Toto není sled tahů, který bych uměl přečíst.',
    editAlg: 'Upravit',
    saveAlg: 'Uložit',
    cancelEdit: 'Zrušit',
    editPackHint: 'Vestavěný zůstane beze změny, úprava se přidá jako tvůj vlastní.',
    notation: 'Notace',
    notationHint: 'Každý obrázek je složená kostka po tomto jednom tahu.',
    triggers: 'Triggery',
    triggerBuiltIn: 'Vestavěný — místo mazání ho odškrtni.',
    triggersHint:
      'Tahy zvýrazněné uvnitř algoritmu. Když vestavěný upravíš, stane se tvým — aktualizace už na něj nesáhnou.',
    triggerName: 'Název',
    triggerMoves: 'Tahy',
    triggerEnabled: 'Zvýraznit',
    triggerColour: 'Barva',
    addTrigger: 'Přidat trigger',
    chooseAlgorithm: 'Vybírám algoritmus',
    removeAlgorithm: 'Odebírám algoritmus',
    addAlgorithm: 'Přidávám algoritmus',
    saveAlgorithm: 'Ukládám algoritmus',
    drillSet: 'Drilovat sadu',
    caseStats: 'Tvůj dril',
    rename: 'Tvůj název',
    renamePlaceholder: 'např. Fat Antisune',
    renameHint:
      'Zobrazí se místo názvu ze sady všude v trenažéru. Nech prázdné a vrátí se název ze sady — ten zůstává, jak je, protože pod ním případ znají všechny tabulky.',
    renameSave: 'Uložit',
    renaming: 'Přejmenovávám případ',
  },
  drill: {
    pool: 'Případy',
    poolAll: 'Vše',
    poolSlowest: 'Nejpomalejší',
    poolLearning: 'Co se učím',
    poolHint: 'Zaškrtni případy ke drilování. Nic zaškrtnutého znamená celou sadu.',
    poolDone: 'Hotovo',
    caseHint: 'Proveď scramble výše a podrž pro start času.',
    caseHintKeys: 'Proveď scramble výše a podrž mezerník pro start času.',
    crossHint:
      'Drž kostku crossem dolů, proveď scramble výše a podrž pro start času. Cross zůstává pořád dole.',
    crossHintKeys:
      'Drž kostku crossem dolů, proveď scramble výše a podrž mezerník pro start času. Cross zůstává pořád dole.',
    crossFirst:
      'Nejdřív slož cross — od té chvíle každý scramble navazuje tam, kde tě nechal ten předchozí, takže není co mezi pokusy skládat znovu.',
    crossSetup: 'Cross po scramblu, jak ho budeš držet',
    showCase: 'Ukaž mi řešení',
    gaveUp: 'Odhalené řešení, takže se počítá jako DNF.',
    next: 'Další',
    empty: 'V této sadě není co drilovat.',
    attempts: 'Pokusy',
    attemptCount: (count: number) => `${count} ${plural(count, 'pokus', 'pokusy', 'pokusů')}`,
    last: 'Poslední',
    noAttempts: 'Tento případ máš poprvé.',
    judging: 'Měním penalizaci',
    discarding: 'Zahazuji pokus',
    attemptsTitle: 'Pokusy',
    deleteAll: 'Smazat vše',
    deleteAllConfirm: 'Smazat opravdu vše?',
    noneYet: 'Tady se zatím nic nedrilovalo.',
    needsWork: 'Potřebuje trénink',
    crossSolution: 'Nejkratší cross',
    crossMoves: (count: number) => `${count} ${plural(count, 'tah', 'tahy', 'tahů')}`,
    crossSolved: 'Cross je už hotový.',
    crossWatch: 'Přehrát',
    crossWatchAgain: 'Přehrát znovu',
    crossAlternatives: 'Další řešení stejné délky',
    crossFront: 'Vepředu:',
    crossFrontHint: 'Ťukni na stranu, kterou máš k sobě, crossem dolů.',
    /* Barvy kostky držené crossem dolů: otočením se prohodí sousedé pólů,
       takže červená je vlevo a oranžová vpravo. */
    crossColours: { F: 'Zelená', R: 'Oranžová', B: 'Modrá', L: 'Červená' },
    modes: 'Co drilovat',
    modeSolve: 'Složit',
    modeRecognise: 'Poznat',
    nothingToName: 'U crossu není co poznávat',
    setup: 'Změnit, co se driluje',
    inspectionOn: 'Inspekce zapnutá',
    inspectionOff: 'Inspekce vypnutá',
  },
  recognition: {
    question: 'Který případ to je?',
    turn: 'Otočit',
    turnedHint: 'Pohled zezadu zleva.',
    correct: 'Správně',
    wrong: 'Ne — bylo to',
    next: 'Další',
    tooFew: 'Zaškrtni aspoň dva případy: u jednoho není co rozeznávat.',
    empty: 'V této sadě není co rozpoznávat.',
    caseStats: 'Tvoje rozpoznávání',
    saving: 'Ukládám pokus',
    forgetting: 'Mažu pokusy o rozpoznání',
    forget: 'Smazat',
    hint: 'Vršek a dvě strany, jak je uvidíš uprostřed skládání.',
    aufHint: 'Otočení, které tento úhel potřebuje před algoritmem — není jeho součástí.',
  },
  settings: {
    appearance: 'Vzhled',
    language: 'Jazyk',
    languageCs: 'Čeština',
    languageEn: 'English',
    languageHint: 'Přepnutí jazyka aplikaci znovu načte. Tvoje data zůstanou beze změny.',
    theme: 'Motiv',
    themeSystem: 'Systém',
    themeLight: 'Světlý',
    themeDark: 'Tmavý',
    themeHint: 'Systém se řídí tím, co má nastavený telefon nebo prohlížeč.',
    font: 'Písmo',
    fontSans: 'Sans',
    fontMono: 'Mono',
    fontSystem: 'Systémové',
    fontHint: 'Systémové použije písmo zařízení. Scramble a algoritmy jsou vždy neproporcionální.',
    textSize: 'Velikost textu',
    clockSize: 'Velikost hodin',
    clockSizeHint: 'Běžící čas na timeru a v drilu, který se čte z větší dálky.',
    clockFace: 'Zobrazení hodin',
    clockFaceMatch: 'Jako aplikace',
    clockFaceMono: 'Mono',
    clockFaceDigital: 'Digitální',
    clockFaceHint: 'Digitální je sedmisegmentové zobrazení jako na stopkách.',
    sizeSmall: 'Malá',
    sizeMedium: 'Střední',
    sizeLarge: 'Velká',
    skin: 'Barvy',
    skinHint: 'Barvy pro všechny obrázky případů v aplikaci.',
    skins: {
      classic: 'Klasické',
      contrast: 'Vysoký kontrast',
      pastel: 'Pastelové',
      accessible: 'Pro barvoslepé',
    },
    twistyMode: 'Náhled kostky',
    previewFlat: 'Plochý',
    preview3d: '3D',
    twistyModeHint: 'Plochý jako rozložená síť, 3D jako kostka viděná od rohu.',
    caseLayout: 'Případy v trenažéru',
    caseLayoutSmall: 'Malé',
    caseLayoutLarge: 'Velké',
    caseLayoutList: 'Seznam',
    caseLayoutHint:
      'Malé ukážou nejvíc případů najednou, seznam píše algoritmy největší. Platí jen pro toto zařízení.',
    timer: 'Timer',
    holdThreshold: 'Podržení pro start',
    holdOff: 'Vypnuto',
    showScramblePreview: 'Zobrazit náhled kostky pod scramblem',
    showNextRecord: 'Ukazovat, co stačí na rekord',
    showNextRecordHint:
      'Pod průměry na timeru, a jen dokud jde dát nejlepší ao5 nebo ao12 session.',
    haptics: 'Zavibrovat při připravení a zastavení',
    runningDisplay: 'Čas během skládání',
    runningHundredths: '0.00',
    runningTenths: '0.0',
    runningSeconds: '0',
    runningHidden: 'Skrytý',
    runningDisplayHint:
      'Jen to, co hodiny ukazují, když běží. Složení se vždy měří na tisíciny a po zastavení se zobrazí na setiny.',
    splitMode: 'Měřit složení po fázích (4 fáze)',
    splitModeHint:
      'Ťuknutí ukončí fázi, poslední fáze zastaví hodiny. Podržením složení ukončíš dřív, když fázi přeskočíš.',
    showLearn: 'Zobrazit průvodce pro začátečníky',
    showLearnHint: 'V menu jako Pro začátečníky. Skrytí nic jiného nezmění.',
  },
  voice: {
    title: 'Fáze hlasem (zkouška)',
    toggle: 'Poslouchat vedle ťukání',
    hint:
      'Když měříš po fázích, řekni na konci každé fáze krátké slovo, třeba „hop“. Časy dál určuje ťukání, po složení uvidíš, co by naměřil hlas. Zvuk se jen měří, a to v tomhle zařízení: nic se nenahrává ani neposílá.',
    needsPhases: 'Poslouchá jen tehdy, když měříš po fázích — to zapneš výš.',
    test: 'Vyzkoušet mikrofon',
    stopTest: 'Zastavit',
    opening: 'Otevírám mikrofon…',
    failed: {
      denied:
        'Mikrofon má aplikace zakázaný. Povol ho v nastavení prohlížeče pro tenhle web a zkus to znovu.',
      unavailable: 'Tohle zařízení nemá mikrofon, který by aplikace mohla použít.',
    },
    meter: 'Hlasitost a čára, kterou musí hlas přejít',
    heard: (voices: number, others: number) =>
      `Řekni „hop“ — slyšeno ${voices}×; jiných zvuků ignorováno: ${others}.`,
    uncalibrated:
      'Zatím bez kalibrace, takže se počítá každý krátký hlas blízko telefonu. Po kalibraci se bude počítat jen ten tvůj.',
    calibrated: (loudnessDb: number) =>
      `Kalibrováno na tvůj hlas: tvoje „hop“ je asi ${loudnessDb} dB nad pozadím a slovo se k tomu musí přiblížit.`,
    calibrate: 'Kalibrovat',
    recalibrate: 'Kalibrovat znovu',
    cancelCalibration: 'Zrušit kalibraci',
    calibrateHint:
      'Polož telefon tam, kde leží při skládání, a řekni pětkrát „hop“ — tak, jak ho budeš říkat při skládání.',
    calibrating: (count: number, of: number) => `„Hop“ ${count} z ${of}`,
    soundsLegend:
      'Každý posouzený zvuk, nejnovější nahoře: za co ho vzal · délka · výška · jak zřetelně se opakuje · hlasitost nad pozadím.',
    verdicts: {
      voice: 'hop',
      long: 'moc dlouhé',
      short: 'moc krátké',
      quiet: 'moc potichu',
      unclear: 'nezní jako hlas',
      repeat: 'opakování',
    },
    traits: (durationMs: number, pitchHz: number, periodicity: number, loudnessDb: number) =>
      `${durationMs} ms · ${pitchHz} Hz · ${Math.round(periodicity * 100)} % · +${loudnessDb} dB`,
    copySounds: 'Zkopírovat tyto zvuky',
    summaryEmpty: 'Se zkouškou zatím žádné složení neproběhlo.',
    summary: (solves: number, heard: number, boundaries: number, extra: number) =>
      `${solves} složení: zachyceno ${heard} z ${boundaries} konců fází, ${extra} ${plural(extra, 'falešný poplach', 'falešné poplachy', 'falešných poplachů')}.`,
    offset: (medianMs: number, spreadMs: number) =>
      medianMs === 0
        ? `Hlas přichází přesně s ťuknutím, ± ${spreadMs} ms.`
        : `Hlas přichází ${Math.abs(medianMs)} ms ${medianMs > 0 ? 'po ťuknutí' : 'před ťuknutím'}, ± ${spreadMs} ms.`,
    copy: 'Zkopírovat podrobnosti',
    copied: 'Zkopírováno.',
    clear: 'Smazat výsledky',
    noteHeard: (heard: number, boundaries: number) => `Hlas ${heard}/${boundaries}`,
    noteExtra: (extra: number) =>
      `${extra} ${plural(extra, 'falešný poplach', 'falešné poplachy', 'falešných poplachů')}`,
    noteFailed: {
      denied: 'Hlas: mikrofon je zakázaný',
      unavailable: 'Hlas: žádný mikrofon',
    },
  },
  data: {
    exportTitle: 'Záloha',
    exportHint:
      'Všechny session, složení, tagy a nastavení v jednom souboru. Motiv a velikost textu zůstanou jen tady.',
    exportAction: 'Exportovat data',
    exportFailed: 'Data se nepodařilo exportovat',
    exportCsvAction: 'Složení jako CSV',
    exportCsvHint:
      'CSV: jeden řádek na složení — čas, penalizace, scramble, fáze — pro tabulkový editor. Zpátky ho aplikace nenačte, není to záloha.',
    lastBackup: (day: string, size: string | null) =>
      `Poslední záloha: ${day}${size === null ? '' : ` · ${size}`}.`,
    noBackup: 'Z tohoto zařízení zatím žádná záloha.',
    changedSince: (counts: RecordCounts) =>
      totalRecords(counts) === 0
        ? 'Od té doby se nic nezměnilo.'
        : `Nové nebo změněné od té doby: ${records(counts)}.`,
    onlyHere: (counts: RecordCounts) => `Jen na tomto zařízení: ${records(counts)}.`,
    storageKept: 'Prohlížeč tato data nechá i ve chvíli, kdy na zařízení dochází místo.',
    storageMayClear: 'Prohlížeč tato data může smazat, až bude na zařízení docházet místo.',
    keepStorage: 'Požádat prohlížeč o trvalé uložení',
    keepStorageRefused:
      'Prohlížeč řekl ne. Většinou pomůže, jakmile je aplikace nainstalovaná — do té doby je jistou kopií jedině záloha.',
    shareBackup: 'Poslat zálohu…',
    shareHint: 'Drive, Dropbox, e-mail sobě — kopie mimo toto zařízení.',
    shareFailed: 'Toto zařízení soubor nesdílelo. Stažená kopie zde pořád je.',
    exported: 'Záloha uložena jako',
    exportedCsv: 'Složení uložena jako',
    importTitle: 'Obnovení a import',
    importHint: 'Vyber soubor. Než potvrdíš náhled, nic se nezapíše.',
    chooseFile: 'Záloha z Rubixu',
    fileFrom: 'Soubor z',
    mode: 'Režim importu',
    modeMerge: 'Sloučit',
    modeMergeHint: 'Nechá obě strany. U každého záznamu vyhraje novější verze, i u smazání.',
    modeReplace: 'Nahradit',
    modeReplaceHint: 'Smaže vše na tomto zařízení a použije místo toho importovaný soubor.',
    previewTitle: 'Co se změní',
    table: 'Tabulka',
    added: 'Nové',
    updated: 'Změněné',
    deleted: 'Smazané',
    nothingToDo: 'Soubor nic nemění.',
    confirmImport: 'Importovat',
    importing: 'Importuji…',
    cancel: 'Zrušit',
    imported: 'Import dokončen.',
    importFailed: 'Soubor se nepodařilo importovat',
    tables: {
      sessions: 'Session',
      solves: 'Složení',
      tags: 'Tagy',
      methods: 'Metody',
      algSets: 'Sady algoritmů',
      algCases: 'Případy',
      algorithms: 'Algoritmy',
      triggers: 'Triggery',
      settings: 'Nastavení',
      tombstones: 'Smazání',
    },
    problems: {
      notJson: 'Tento soubor není JSON.',
      malformed: 'Tento soubor není export z Rubixu.',
      unknownFormat: 'Tento soubor není export z Rubixu.',
      unsupportedVersion: 'Tento soubor zapsala novější verze Rubixu.',
      invalidRow: 'Soubor je poškozený',
    },
    dangerTitle: 'Smazat všechna data',
    dangerHint:
      'Odstraní z tohoto zařízení všechna složení, session a nastavení. Není cesta zpět — nejdříve exportuj.',
    deleteAll: 'Smazat všechna data',
    deleteConfirm: 'Smazat všechno',
    deleteArmed:
      'Není cesta zpět. Tlačítko se za pár sekund odemkne — mezitím si stihneš udělat zálohu.',
    deletedAll: 'Všechna data smazána.',
    deleteFailed: 'Data se nepodařilo smazat',
  },
  backupReminder: {
    sinceBackup: (counts: RecordCounts) => `Mimo tvou poslední zálohu: ${records(counts)}.`,
    never: (counts: RecordCounts) => `Jen na tomto zařízení, bez zálohy: ${records(counts)}.`,
    backUp: 'Zálohovat',
    later: 'Teď ne',
  },
  cstimer: {
    hint:
      'Z csTimeru: export z Export/Import (.txt) nebo jedna session jako CSV. Každá session přijde jako nová.',
    chooseFile: 'Soubor z csTimeru',
    reading: 'Čtu soubor…',
    csvNote: (name: string) =>
      `CSV neříká ani o jaký hlavolam, ani o jakou session šlo, takže dorazí jako session 3×3 s názvem „${name}“. Jeho časy jsou přesné jen tak, jak je csTimer zobrazoval, a +2 je do nich už započítaná; přesný je JSON export.`,
    found: (solves: number, sessions: number) =>
      `${solves} složení v ${sessions} session`,
    withPhases: (count: number) => `${count} s časy fází`,
    phasesDropped: (count: number) =>
      `${count} má jiný počet fází, takže ${plural(count, 'dorazí', 'dorazí', 'dorazí')} bez nich`,
    duplicates: (count: number) => `${count} už tady ${plural(count, 'je', 'jsou', 'je')}`,
    skippedRows: (count: number) =>
      `${plural(count, 'Přeskočen', 'Přeskočeny', 'Přeskočeno')} ${count} ${plural(count, 'řádek', 'řádky', 'řádků')}`,
    nothingNew: 'Každé složení z tohoto souboru už tady je.',
    unsupportedTitle: 'Session, jejichž hlavolam aplikace nezná',
    unsupported: (name: string, type: string, solves: number) =>
      `${name} — csTimer tomu říká ${type}, ${solves} složení`,
    session: 'Session',
    puzzle: 'Hlavolam',
    newSolves: 'Nové',
    confirm: 'Importovat z csTimeru',
    importing: (written: number, total: number) => `Importuji… ${written} / ${total}`,
    imported: (count: number) =>
      `${count} složení ${plural(count, 'importováno', 'importována', 'importováno')} z csTimeru.`,
    whereToFind:
      'Importované session najdeš pod názvem session nahoře na timeru, v historii a ve statistikách — vyber si tam některou a uvidíš její složení.',
    switchTo: (name: string) => `Přepnout na „${name}“`,
    switchedTo: (name: string) => `Timer, historie i statistiky teď ukazují „${name}“.`,
    skippedTitle: 'Přeskočené řádky',
    reasons: {
      malformed: 'toto by csTimer jako složení nezapsal',
      unreadableTime: 'čas se nepodařilo přečíst',
      unreadablePenalty: 'penalizace, pro kterou aplikace nemá název',
      unreadableDate: 'datum se nepodařilo přečíst',
    },
    problems: {
      notJson: 'Tento soubor není ani csTimer JSON, ani csTimer CSV.',
      notCsTimer: 'Tento soubor je JSON, ale ne export z csTimeru.',
      notCsv: 'Tento soubor není CSV export z csTimeru.',
      empty: 'V tomto souboru nejsou žádná složení.',
      unreadable: 'Tento soubor se nepodařilo přečíst. Vyber ho znovu.',
    },
    failed: 'Soubor z csTimeru se nepodařilo importovat',
    importedSession: 'csTimer',
  },
  unsupportedBrowser: {
    title: 'Tento prohlížeč je na Rubix moc starý',
    message:
      'Aktualizuj prohlížeč na poslední verzi a otevři stránku znovu. Na iPhonu nebo iPadu to znamená iOS 17.5 nebo novější.',
  },
  share: {
    action: 'Sdílet',
    busy: 'Kreslím…',
    single: 'Single',
    failed: 'Obrázek se nepodařilo vytvořit',
    challenge: (time: string, link: string) => `Překonáš ${time}? ${link}`,
    tryScramble: (link: string) => `Zkus tenhle scramble: ${link}`,
  },
  errors: {
    saveSolve: 'Složení se nepodařilo uložit',
    drillScramble: 'Scramble drilu spadl zpět na setup',
    noSession: 'Žádná aktivní session',
    database: 'Databáze není dostupná',
    databaseStuck: 'databáze přestala odpovídat — načti aplikaci znovu',
    databaseBlocked: 'databázi drží jiné okno aplikace — zavři ho a načti znovu',
    notResponding: 'databáze neodpověděla včas — načti aplikaci znovu',
    mainThreadBusy: 'aplikace byla moc zaneprázdněná na zápis; za chvilku dorazí',
    databaseSurvey: 'Co se zaseklo',
    seed: 'Sady algoritmů se nepodařilo načíst',
    settings: 'Nastavení se nepodařilo přečíst',
    dismiss: 'Zavřít',
    retry: 'Zkusit znovu',
  },
  diagnostics: {
    title: 'Řešení potíží',
    hint: 'Co zkusit, když aplikace přestane reagovat na ťuknutí nebo se obrazovka objeví prázdná.',
    databaseOpen: 'Databáze připojená',
    databaseClosed: 'Databáze nepřipojená',
    failures: (count: number) =>
      count === 0
        ? 'nic neselhalo'
        : `${plural(count, 'zaznamenána', 'zaznamenány', 'zaznamenáno')} ${count} ${plural(count, 'chyba', 'chyby', 'chyb')}`,
    reconnect: 'Připojit databázi znovu',
    survey: 'Zjistit, co se zaseklo',
    reload: 'Načíst aplikaci znovu',
    reconnected: 'Připojeno.',
    stillBroken: 'Pořád nepřipojeno — načti aplikaci znovu.',
    recent: 'Poslední chyby',
    none: 'Na tomto zařízení nic neselhalo.',
    clear: 'Vymazat seznam',
  },
  crash: {
    message: 'Něco se pokazilo — obvykle se to stává po aktualizaci.',
    reload: 'Načíst znovu',
  },
  update: {
    available: 'Je k dispozici nová verze.',
    reload: 'Načíst znovu',
    dismiss: 'Později',
  },
  about: {
    title: 'Rubix',
    what: 'Timer a trenažér na kostku 3×3, zaměřený na metodu CFOP. Provede tě krok za krokem prvním složením, nabídne dril případů F2L, OLL a PLL a měří složení po fázích, aby bylo vidět, kde je potřeba zrychlit.',
    who: 'Je pro každého, kdo je někde mezi první složenou kostkou a rychlým průměrem. Žádný účet, žádné reklamy, a jakmile ji jednou otevřeš, funguje i bez připojení.',
    share: 'Sdílet aplikaci',
    shared: 'Sdíleno.',
    copied: 'Odkaz zkopírován.',
    shareFailed: 'Odkaz se nepodařilo sdílet.',
    dataTitle: 'Tvoje data',
    data: 'Složení, session a nastavení zůstávají na tomto zařízení a nikam se neodesílají. Jediná kopie jinde je záloha, kterou si uděláš.',
    toData: 'Přejít na zálohu',
    analytics:
      'Web počítá zobrazení stránek přes Cloudflare Web Analytics — nesbírá nic o tvých složeních, žádné cookies a nic, podle čeho by šlo rozlišit jedno zařízení od druhého.',
    versionTitle: 'Verze',
    version: (version: string) => `Rubix ${version}`,
    checkUpdates: 'Zkontrolovat aktualizace',
    checking: 'Kontroluji…',
    updateCurrent: 'Toto je poslední verze.',
    updateReady: 'Nová verze je připravená — načti ji z lišty dole.',
    updateOffline: 'Server se nepodařilo kontaktovat. Zkus to znovu online.',
    updateUnavailable:
      'Tady není co aktualizovat: tento prohlížeč načítá poslední verzi pokaždé.',
    contactTitle: 'Kontakt',
    contact: 'Dotaz, chyba nebo nápad:',
    contactIssue: 'S účtem na GitHubu můžeš chybu nahlásit i veřejně:',
    issueLink: 'založit issue',
    source: 'Zdrojový kód je otevřený, pod licencí GPL-3.0:',
    creditsTitle: 'Poděkování',
    creditAlgs: 'Většina algoritmů pochází od J Perm —',
    creditRoux: 'Sady pro Roux pocházejí z listů Kiana Mansoura a komunity Rouxu —',
    creditSpeedcubedb: 'Případy druhého bloku, které v nich chybí, jsou ze SpeedCubeDB —',
    creditZz: 'Průvodce ZZ vychází z tutoriálu týmu ZZMethod.com —',
    creditMethod: 'Metoda pro začátečníky vychází z badmephisto —',
    creditCubing: 'Scramble a 3D kostka jsou cubing.js —',
    creditClaude: 'Vytvořeno společně s Claude Code —',
    creditFonts:
      'Písma Inter, JetBrains Mono a DSEG7, všechna pod licencí SIL Open Font License.',
  },
  installNudge: {
    message:
      'Safari smaže data webu po týdnu bez návštěvy. Přidej si Rubix na plochu a tvoje složení zůstanou.',
    how: 'Ukaž mi jak',
    dismiss: 'Rozumím',
  },
  install: {
    title: 'Instalace',
    hint: 'Nainstalovaná aplikace se otevírá z plochy bez prohlížeče okolo a funguje i úplně bez připojení.',
    action: 'Nainstalovat aplikaci',
    iosTitle: 'Přidat na plochu',
    iosSteps:
      'Na iPhonu a iPadu se to dělá přes nabídku sdílení: ťukni na Sdílet dole v Safari a pak na „Přidat na plochu“. Safari stránce nedovolí nabídnout tlačítko místo toho.',
    iosWhy:
      'Stojí to za to: nainstalované aplikaci dává iPhone mnohem delší paměť než kartě a karta, kterou týden neotevřeš, může o složení přijít. Zálohu si dělej tak jako tak.',
  },
};
