import type { SiteIdentity } from '../../contracts/content';

export function pageTitle(site: SiteIdentity, page?: string) {
  return page ? site.pageTitleTemplate.replaceAll('{brand}', site.brand).replaceAll('{page}', page) : site.brand;
}
export function articleTitle(site: SiteIdentity, article: string) {
  return site.articleTitleTemplate.replaceAll('{article}', article).replaceAll('{journal}', site.journalTitle);
}
