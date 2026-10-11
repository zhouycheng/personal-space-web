// Selected walnut palette. Notebook and journal materials remain independent.
export const studioPalette = {
  wood: 0x806049,
  woodEnd: 0x6e513e,
  canvas: 0xeee7d8,
  frame: 0x50514c,
  upholstery: 0x938779,
  metal: 0xa39275,
  paper: 0xeeeae2,
  box: 0xb6ad9b,
  accent: 0x52614e,
  lamp: 0x52614e,
} as const;

export const paletteHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
