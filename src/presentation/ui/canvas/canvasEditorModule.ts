import flowCss from '@xyflow/react/dist/style.css?url';
const canvasCss=new URL('./mine-canvas.css',import.meta.url).href;

const styles=new Map<string,Promise<void>>();
function loadStyles() {
  return Promise.all([flowCss,canvasCss].map(href=>{
    const existing=styles.get(href);if(existing)return existing;
    const loaded=new Promise<void>((resolve,reject)=>{
      const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.canvasStyle='';
      link.onload=()=>resolve();link.onerror=()=>{link.remove();reject(new Error('Canvas styles could not be loaded'));};
      document.head.append(link);
    }).catch(error=>{styles.delete(href);throw error;});
    styles.set(href,loaded);return loaded;
  }));
}

/** URLs prevent Astro from hoisting this route's CSS into every shell response. */
export async function loadCanvasEditor() {
  const [module]=await Promise.all([import('./MineCanvasEditor'),loadStyles()]);
  return module;
}
