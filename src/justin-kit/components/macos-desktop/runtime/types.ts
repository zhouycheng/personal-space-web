export type DesktopFileKind = "folder" | "html" | "markdown" | "system";

export type DesktopIconVariant = "folder" | "html" | "markdown" | "system";

export type DesktopWindowRenderer = "folder" | "html" | "markdown" | "display-controls";

export type DesktopEntry = {
  id: string;
  title: string;
  kind: DesktopFileKind;
  icon: DesktopIconVariant;
  window: {
    title: string;
    renderer: DesktopWindowRenderer;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    contentUrl?: string;
  };
  children?: DesktopEntry[];
};
