import { prepareJournalContent } from "./journal-content.mjs";

export default function journalIntegration() {
  return { name: "justin-journal", hooks: {
    "astro:build:start": async () => { await prepareJournalContent(); },
    "astro:server:setup": async ({ server }) => {
      await prepareJournalContent();
      let timer, running = Promise.resolve();
      server.watcher.add(["src/content/journal", "public/journal/assets", "public/journal/fonts", "scripts/journal-page.css"]);
      const update = file => {
        if (!/src\/content\/journal\/|public\/journal\/(assets|fonts)\/|scripts\/journal-page\.css$/.test(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => { running = running.catch(() => {}).then(async () => {
          await prepareJournalContent();server.ws.send({ type: "full-reload" });
        }).catch(error => { console.error(error);server.ws.send({type:"error",err:{message:error.message,stack:error.stack}}); }); }, 200);
      };
      server.watcher.on("add", update).on("change", update).on("unlink", update);
      server.httpServer?.once("close", () => { clearTimeout(timer);server.watcher.off("add",update).off("change",update).off("unlink",update); });
    },
  } };
}
