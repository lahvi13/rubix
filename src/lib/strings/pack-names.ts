/**
 * The names carried by the algorithm packs — sets, groups and cases — put into
 * the reader's language at the moment they are drawn.
 *
 * Never in the data. A pack name is an identity: it is the seed's key, it is
 * what `diagramFor` matches a group on, and it is what an export written on
 * one device has to still mean on another. Translating it in the database
 * would break all three, so the rows stay English and this is the last step
 * before the screen.
 *
 * What a Czech reader is better served by in English stays English: the shape
 * names the sport itself uses (Dot, Fish, Sune, Headlights) are what every
 * tutorial and every chart out there says, and a reader who learns them
 * translated cannot follow any of them. What gets translated is the plain
 * description — "Corner in the left slot" teaches nothing in English that it
 * does not teach in Czech.
 */

import { currentLanguage } from '../language';

/* Read once, like the copy itself: this is asked on every card of a set. */
const LANGUAGE = currentLanguage();

const CS: Record<string, string> = {
  // Sets. F2L, OLL, PLL and the 2-Look pair are the same word in both.
  'Beginner': 'Základy',
  'Advanced': 'Pokročilé',
  'Expert': 'Expert',

  // Groups of the beginner set, which are also its steps.
  'Bottom layer corners': 'Rohy spodní vrstvy',
  'Middle layer edges': 'Hrany prostřední vrstvy',
  'Corners home': 'Rohy domů',
  'Edges home': 'Hrany domů',
  'Cross colour on top': 'Barva crossu nahoře',
  'Cross colour on the side': 'Barva crossu na boku',

  // Groups of the 2-Look sets: which look, and what it puts right.
  '1 / Corners': '1 / Rohy',
  '1 / Edges': '1 / Hrany',
  '2 / Corners': '2 / Rohy',
  '2 / Edges': '2 / Hrany',
  '1 / Orientation': '1 / Orientace',
  '2 / Permutation': '2 / Permutace',

  // PLL, grouped by what the case does rather than by its shape.
  'Adjacent corner swap': 'Prohozené sousední rohy',
  'Diagonal corner swap': 'Prohozené protilehlé rohy',
  'Corners correct': 'Rohy na svém místě',
  'Corners only': 'Jen rohy',
  'Edges only': 'Jen hrany',

  // F2L, grouped by where the pair starts.
  'Corner in the left slot': 'Roh v levém slotu',
  'Corner in the opposite slot': 'Roh v protějším slotu',
  'Corner in the right slot': 'Roh v pravém slotu',
  'Corner in the slot': 'Roh ve slotu',
  'Corner is solved': 'Roh je složený',
  'Edge in the slot': 'Hrana ve slotu',
  'Edge in the wrong slot': 'Hrana ve špatném slotu',
  'Pair in the slot': 'Pár ve slotu',
  'Pair in the wrong slot': 'Pár ve špatném slotu',
  'Flipped edge, corner next door': 'Otočená hrana, roh vedle',
  'Other easy cases': 'Další snadné případy',

  // Cases of the beginner set, which are named for what they do.
  'Cross colour front': 'Bílá dopředu',
  'Cross colour right': 'Bílá doprava',
  'Cross colour up': 'Bílá nahoru',
  'Edge to the front': 'Hrana dopředu',
  'Edge to the back': 'Hrana dozadu',
  'One side done': 'Jedna strana hotová',
};

/**
 * Names that are deliberately left in English, listed so that a pack added
 * later cannot slip an untranslated name past the test — silence there would
 * otherwise read the same as a decision.
 */
export const KEPT_IN_ENGLISH: readonly string[] = [
  // Sets and the one group that is a whole step.
  'F2L',
  'OLL',
  'PLL',
  '2-Look OLL',
  '2-Look PLL',
  '2-Look CMLL',
  'CMLL',
  'Cross',
  // OLL shapes, as J Perm and every OLL chart name them.
  'Dot',
  'Square',
  'Lightning',
  'Big lightning',
  'Fish',
  'Awkward',
  'Knight move',
  'C',
  'P',
  'W',
  'T',
  'L',
  'I',
  'U',
  'H',
  'Pi',
  'Sune',
  'Anti-Sune',
  'Bowtie',
  'Headlights',
  // PLL, named by the letter everybody recognises it by.
  'Aa',
  'Ab',
  'E',
  'F',
  'Ga',
  'Gb',
  'Gc',
  'Gd',
  'Ja',
  'Jb',
  'Na',
  'Nb',
  'Ra',
  'Rb',
  'Ua',
  'Ub',
  'V',
  'Y',
  'Z',
  // CMLL, as Kian's sheet names its cases: the corner shape, then how the
  // side colours lie. A shape the 2-Look sets already name is not repeated.
  'O',
  'S',
  'As',
  'O Adjacent Swap',
  'O Diagonal Swap',
  'H Columns',
  'H Rows',
  'H Column',
  'H Row',
  'Pi Right Bar',
  'Pi Back Slash',
  'Pi X Checkerboard',
  'Pi Forward Slash',
  'Pi Columns',
  'Pi Left Bar',
  'U Forward Slash',
  'U Back Slash',
  'U Front Row',
  'U Rows',
  'U X Checkerboard',
  'U Back Row',
  'T Left Bar',
  'T Right Bar',
  'T Rows',
  'T Front Row',
  'T Back Row',
  'T Columns',
  'S Left Bar',
  'S X Checkerboard',
  'S Forward Slash',
  'S Columns',
  'S Right Bar',
  'S Back Slash',
  'As Right Bar',
  'As Columns',
  'As Back Slash',
  'As X Checkerboard',
  'As Forward Slash',
  'As Left Bar',
  'L Mirror',
  'L Inverse',
  'L Pure',
  'L Front Commutator',
  'L Diag',
  'L Back Commutator',
];

/**
 * The name to show. Anything unknown — a numbered case, a name the reader
 * gave a case themselves — comes back as it went in.
 */
export function packLabel(name: string): string {
  return LANGUAGE === 'cs' ? czechName(name) : name;
}

/**
 * A case the pack numbers rather than names: "Advanced 12", "OLL 21", "F2L 3".
 * The word in front is the set's own name, so whether it is translated is the
 * same question as whether that set is — F2L, OLL and PLL are not, and the
 * levels this app invented are.
 */
const NUMBERED = /^(.+) (\d+)$/;

/** Exported for the test; everything else goes through `packLabel`. */
export function czechName(name: string): string {
  const known = CS[name];
  if (known !== undefined) return known;
  const numbered = NUMBERED.exec(name);
  const prefix = numbered?.[1] === undefined ? undefined : CS[numbered[1]];
  return prefix === undefined ? name : `${prefix} ${numbered?.[2] ?? ''}`;
}

/** For the test that walks the packs; nothing else should need the table. */
export const CS_PACK_NAMES = CS;
