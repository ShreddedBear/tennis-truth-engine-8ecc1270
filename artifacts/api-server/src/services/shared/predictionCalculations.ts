/**
 * Pure calculations shared by the independent Parlay Builder and Prediction
 * Engine.
 *
 * Keep the implementations owned by predictionEngine for now so their public
 * behavior and existing callers remain unchanged.  This neutral barrel is the
 * only dependency Parlay Builder code should use; it also gives us one
 * canonical implementation rather than a second, drifting copy.
 */
export {
  computeSurfaceEloModule,
  type SurfaceEloResult,
} from "../predictionEngine/surfaceElo.js";
export {
  computeServeReturnModule,
  type ServeReturnResult,
} from "../predictionEngine/serveReturn.js";