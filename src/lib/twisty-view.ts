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
 * The one thing it cannot fix is which side is which colour. Our palette puts
 * red on the right of a yellow-up cube where a real one has orange, and no
 * rotation turns a cube into its own mirror image.
 */
export const CUBE_ORIENTATION = 'z2';
