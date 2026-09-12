// Local clock art direction, not a geolocation-based sunrise calculation.
const periods = [
  { hour: 0, daylight: 0, background: 0x151d2b, sky: 0x172e59, sun: 0xa6bbeb },
  { hour: 5, daylight: 0, background: 0x151d2b, sky: 0x172e59, sun: 0xa6bbeb },
  { hour: 7, daylight: 0.65, background: 0xe5d4c4, sky: 0xd9b5a0, sun: 0xffcd99 },
  { hour: 10, daylight: 1, background: 0xeee9de, sky: 0x9ebcb5, sun: 0xffedce },
  { hour: 16, daylight: 1, background: 0xeee9de, sky: 0x9ebcb5, sun: 0xffedce },
  { hour: 18, daylight: 0.55, background: 0xc9aa99, sky: 0xca937f, sun: 0xffb478 },
  { hour: 21, daylight: 0, background: 0x151d2b, sky: 0x172e59, sun: 0xa6bbeb },
  { hour: 24, daylight: 0, background: 0x151d2b, sky: 0x172e59, sun: 0xa6bbeb },
];

export function studioLighting(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const end = periods.findIndex(period => period.hour > hour);
  const a = periods[end - 1], b = periods[end];
  const t = (hour - a.hour) / (b.hour - a.hour);
  const blend = (from: number, to: number) => [16, 8, 0].reduce((color, shift) =>
    color | Math.round(((from >> shift) & 255) * (1 - t) + ((to >> shift) & 255) * t) << shift, 0);
  const daylight = a.daylight + (b.daylight - a.daylight) * t;
  return {
    daylight,
    background: `#${blend(a.background, b.background).toString(16).padStart(6, "0")}`,
    foreground: daylight < 0.35 ? "#e5e1d8" : "#45453e",
    sky: blend(a.sky, b.sky), sun: blend(a.sun, b.sun),
  };
}
