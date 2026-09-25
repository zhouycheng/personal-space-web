export function createDesktopContentRenderer(context) {
  const { makeFileIcon, openWindow, ICON_SIZE_RANGE, LABEL_SIZE_RANGE, DEFAULT_VIEW_SETTINGS, applyViewSettings, flushViewSettingsSave, clampNumber } = context;
  async function renderWindowContent(state) {
    const entry = state.entry;
    state.body.className = "macos-window-body";
    state.body.replaceChildren();

    if (entry.window.renderer === "folder") {
      renderFolderWindow(state);
      return;
    }

    if (entry.window.renderer === "display-controls") {
      renderDisplayControlsWindow(state);
      return;
    }

    if (entry.window.renderer === "html" && entry.window.contentUrl) {
      state.body.classList.add("macos-window-body--iframe");
      const iframe = document.createElement("iframe");
      iframe.title = entry.window.title;
      iframe.src = entry.window.contentUrl;
      iframe.loading = "eager";
      state.body.append(iframe);
      return;
    }

    if (entry.window.renderer === "markdown" && entry.window.contentUrl) {
      state.body.classList.add("macos-window-body--markdown");
      const loading = document.createElement("p");
      loading.className = "macos-window-loading";
      loading.textContent = "Loading...";
      state.body.append(loading);

      try {
        const response = await fetch(entry.window.contentUrl);
        if (!response.ok) throw new Error(`Failed to load ${entry.window.contentUrl}`);
        const markdown = await response.text();
        if (!state.el.isConnected) return;
        state.body.replaceChildren(renderTrustedMarkdown(markdown));
      } catch {
        const failed = document.createElement("p");
        failed.className = "macos-window-loading";
        failed.textContent = "Unable to load file.";
        state.body.replaceChildren(failed);
      }
    }
  }

  function renderFolderWindow(state) {
    state.body.classList.add("macos-window-body--folder");
    const grid = document.createElement("div");
    grid.className = "macos-folder-grid";

    (state.entry.children || []).forEach((child) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `macos-folder-item macos-folder-item--${child.icon}`;
      item.dataset.folderEntry = child.id;
      const label = document.createElement("span");
      label.textContent = child.title;
      item.append(makeFileIcon(child), label);
      item.addEventListener("click", () => {
        grid.querySelectorAll(".is-selected").forEach((selected) => selected.classList.remove("is-selected"));
        item.classList.add("is-selected");
      });
      item.addEventListener("dblclick", () => openWindow(child.id));
      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        openWindow(child.id);
      });
      grid.append(item);
    });

    state.body.append(grid);
  }

  function renderDisplayControlsWindow(state) {
    state.body.classList.add("macos-window-body--display-controls");

    const panel = document.createElement("div");
    panel.className = "macos-display-controls";

    const title = document.createElement("h3");
    title.textContent = "桌面显示";

    const hint = document.createElement("p");
    hint.textContent = "调整桌面图标和文字大小。";

    const iconValue = document.createElement("output");
    const labelValue = document.createElement("output");
    const iconRange = makeDisplaySlider({
      label: "图标大小",
      value: context.getViewSettings().iconSize,
      range: ICON_SIZE_RANGE,
      step: 1,
      output: iconValue,
      format: (value) => `${Math.round(value)}px`,
      onInput: (value) => {
        applyViewSettings({ ...context.getViewSettings(), iconSize: value }, { persist: true, relayout: true });
        updateDisplayControlOutputs();
      },
    });
    const labelRange = makeDisplaySlider({
      label: "文字大小",
      value: context.getViewSettings().labelSize,
      range: LABEL_SIZE_RANGE,
      step: 0.5,
      output: labelValue,
      format: (value) => `${value.toFixed(1)}px`,
      onInput: (value) => {
        applyViewSettings({ ...context.getViewSettings(), labelSize: value }, { persist: true, relayout: true });
        updateDisplayControlOutputs();
      },
    });

    function updateDisplayControlOutputs() {
      iconRange.input.value = String(context.getViewSettings().iconSize);
      labelRange.input.value = String(context.getViewSettings().labelSize);
      iconValue.textContent = `${Math.round(context.getViewSettings().iconSize)}px`;
      labelValue.textContent = `${context.getViewSettings().labelSize.toFixed(1)}px`;
    }

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "macos-display-reset";
    resetButton.textContent = "恢复默认";
    resetButton.addEventListener("click", () => {
      applyViewSettings(DEFAULT_VIEW_SETTINGS, { persist: true, relayout: true, animate: true });
      flushViewSettingsSave();
      updateDisplayControlOutputs();
    });

    panel.append(title, hint, iconRange.row, labelRange.row, resetButton);
    state.body.append(panel);
    updateDisplayControlOutputs();
  }

  function makeDisplaySlider(options) {
    const row = document.createElement("label");
    row.className = "macos-display-control-row";

    const header = document.createElement("span");
    header.className = "macos-display-control-header";

    const name = document.createElement("span");
    name.textContent = options.label;
    options.output.textContent = options.format(options.value);
    header.append(name, options.output);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(options.range.min);
    input.max = String(options.range.max);
    input.step = String(options.step);
    input.value = String(options.value);
    input.addEventListener("input", () => {
      const value = clampNumber(input.value, options.range, options.value);
      options.output.textContent = options.format(value);
      options.onInput(value);
    });
    input.addEventListener("change", flushViewSettingsSave);

    row.append(header, input);
    return { row, input };
  }

  function renderTrustedMarkdown(markdown) {
    const article = document.createElement("article");
    article.className = "macos-markdown";
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    let list = null;
    let code = null;

    function flushList() {
      if (!list) return;
      article.append(list);
      list = null;
    }

    function flushCode() {
      if (!code) return;
      article.append(code);
      code = null;
    }

    lines.forEach((line) => {
      if (line.trim().startsWith("```")) {
        if (code) {
          flushCode();
        } else {
          flushList();
          const pre = document.createElement("pre");
          const codeEl = document.createElement("code");
          pre.append(codeEl);
          code = pre;
        }
        return;
      }

      if (code) {
        code.querySelector("code").textContent += `${line}\n`;
        return;
      }

      if (!line.trim()) {
        flushList();
        return;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushList();
        const level = String(Math.min(heading[1].length, 3));
        const element = document.createElement(`h${level}`);
        element.textContent = heading[2];
        article.append(element);
        return;
      }

      const bullet = line.match(/^-\s+(.+)$/);
      if (bullet) {
        if (!list) list = document.createElement("ul");
        const item = document.createElement("li");
        item.textContent = bullet[1];
        list.append(item);
        return;
      }

      const numbered = line.match(/^\d+\.\s+(.+)$/);
      if (numbered) {
        if (!list || list.tagName !== "OL") {
          flushList();
          list = document.createElement("ol");
        }
        const item = document.createElement("li");
        item.textContent = numbered[1];
        list.append(item);
        return;
      }

      flushList();
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      article.append(paragraph);
    });

    flushList();
    flushCode();
    return article;
  }

  return renderWindowContent;
}
