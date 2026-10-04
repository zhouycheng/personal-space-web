export type RGB = readonly [number, number, number];

export type EntranceTimePalette = {
  background: RGB;
  foreground: RGB;
  mist: RGB;
  mistLight: RGB;
  mistShadow: RGB;
  cloud: RGB;
  titleShadow: RGB;
  progress: RGB;
  progressPending: RGB;
  focus: RGB;
};

const presets: Record<'night' | 'dawn' | 'day' | 'dusk', EntranceTimePalette> = {
  night: {
    background: [22, 30, 46], foreground: [194, 203, 217],
    mist: [35, 47, 67], mistLight: [127, 148, 178], mistShadow: [9, 18, 34],
    cloud: [112, 132, 160], titleShadow: [8, 17, 32],
    progress: [168, 192, 226], progressPending: [133, 150, 177], focus: [150, 177, 216],
  },
  dawn: {
    background: [112, 91, 105], foreground: [250, 226, 211],
    mist: [151, 128, 139], mistLight: [255, 222, 196], mistShadow: [92, 67, 82],
    cloud: [183, 151, 157], titleShadow: [77, 55, 70],
    progress: [255, 220, 190], progressPending: [187, 151, 160], focus: [246, 208, 183],
  },
  day: {
    background: [198, 208, 210], foreground: [101, 122, 128],
    mist: [198, 208, 210], mistLight: [237, 243, 241], mistShadow: [111, 141, 150],
    cloud: [188, 193, 196], titleShadow: [93, 120, 130],
    progress: [99, 123, 130], progressPending: [154, 174, 179], focus: [113, 134, 140],
  },
  dusk: {
    background: [105, 75, 78], foreground: [255, 226, 207],
    mist: [151, 108, 102], mistLight: [255, 214, 174], mistShadow: [88, 48, 55],
    cloud: [190, 143, 128], titleShadow: [81, 45, 51],
    progress: [255, 215, 180], progressPending: [169, 123, 120], focus: [244, 195, 165],
  },
};

const stops: readonly { minute: number; palette: EntranceTimePalette }[] = [
  { minute: 0, palette: presets.night },
  { minute: 4 * 60 + 30, palette: presets.night },
  { minute: 6 * 60 + 30, palette: presets.dawn },
  { minute: 8 * 60 + 30, palette: presets.day },
  { minute: 16 * 60 + 30, palette: presets.day },
  { minute: 18 * 60, palette: presets.dusk },
  { minute: 20 * 60 + 30, palette: presets.dusk },
  { minute: 22 * 60, palette: presets.night },
  { minute: 24 * 60, palette: presets.night },
];

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function mix(from: RGB, to: RGB, progress: number): RGB {
  const channel = (index: 0 | 1 | 2) => Math.round(from[index] + (to[index] - from[index]) * progress);
  return [channel(0), channel(1), channel(2)];
}

/** Interpolate the entrance colors through the visitor's local day. */
export function entranceTimePalette(date = new Date()): EntranceTimePalette {
  const minute = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  let index = 0;
  while (index < stops.length - 2 && minute > stops[index + 1].minute) index++;
  const from = stops[index], to = stops[index + 1];
  const progress = smooth((minute - from.minute) / (to.minute - from.minute));
  return {
    background: mix(from.palette.background, to.palette.background, progress),
    foreground: mix(from.palette.foreground, to.palette.foreground, progress),
    mist: mix(from.palette.mist, to.palette.mist, progress),
    mistLight: mix(from.palette.mistLight, to.palette.mistLight, progress),
    mistShadow: mix(from.palette.mistShadow, to.palette.mistShadow, progress),
    cloud: mix(from.palette.cloud, to.palette.cloud, progress),
    titleShadow: mix(from.palette.titleShadow, to.palette.titleShadow, progress),
    progress: mix(from.palette.progress, to.palette.progress, progress),
    progressPending: mix(from.palette.progressPending, to.palette.progressPending, progress),
    focus: mix(from.palette.focus, to.palette.focus, progress),
  };
}

export function paletteHex(color: RGB): string {
  return `#${color.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

export function paletteRgb(color: RGB): string {
  return `rgb(${color.map(channel => Math.round(channel)).join(', ')})`;
}
