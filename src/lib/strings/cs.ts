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
    phaseTrend: 'Vývoj fází',
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
    emptyTag: 'S tímto tagem zatím žádná složení.',
    solveCount: (count: number) => `${count} složení`,
    averages: 'Průměry',
    current: 'Aktuální',
    best: 'Nejlepší',
    pbSingle: 'PB single',
    sessionBest: 'Rekord session',
    mean: 'Průměr',
    median: 'Medián',
    stdDev: 'Směr. odchylka',
    dnfRate: 'Podíl DNF',
    plusTwoRate: 'Podíl +2',
    distribution: 'Rozložení časů',
    trend: 'Vývoj',
    bySolve: 'Klouzavý ao12',
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
  },
  learn: {
    intro:
      'Sedm kroků od zamíchané kostky ke složené. Rychlejší metoda si cross nechá a zbytek spojí po dvou: z kroků 2 a 3 je F2L, ze 4 a 5 OLL, z 6 a 7 PLL. Obrázky drží kostku tak jako trenažér: cross dole, poslední vrstva nahoře.',
    explanations: 'Vysvětlivky',
    stepsNav: 'Kroky',
    hide: 'Odebrat tohoto průvodce z menu',
    hideHint:
      'Až budeš kostku skládat bez čtení, vyhoď průvodce z menu. V nastavení to můžeš vrátit zpět.',
    source: 'Metoda i pořadí kroků vychází z průvodce pro začátečníky na',
    sourceLink: 'badmephisto.com',
    loading: 'Načítám případy…',
    crossCaption: 'Hotový cross: pod každým středem hrana, která s ním sdílí barvu.',
    showCases: 'Všechny případy',
    hideCases: 'Zpět na jeden algoritmus',
    steps: {
      cross: {
        title: 'Cross',
        text:
          'Cross (kříž) jsou čtyři hrany spodní barvy, v našem případě bílé. Začni s bílým středem otočeným dolů (D).\n\n'
          + 'Bílé hrany je potřeba dostat dolů tak, aby jejich druhá barva souhlasila se středem vedlejší stěny. Žádný algoritmus tu není: vytáhni bílou hranu do horní vrstvy (U), otoč vrškem tak, aby se barevně spárovala se svým středem, a dvěma otočkami boční stěny ji dostaň dolů.\n\n'
          + 'Správně složený cross předpokládají všechny další kroky, takže ho neodbývej — dál se pusť, až ti půjde složit intuitivně.',
      },
      corners: {
        title: 'Rohy spodní vrstvy',
        text:
          'Teď přijdou na řadu čtyři bílé rohy. Každý roh nese tři barvy a patří do mezery mezi ty tři středy, které mají stejné barvy jako on.\n\n'
          + 'Najdi bílý roh v horní vrstvě a otáčej vrškem (U), dokud nestojí přímo nad svou mezerou (slotem). Pak se podívej, kam míří jeho bílá nálepka — doprava, dopředu, nebo nahoru — a použij algoritmus, který k tomu patří. Všechny tři jsou hned pod textem.\n\n'
          + 'Roh, který už dole je, ale je otočený špatně nebo sedí ve špatném slotu, nejdříve vytáhni nahoru: stačí na něj spustit kterýkoli z těch tří algoritmů.',
      },
      middle: {
        title: 'Hrany prostřední vrstvy',
        text:
          'Zbývají čtyři hrany prostřední vrstvy. V horní vrstvě hledej hranu, která nemá na sobě žlutou — každá taková patří doprostřed.\n\n'
          + 'Otoč vrškem (U) tak, aby hrana stála na pravé straně a její boční barva souhlasila s pravým středem. Pak se podívej na barvu, která u ní míří nahoru: ta rozhodne, jestli hrana patří do předního, nebo do zadního slotu. Oba algoritmy jsou pod textem.\n\n'
          + 'Hranu, která už v prostřední vrstvě je, ale je otočená obráceně nebo sedí ve špatném slotu, nejdříve dostaň nahoru: drž kostku tak, aby byl tento slot vpravo, a spusť kterýkoli z obou algoritmů.\n\n'
          + 'Tím jsou hotové první dvě vrstvy — kroky 2 a 3 dohromady jsou to, čemu se říká F2L. Rychlejší metoda je spojí do jednoho a v Trenažéru ji najdeš pod stejnou zkratkou.',
      },
      edgeOrientation: {
        title: 'Cross poslední vrstvy',
        text:
          'Spodní dvě vrstvy jsou hotové a od teď se sahá jen na tu horní. Nejdřív přijde žlutý cross — a záleží jen na tom, kde je žlutá, ne na tom, jestli jsou díly na svých místech.\n\n'
          + 'Podívej se na žluté nálepky nahoře a najdi mezi obrázky pod textem ten svůj: čáru (I), L, nebo samotnou tečku (Dot). Drž kostku tak, jak ukazuje obrázek, a spusť algoritmus pod ním. U tečky se spustí oba po sobě, přesně jak je to tam napsané.\n\n'
          + 'Malé f v druhém algoritmu není překlep. Velké F otočí jen přední stěnu, malé f otočí přední stěnu i prostřední vrstvu za ní — dvě vrstvy najednou. Celou notaci najdeš pod tlačítkem Notace nahoře.',
      },
      cornerOrientation: {
        title: 'Orientace poslední vrstvy',
        text:
          'Zbývá celá horní stěna a stačí na ni jediný algoritmus. Spusť ho, podívej se znovu a spusť ho případně zase — více než třikrát ho nepotřebuješ nikdy.\n\n'
          + 'Jak kostku držet, poznáš podle toho, kolik rohů už ukazuje žlutou; všechny tři možnosti jsou na obrázcích pod textem. Pod tlačítkem je pak sedm případů, každý na jedno spuštění.\n\n'
          + 'Kroky 4 a 5 dohromady jsou OLL — orientace poslední vrstvy. Dělají se na dvakrát, a tak je v Trenažéru najdeš pod 2-Look OLL.',
      },
      cornerPermutation: {
        title: 'Prohození rohů',
        text:
          'Žlutá stěna je hotová, ale díly ještě nejsou na svých místech. Teď je tam dostaneš, nejdříve rohy.\n\n'
          + 'Prohlédni si kostku ze všech stran a hledej headlights (světla) — dva rohy, které ukazují stejnou barvu. Natoč celou kostku tak, aby světla byla vzadu, jak ukazují obrázky pod textem. Hrany zůstanou přesně tam, kde jsou.',
      },
      edgePermutation: {
        title: 'Prohození hran',
        text:
          'Zbývají hrany. Otáčej vrškem (U), dokud není jedna strana celá v jedné barvě — ta je hotová. Natoč pak celou kostku tak, aby tato strana byla vzadu, a zbylé tři hrany se protočí kolem ní.\n\n'
          + 'Žádný roh se přitom nehne. Až se protočí poslední hrana, kostka je složená.\n\n'
          + 'Kroky 6 a 7 dohromady jsou PLL — permutace poslední vrstvy, tedy rozmístění dílů na správná místa. V Trenažéru jsou pod 2-Look PLL.',
      },
    },
    holds: {
      oneOriented:
        'Jeden roh už ukazuje žlutou: dej ho dopředu doleva. Tímto případem algoritmus sám končí.',
      twoOriented:
        'Dva rohy už ukazují žlutou: otoč vrškem tak, aby žlutá nálepka předního levého rohu mířila na tebe.',
      noneOriented:
        'Žlutou zatím neukazuje žádný roh: otoč vrškem tak, aby žlutá nálepka předního levého rohu mířila doleva.',
      headlights: 'Headlights vzadu: zbylé tři rohy se protočí na svá místa.',
      noHeadlights:
        'Žádné headlights na žádné straně: spusť algoritmus z libovolného úhlu a nějaké se objeví.',
      oneSide: 'Hotová strana vzadu: zbylé tři hrany se protočí.',
      noSide:
        'Žádná strana není jednobarevná: spusť algoritmus z libovolného úhlu a jedna se objeví.',
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
    timer: 'Timer',
    holdThreshold: 'Podržení pro start',
    holdOff: 'Vypnuto',
    showScramblePreview: 'Zobrazit náhled kostky pod scramblem',
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
      'Zapíše všechny session, složení, tagy a nastavení do jednoho souboru. Nastavení, která patří tomuto zařízení, jako motiv a velikost textu, zůstanou zde.',
    exportAction: 'Exportovat data',
    exportFailed: 'Data se nepodařilo exportovat',
    exportCsvAction: 'Složení jako CSV',
    exportCsvHint:
      'Jeden řádek na složení — čas, penalizace, scramble, fáze — pro tabulkový editor. Zpátky soubor nic nepřečte, je to pouze kopie na prohlížení, ne záloha.',
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
    importTitle: 'Obnovení',
    importHint: 'Vyber exportovaný soubor. Než potvrdíš náhled, nic se nezapíše.',
    chooseFile: 'Vybrat soubor',
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
    title: 'Z csTimeru',
    hint: 'Přijme export z csTimeru: JSON z Export/Import (csTimer ho pojmenuje .txt) nebo jednu session exportovanou jako CSV. Každá session z csTimeru dorazí jako samostatná session — do té, do které měříš, se nic nepřimíchá.',
    chooseFile: 'Vybrat soubor z csTimeru',
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
    scope: 'Zatím jen 3×3 — žádné jiné hlavolamy.',
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
