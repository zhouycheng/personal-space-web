export type MineCanvasFont = {
  family: string;
  url: string;
};

const fontModules = import.meta.glob<string>("../../assets/**/*.{ttf,otf,woff,woff2}", {
  eager: true,
  import: "default",
  query: "?url",
});

function familyFromPath(path: string) {
  const fileName = path.split("/").pop() || "";
  return fileName
    .replace(/\.(ttf|otf|woff2?)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export const mineCanvasFonts: MineCanvasFont[] = Object.entries(fontModules)
  .filter(([path]) => path.includes("/fonts/mine-canvas/"))
  .map(([path, url]) => ({
    family: familyFromPath(path),
    url,
  }))
  .filter((font) => font.family.length > 0);
