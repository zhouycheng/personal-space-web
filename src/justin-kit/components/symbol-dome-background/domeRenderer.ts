import { LAND, OCEAN, STAR, clamp, landValue, mixRgb, noise, wrap01, type DomePoint } from "./domeModel";

type DomeFrameState = {
  width: number;
  height: number;
  rotation: number;
  lookX: number;
  lookY: number;
  pointerX: number;
  pointerY: number;
  hasPointer: boolean;
  pointerInside: boolean;
};

export function drawDomeFrame(
  ctx: CanvasRenderingContext2D,
  points: readonly DomePoint[],
  state: DomeFrameState,
  now: number,
  elapsed: number,
  reducedMotion: boolean,
) {
  const { width, height, pointerX, pointerY, hasPointer, pointerInside } = state;
  let { rotation, lookX, lookY } = state;
  const radiusX = Math.min(width * 0.43, height * 1.08);
  const radiusY = Math.min(height * 0.74, radiusX * 0.88);
  const cx = width * 0.5;
  const cy = height * 1.03;
  const speed = reducedMotion ? 0 : 0.064;
  rotation = wrap01(rotation + speed * elapsed);

  const targetLookX = hasPointer ? clamp((pointerX - cx) / (radiusX * 1.05), -1, 1) : 0;
  const targetLookY = hasPointer ? clamp((pointerY - (cy - radiusY * 0.48)) / (radiusY * 0.85), -1, 1) : 0;
  lookX += (targetLookX - lookX) * 0.035;
  lookY += (targetLookY - lookY) * 0.035;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  points.forEach((point) => {
    const visibleWidth = Math.sqrt(Math.max(0, 1 - (1 - point.v) * (1 - point.v)));
    const xCurve = point.xNorm * visibleWidth;
    const edgeFade = clamp((1 - Math.abs(point.xNorm)) * 2.5, 0, 1);
    const topFade = clamp((point.v - 0.02) / 0.16, 0.56, 1);
    const rowScale = 0.52 + point.v * 0.62;
    const parallax = Math.sin((point.t + rotation) * Math.PI * 2) * 4.6 * visibleWidth;
    const faceWeight = clamp((1 - Math.abs(point.xNorm) * 0.78) * (0.45 + point.v * 0.55), 0, 1);
    const lookOffsetX = lookX * radiusX * 0.055 * faceWeight;
    const lookOffsetY = lookY * radiusY * 0.035 * faceWeight;
    const x = cx + xCurve * radiusX + point.jitterX * 8 + parallax + lookOffsetX;
    const y = cy - radiusY + point.v * radiusY + point.jitterY * 8 + lookOffsetY;

    if (x < -36 || x > width + 36 || y < -36 || y > height + 36) {
      return;
    }

    const surfaceU = wrap01(point.t - rotation);
    const surfaceV = point.v;
    const land = landValue(surfaceU, surfaceV);
    const landThreshold = 0.36;
    const isLand = surfaceV > 0.22 && land > landThreshold;
    const glyph = isLand ? "#" : point.glyphPick > 0.52 ? "%" : "x";
    const localNoise = noise(surfaceU + 0.13, surfaceV + 0.27);
    const pointerDistance = Math.hypot(x - pointerX, y - pointerY);
    const hover = pointerInside ? clamp(1 - pointerDistance / 118, 0, 1) : 0;
    const fontSize = (5.8 + rowScale * 4.75) * (1 - hover * 0.34);
    const oceanFlicker = isLand ? 0 : Math.sin(now * 0.0014 + point.wave + surfaceU * 9) * 0.035;
    const landAlpha = 0.54 + localNoise * 0.12 + Math.max(0, land - landThreshold) * 0.18;
    const oceanAlpha = 0.15 + localNoise * 0.12 + oceanFlicker;
    const alpha = (isLand ? landAlpha : oceanAlpha) * edgeFade * topFade * point.base * (1 - hover * 0.45);
    const color = mixRgb(isLand ? LAND : OCEAN, STAR, hover * 0.42);

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0.015, 0.68);
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.font = `780 ${fontSize.toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(glyph, x, y);
    ctx.restore();
  });
  return { rotation, lookX, lookY };
}
