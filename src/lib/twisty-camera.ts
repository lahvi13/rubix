/**
 * Where the animated cube is looked at from.
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
