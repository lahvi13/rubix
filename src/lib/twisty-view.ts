/**
 * How the animated cube is stood and looked at, so that cubing.js shows the
 * same cube our own pictures draw.
 *
 * Where it is looked at from.
 *
 * cubing.js stands its cube at latitude 35, longitude 30 — a couple of degrees
 * of the right face traded for a wider front one, which next to our own
 * pictures reads as a cube turned to the right. Those are drawn as a true
 * isometric (`components/cube-diagram-svg.ts`): front and right equally wide,
 * which is longitude 45, seen from asin(tan 30 degrees) ≈ 35.26 above. The
 * still picture and the cube that replaces it have to be the same cube, so the
 * player is told to stand where the drawing does.
 */
export const CAMERA_LATITUDE = 35.26;
export const CAMERA_LONGITUDE = 45;

/**
 * And how it stands. cubing.js starts a cube white on top; every diagram in
 * the app is drawn the way a cube is actually held — yellow up, the white
 * cross on the bottom — so the player is turned over before the case is set
 * up. A z2 flip is the one that keeps green in front.
 *
 * The algorithm that follows is performed exactly as written: a rotation moves
 * the pieces, not the letters, so R still turns the layer on the right.
 *
 * It leaves the two cubes painted the same, which is the point: our skins are
 * a standard cube written down as it is held here, and cubing.js flipped by z2
 * is that same cube — yellow up, green in front, red on the left and orange on
 * the right. What it cannot match is the reader's chosen skin; the player
 * paints its own colours, which is why the still picture is ours to draw.
 *
 * A set looked at through a rotation of its own (`features/trainer/case-view`)
 * puts that rotation after this one, in front of the setup, and both cubes end
 * up standing the same way round.
 */
export const CUBE_ORIENTATION = 'z2';
