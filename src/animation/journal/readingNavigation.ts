/** A narrow viewport visits both faces of a spread before turning a physical sheet. */
export function readingStep(page:number,count:number,narrow:boolean,direction:1|-1) {
  const next=narrow?page+direction:page-page%2+direction*2;
  if(next<0||next>=count)return undefined;
  return {page:next,panOnly:Math.floor(page/2)===Math.floor(next/2)};
}
