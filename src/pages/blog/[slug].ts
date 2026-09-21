import type { APIRoute } from "astro";
import { journal, articlePath } from "../../server/journal";
export const GET:APIRoute=({params,redirect})=>journal.articles.some(a=>a.slug===params.slug)?redirect(articlePath(params.slug!),301):new Response("Not found",{status:404});
