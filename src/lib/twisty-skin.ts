/**
 * The reader's skin, on cubing.js's 3D cube.
 *
 * The player has no setting for its colours: they are materials cubing.js
 * builds once, shared by every cube on the page. What it does hand out is the
 * three.js object of the cube it draws (`experimentalCurrentThreeJSPuzzleObject`),
 * and every sticker on it is a mesh whose material can be swapped. So each cube
 * gets materials of its own — one per face, one for the stickers a case greys
 * out, one for the plastic — and those are the ones a skin repaints.
 *
 * cubing.js puts its own materials back whenever the stickering changes, so the
 * cube's `setStickeringMask` is wrapped to lay ours over them again.
 *
 * All of it leans on the inside of cubing.js. What comes back is checked before
 * anything is touched, and a cube that does not look the way this expects is
 * left alone: a version that moved things only costs the reader their colours.
 *
 * The 2×2 is drawn by another class (`PG3D`), which colours its stickers per
 * vertex rather than per material; it is painted further down, by the same
 * rules.
 */

import type { Face } from '../domain/cube/notation';
import { SIDE_SHADE, type CubeSkin } from './cube-skins';

/** As much of three.js as is touched here. */
interface Colour {
  setStyle(style: string, colorSpace?: string): unknown;
}

interface ShaderSource {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
}

interface Material {
  color: Colour;
  transparent: boolean;
  opacity: number;
  visible: boolean;
  clone(): Material;
  onBeforeCompile: (shader: ShaderSource) => void;
}

interface Mesh {
  material: Material;
}

/** As much of cubing.js's `Cube3D` as is touched here. */
interface Cube3D {
  kpuzzleFaceletInfo: Record<string, { faceIdx: number; facelet: Mesh }[][]>;
  experimentalFoundationMeshes: Mesh[];
  options: { experimentalStickeringMask?: unknown };
  setStickeringMask(mask: unknown): void;
  scheduleRenderCallback?: () => void;
}

interface Paint {
  faces: Map<Face, Material>;
  muted: Material;
  foundation: Material | undefined;
  /** A uniform rather than a constant: every cube shares the one program. */
  shadeStrength: { value: number };
}

export interface PaintOptions {
  /**
   * How much of the picture's shading the cube gets: 1 is all of it, 0 none.
   * A cube looked at from below has the face that matters most at the bottom,
   * where the light from above leaves it darkest.
   */
  shadeStrength?: number;
}

/**
 * The face of the skin each of cubing.js's colours stands for, in the order it
 * numbers them (U L F R B D). Its cube is white on top with orange on the left;
 * ours is written down yellow up (`lib/cube-skins.ts`), so the two are matched
 * by colour, not by where the face sits — a sticker keeps its colour wherever
 * the cube is turned.
 */
const SKIN_FACE: readonly Face[] = ['D', 'R', 'F', 'L', 'B', 'U'];

/*
 * cubing.js renders without colour management: what a material holds goes to
 * the screen as it is. Read as sRGB, a hex would be converted on the way in
 * and come out darker than the skin it is from.
 */
const AS_WRITTEN = 'srgb-linear';

const paints = new WeakMap<Cube3D, Paint>();

export function paintCube(cube: unknown, skin: CubeSkin, options: PaintOptions = {}): void {
  if (isPG3D(cube)) {
    paintPG3D(cube, skin, options);
    return;
  }
  if (!isCube3D(cube)) return;
  const paint = paints.get(cube) ?? adopt(cube);
  if (!paint) return;

  paint.shadeStrength.value = options.shadeStrength ?? 1;
  for (const [face, material] of paint.faces) {
    material.color.setStyle(skin.faces[face], AS_WRITTEN);
  }
  paint.muted.color.setStyle(skin.muted, AS_WRITTEN);
  paint.foundation?.color.setStyle(skin.outline, AS_WRITTEN);

  apply(cube, paint);
  cube.scheduleRenderCallback?.();
}

/**
 * The light that shades the still picture, as a function a shader can run.
 *
 * The picture darkens the two sides by fixed factors (`SIDE_SHADE`). Here the
 * brightness of a sticker is a straight line over the way it faces the viewer,
 * pinned so that the three faces the picture shows — looked at from where the
 * player's camera stands (`lib/twisty-view.ts`) — come out exactly as drawn.
 * A turning layer then passes smoothly from one shade to the next.
 */
export function sideLighting(shade: { front: number; right: number }): {
  base: number;
  x: number;
  y: number;
} {
  // How the top and the sides face a viewer at latitude asin(tan 30°),
  // longitude 45°: the top leans towards them by √(2/3), each side away by
  // √(1/6), and the sides lie √½ to either hand.
  const top = Math.sqrt(2 / 3);
  const side = Math.sqrt(1 / 6);
  const y = (1 - (shade.front + shade.right) / 2) / (top + side);
  return {
    base: 1 - top * y,
    x: (shade.right - shade.front) / (2 * Math.SQRT1_2),
    y,
  };
}

const LIGHT = sideLighting(SIDE_SHADE);

/**
 * The same light on a mesh with no normals to read the facing from: the 2×2's
 * stickers are one geometry of loose triangles. Each pixel works its facing
 * out from how its position changes across the screen — a flat sticker gives
 * one answer everywhere on it.
 */
function shadeByScreenFacing(shader: ShaderSource, shadeStrength: { value: number }): void {
  const vertexAnchor = '#include <project_vertex>';
  const fragmentAnchor = '#include <color_fragment>';
  if (!shader.vertexShader.includes(vertexAnchor)) return;
  if (!shader.fragmentShader.includes(fragmentAnchor)) return;

  shader.uniforms.shadeStrength = shadeStrength;
  shader.vertexShader =
    'varying vec3 vSkinPosition;\n' +
    shader.vertexShader.replace(
      vertexAnchor,
      `${vertexAnchor}
      vSkinPosition = mvPosition.xyz;`,
    );
  shader.fragmentShader =
    'uniform float shadeStrength;\nvarying vec3 vSkinPosition;\n' +
    shader.fragmentShader.replace(
      fragmentAnchor,
      `${fragmentAnchor}
      vec3 facing = normalize(cross(dFdx(vSkinPosition), dFdy(vSkinPosition)));
      float lit = ${glsl(LIGHT.base)} + dot(facing.xy, vec2(${glsl(LIGHT.x)}, ${glsl(LIGHT.y)}));
      diffuseColor.rgb *= min(1.0 - shadeStrength * (1.0 - lit), 1.0);`,
    );
}

function shadeByFacing(shader: ShaderSource, shadeStrength: { value: number }): void {
  const vertexAnchor = '#include <project_vertex>';
  const fragmentAnchor = '#include <color_fragment>';
  // A shader without the anchors would compile with the shade never set.
  if (!shader.vertexShader.includes(vertexAnchor)) return;
  if (!shader.fragmentShader.includes(fragmentAnchor)) return;

  shader.uniforms.shadeStrength = shadeStrength;
  // A sticker is a flat square lying along its own z, facing out of the cube.
  shader.vertexShader =
    'uniform float shadeStrength;\nvarying float vShade;\n' +
    shader.vertexShader.replace(
      vertexAnchor,
      `${vertexAnchor}
      vec3 facing = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
      float lit = ${glsl(LIGHT.base)} + dot(facing.xy, vec2(${glsl(LIGHT.x)}, ${glsl(LIGHT.y)}));
      vShade = 1.0 - shadeStrength * (1.0 - lit);`,
    );
  shader.fragmentShader =
    'varying float vShade;\n' +
    shader.fragmentShader.replace(
      fragmentAnchor,
      `${fragmentAnchor}
      diffuseColor.rgb *= min(vShade, 1.0);`,
    );
}

function glsl(value: number): string {
  return value.toFixed(6);
}

function adopt(cube: Cube3D): Paint | null {
  const template = Object.values(cube.kpuzzleFaceletInfo)[0]?.[0]?.[0]?.facelet.material;
  if (!template) return null;

  const shadeStrength = { value: 1 };
  const sticker = (): Material => {
    const material = template.clone();
    material.visible = true;
    material.transparent = false;
    material.opacity = 1;
    material.onBeforeCompile = (shader) => shadeByFacing(shader, shadeStrength);
    return material;
  };

  const plastic = cube.experimentalFoundationMeshes[0]?.material.clone();
  if (plastic) {
    // cubing.js draws the plastic see-through, which on a light card turns
    // grey; the picture draws it in the skin's outline, solid.
    plastic.transparent = false;
    plastic.opacity = 1;
  }

  const paint: Paint = {
    faces: new Map(SKIN_FACE.map((face) => [face, sticker()])),
    muted: sticker(),
    foundation: plastic,
    shadeStrength,
  };

  const setStickeringMask = cube.setStickeringMask.bind(cube);
  cube.setStickeringMask = (mask) => {
    setStickeringMask(mask);
    apply(cube, paint);
  };

  paints.set(cube, paint);
  return paint;
}

/**
 * Lays our materials over the ones cubing.js chose. The stickering decides
 * which: a sticker in play wears its face, a greyed one the muted colour, and
 * anything else cubing.js can do with a sticker is left as it did it.
 */
function apply(cube: Cube3D, paint: Paint): void {
  const mask = cube.options.experimentalStickeringMask;

  for (const [orbit, pieces] of Object.entries(cube.kpuzzleFaceletInfo)) {
    pieces.forEach((facelets, piece) => {
      facelets.forEach(({ faceIdx, facelet }, index) => {
        const role = roleOf(mask, orbit, piece, index);
        const face = SKIN_FACE[faceIdx];
        const material =
          role === 'regular' && face
            ? paint.faces.get(face)
            : role === 'ignored'
              ? paint.muted
              : undefined;
        if (material) facelet.material = material;
      });
    });
  }

  if (paint.foundation) {
    for (const mesh of cube.experimentalFoundationMeshes) mesh.material = paint.foundation;
  }
}

/** What the stickering says about one sticker; no stickering means all in play. */
function roleOf(mask: unknown, orbit: string, piece: number, facelet: number): string {
  const entry = at(at(at(at(at(at(mask, 'orbits'), orbit), 'pieces'), piece), 'facelets'), facelet);
  // cubing.js writes a sticker's part either as a name or as { mask, hintMask }.
  const role = typeof entry === 'string' ? entry : at(entry, 'mask');
  return typeof role === 'string' ? role : 'regular';
}

function at(value: unknown, key: string | number): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

function isCube3D(value: unknown): value is Cube3D {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('kpuzzleFaceletInfo' in value) ||
    !('experimentalFoundationMeshes' in value) ||
    !('setStickeringMask' in value) ||
    !('options' in value)
  ) {
    return false;
  }
  const orbits = value.kpuzzleFaceletInfo;
  if (typeof orbits !== 'object' || orbits === null) return false;
  const facelet = at(at(at(Object.values(orbits)[0], 0), 0), 'facelet');
  const material = at(facelet, 'material');
  return (
    typeof value.setStickeringMask === 'function' &&
    Array.isArray(value.experimentalFoundationMeshes) &&
    typeof at(material, 'clone') === 'function' &&
    typeof at(at(material, 'color'), 'setStyle') === 'function'
  );
}

/* The 2×2: cubing.js's PG3D. */

/** One sticker as PG3D keeps it: the colour it is drawn in, as a number. */
interface StickerDef {
  origColor: number;
}

/** As much of cubing.js's `PG3D` as is touched here. */
interface PG3D {
  stickers: Record<string, StickerDef[][]>;
  materialArray1: Material[];
  materialArray2: Material[];
  params: { stickeringMask?: unknown };
  setStickeringMask(mask: unknown): void;
  updateMaterialArrays(): void;
  scheduleRenderCallback?: () => void;
}

interface PG3DPaint {
  /** The face of the skin each sticker stands for, read once off its first colour. */
  faces: Map<StickerDef, Face>;
  sticker: Material;
  foundation: Material | undefined;
  shadeStrength: { value: number };
  skin: CubeSkin;
  /** The stickering asked for. PG3D is only ever handed one with nothing greyed. */
  mask: unknown;
  setStickeringMask: (mask: unknown) => void;
}

/**
 * PG3D's six colours and the face of the skin each one stands for. Matched by
 * colour, like the 3×3's: its cube is white on top, ours is written down
 * yellow up (`lib/cube-skins.ts`).
 */
const PG3D_FACE = new Map<number, Face>([
  [0xffffff, 'D'],
  [0xf4f400, 'U'],
  [0x44ee00, 'F'],
  [0x2266ff, 'B'],
  [0xff0000, 'L'],
  [0xff8000, 'R'],
]);

const pg3dPaints = new WeakMap<PG3D, PG3DPaint>();

function paintPG3D(cube: PG3D, skin: CubeSkin, options: PaintOptions): void {
  const paint = pg3dPaints.get(cube) ?? adoptPG3D(cube, skin);
  if (!paint) return;

  paint.skin = skin;
  paint.shadeStrength.value = options.shadeStrength ?? 1;
  paint.foundation?.color.setStyle(skin.outline, AS_WRITTEN);
  colourPG3D(cube, paint);
  cube.scheduleRenderCallback?.();
}

function adoptPG3D(cube: PG3D, skin: CubeSkin): PG3DPaint | null {
  const faces = new Map<StickerDef, Face>();
  for (const sticker of allStickers(cube)) {
    const face = PG3D_FACE.get(sticker.origColor);
    // A colour that is not one of the six is a cube this does not know.
    if (face === undefined) return null;
    faces.set(sticker, face);
  }
  const template = cube.materialArray1[0];
  if (!template) return null;

  const shadeStrength = { value: 1 };
  const sticker = template.clone();
  sticker.onBeforeCompile = (shader) => shadeByScreenFacing(shader, shadeStrength);

  // The plastic, where cubing.js draws one: invisible stays invisible.
  const shown = cube.materialArray1[6];
  const foundation = shown?.visible === false ? undefined : shown?.clone();
  if (foundation) {
    foundation.transparent = false;
    foundation.opacity = 1;
  }

  const paint: PG3DPaint = {
    faces,
    sticker,
    foundation,
    shadeStrength,
    skin,
    mask: cube.params.stickeringMask,
    setStickeringMask: cube.setStickeringMask.bind(cube),
  };

  // A new stickering is a new set of colours to lay on.
  cube.setStickeringMask = (mask) => {
    paint.mask = mask;
    colourPG3D(cube, paint);
  };
  // And whatever PG3D puts back into its material lists, ours go over again.
  const updateMaterialArrays = cube.updateMaterialArrays.bind(cube);
  cube.updateMaterialArrays = () => {
    updateMaterialArrays();
    placePG3DMaterials(cube, paint);
  };
  placePG3DMaterials(cube, paint);

  pg3dPaints.set(cube, paint);
  return paint;
}

/**
 * PG3D colours a sticker from its own colour, and greys one out in a fixed
 * dark grey that is no skin's. So the greyed ones are given the skin's muted
 * colour as their own and handed over as ordinary stickers; PG3D then carries
 * every colour along with its piece as the cube turns.
 */
function colourPG3D(cube: PG3D, paint: PG3DPaint): void {
  for (const [orbit, byFacelet] of Object.entries(cube.stickers)) {
    byFacelet.forEach((pieces, facelet) => {
      pieces.forEach((sticker, piece) => {
        const role = roleOf(paint.mask, orbit, piece, facelet);
        const face = paint.faces.get(sticker);
        if (face === undefined) return;
        sticker.origColor = hexOf(role === 'ignored' ? paint.skin.muted : paint.skin.faces[face]);
      });
    });
  }
  paint.setStickeringMask(withoutGrey(cube, paint.mask));
}

/** The stickering with every greyed sticker made an ordinary one, every orbit in it. */
function withoutGrey(cube: PG3D, mask: unknown): unknown {
  const orbits: Record<string, { pieces: { facelets: unknown[] }[] }> = {};
  for (const [orbit, byFacelet] of Object.entries(cube.stickers)) {
    const pieceCount = byFacelet[0]?.length ?? 0;
    orbits[orbit] = {
      pieces: Array.from({ length: pieceCount }, (_, piece) => ({
        facelets: byFacelet.map((_, facelet) => {
          const entry = at(at(at(at(at(at(mask, 'orbits'), orbit), 'pieces'), piece), 'facelets'), facelet);
          const role = roleOf(mask, orbit, piece, facelet);
          if (role === 'ignored') return 'regular';
          return entry === undefined || entry === null ? 'regular' : entry;
        }),
      })),
    };
  }
  return { orbits };
}

function placePG3DMaterials(cube: PG3D, paint: PG3DPaint): void {
  cube.materialArray1[0] = paint.sticker;
  cube.materialArray2[1] = paint.sticker;
  if (paint.foundation && cube.materialArray1[6]?.visible !== false) {
    cube.materialArray1[6] = paint.foundation;
    cube.materialArray2[7] = paint.foundation;
  }
}

function allStickers(cube: PG3D): StickerDef[] {
  return Object.values(cube.stickers).flatMap((byFacelet) => byFacelet.flat());
}

function hexOf(colour: string): number {
  return Number.parseInt(colour.replace('#', '').slice(0, 6), 16);
}

function isPG3D(value: unknown): value is PG3D {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('stickers' in value) ||
    !('materialArray1' in value) ||
    !('materialArray2' in value) ||
    !('params' in value) ||
    !('setStickeringMask' in value) ||
    !('updateMaterialArrays' in value)
  ) {
    return false;
  }
  const first = at(at(at(Object.values(value.stickers ?? {})[0], 0), 0), 'origColor');
  const material = at(value.materialArray1, 0);
  return (
    typeof value.setStickeringMask === 'function' &&
    typeof value.updateMaterialArrays === 'function' &&
    Array.isArray(value.materialArray1) &&
    Array.isArray(value.materialArray2) &&
    typeof first === 'number' &&
    typeof at(material, 'clone') === 'function'
  );
}
