// Selected walnut palette. Notebook and journal materials remain independent.
export const studioPalette = {
  wood: 0x70513c,
  frame: 0x50514c,
  upholstery: 0x8b8272,
  metal: 0xa39275,
  paper: 0xeeeae2,
  box: 0xb6ad9b,
  accent: 0x52614e,
  lamp: 0x52614e,
} as const;

export const paletteHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
