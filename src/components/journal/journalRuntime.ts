import type { StudioScene } from "../studio/studioScene";
import type { JournalManifest, ReadingAnchor, JournalRegion } from "../../features/journal/types";
import type { BookReport } from "./journalBook";
import { journalSlug, resolveReadingPage, spreadFor } from "../../features/journal/book-state";

export function createJournalReader(root:HTMLElement, scene:()=>StudioScene|undefined, navigate:(path:string)=>void) {
  const book=JSON.parse(root.querySelector('[data-journal-manifest]')!.textContent!) as JournalManifest;
  const q=<T extends HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const text=q('[data-journal-text]'),status=q('[data-journal-status]'),directory=q('[data-journal-directory]');
  const image=q<HTMLDialogElement>('[data-journal-image]'),mode=q<HTMLButtonElement>('[data-journal-mode]');
  const events=new AbortController();
  let page=0,active=false,readingText=true,busy=false,single=false,saved:ReadingAnchor|null=null,entryToken=0,pageError='';
  try {saved=JSON.parse(localStorage.getItem('justin-journal-bookmark')??'null');}catch{/* Storage is optional. */}
  function article(){return book.articles.find(a=>a.slug===book.pages[page]?.slug)??book.articles.at(-1);}
  function requestedPage(path:string){
    const url=new URL(path,location.origin),slug=journalSlug(url.pathname);
    let anchor='';try{anchor=decodeURIComponent(url.hash.slice(1));}catch{/* Invalid fragments fall back to the article. */}
    const match=anchor&&book.pages.find(p=>(!slug||p.slug===slug)&&p.anchors.includes(anchor));
    return match?match.index:resolveReadingPage(book,slug,saved);
  }
  function syncText(){
    const selected=article();
    q('[data-journal-title]').textContent=selected?.title??'日记';
    for(const el of root.querySelectorAll<HTMLElement>('[data-journal-prose]'))el.hidden=el.dataset.journalProse!==selected?.slug;
    if(active&&selected)document.title=`${selected.title} — Justin 日记`;
  }
  function update(report:BookReport){
    const previousSlug=book.pages[page]?.slug;
    page=report.page;busy=report.busy;single=report.single;
    pageError=report.error;
    if(active&&!busy&&previousSlug&&book.pages[page]?.slug!==previousSlug){
      history.replaceState(history.state,'',`/journal/${encodeURIComponent(book.pages[page].slug)}`);
    }
    root.classList.toggle('is-turning',busy);
    const visible=spreadFor(page,book.pages.length,single);
    q('output').textContent=visible.map(i=>i+1).join('–')+` / ${book.pages.length}`;
    q<HTMLButtonElement>('[data-journal-prev]').disabled=busy||page===0||readingText;
    q<HTMLButtonElement>('[data-journal-next]').disabled=busy||(visible.at(-1)??0)>=book.pages.length-1||readingText;
    status.hidden=!report.error||readingText;status.textContent=report.error;
    q('[data-journal-retry]').hidden=!report.error;
    syncText();
    if(!busy&&active&&book.pages[page]){
      saved={slug:book.pages[page].slug,anchor:book.pages[page].anchors[0],page};
      try{localStorage.setItem('justin-journal-bookmark',JSON.stringify(saved));}catch{/* Optional storage. */}
    }
  }
  function setMode(value:boolean){
    readingText=value;text.hidden=!value;mode.textContent=value?'立体阅读':'文字阅读';
    q<HTMLButtonElement>('[data-journal-zoom]').disabled=value;
    update({page,single,busy,error:pageError,textures:0});
    if(value){text.focus();const anchor=book.pages[page]?.anchors[0];if(anchor)text.querySelector(`#${CSS.escape(anchor)}`)?.scrollIntoView({block:'start'});}
  }
  function openRegion(item:JournalRegion){
    if(item.kind==='image'){q<HTMLImageElement>('[data-journal-image] > img').src=item.href;q<HTMLImageElement>('[data-journal-image] > img').alt=item.label;q('[data-journal-zoom-pages]').replaceChildren();image.showModal();return;}
    const url=new URL(item.href,location.href);
    if(!['http:','https:','mailto:'].includes(url.protocol))return;
    if(url.origin===location.origin&&url.pathname.startsWith('/journal'))navigate(url.pathname+url.hash);
    else window.open(url.href,'_blank','noopener,noreferrer');
  }
  root.addEventListener('click',event=>{
    if(!(event.target instanceof Element))return;
    const target=event.target.closest<HTMLElement>('button,a');if(!target)return;
    if(target.matches('[data-journal-article]')){
      if(event instanceof MouseEvent&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey))return;
      event.preventDefault();q('#journal-directory').hidden=true;directory.setAttribute('aria-expanded','false');navigate((target as HTMLAnchorElement).pathname);return;
    }
    if(target===directory){const nav=q('#journal-directory');nav.hidden=!nav.hidden;directory.setAttribute('aria-expanded',String(!nav.hidden));}
    if(target.matches('[data-journal-prev]'))scene()?.turnJournal(-1);
    if(target.matches('[data-journal-next]'))scene()?.turnJournal(1);
    if(target.matches('[data-journal-retry]'))scene()?.retryJournal();
    if(target===mode){if(readingText&&!scene()){void enter(location.pathname,0);}else setMode(!readingText);}
    if(target.matches('[data-journal-image-close]'))image.close();
    if(target.matches('[data-journal-zoom]')&&!busy){
      q<HTMLImageElement>('[data-journal-image] > img').removeAttribute('src');
      const images=spreadFor(page,book.pages.length,single).map(i=>{const img=new Image();img.src=book.pages[i].image;img.alt=`第 ${i+1} 页`;return img;});
      q('[data-journal-zoom-pages]').replaceChildren(...images);q('[data-journal-zoom]').setAttribute('aria-expanded','true');image.showModal();
    }
  },{signal:events.signal});
  image.addEventListener('close',()=>q('[data-journal-zoom]').setAttribute('aria-expanded','false'),{signal:events.signal});
  window.addEventListener('keydown',event=>{
    if(!active||readingText||image.open||!q('#journal-directory').hidden||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
    if(['ArrowRight','PageDown','ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();scene()?.turnJournal(event.key==='ArrowRight'||event.key==='PageDown'?1:-1);}
  },{signal:events.signal});
  async function enter(path:string,duration:number){
    const token=++entryToken;active=true;
    page=requestedPage(path);syncText();
    if(!book.pages.length){status.textContent='日记尚未写下第一篇。';setMode(true);return;}
    const current=scene();
    if(!current){fallback();return;}
    setMode(false);root.classList.add('is-entering');
    current.configureJournal(book,page,update,openRegion);
    await current.moveJournal(true,duration);
    if(token!==entryToken||!active)return;
    root.classList.remove('is-entering');
    q<HTMLAnchorElement>('[data-journal-close]').focus();
  }
  function fallback(){root.classList.remove('is-entering');setMode(true);status.hidden=false;status.textContent='三维书本暂不可用，正文仍可阅读。';}
  return {book,enter,fallback,
    select(path:string){page=requestedPage(path);scene()?.setJournalPage(page);syncText();text.scrollTop=0;},
    async leave(duration:number){entryToken++;active=false;image.close();root.classList.add('is-entering');await scene()?.moveJournal(false,duration);root.classList.remove('is-entering');},
    deactivate(){entryToken++;active=false;image.close();scene()?.hideJournal();root.classList.remove('is-entering');},
    dispose(){entryToken++;events.abort();image.close();},
  };
}
