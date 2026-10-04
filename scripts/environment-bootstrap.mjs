import { build } from 'rolldown';
import { fileURLToPath } from 'node:url';

/** Bundle the same time/storage model for the parser's first paint, not a second clock model. */
export default function environmentBootstrap() {
  return {
    name:'justin-environment-bootstrap',
    resolveId(id){if(id==='virtual:environment-bootstrap')return '\0'+id;},
    async load(id){
      if(id!=='\0virtual:environment-bootstrap')return;
      const result=await build({input:fileURLToPath(new URL('../src/app/environmentBootstrap.ts',import.meta.url)),
        output:{format:'iife',minify:true},write:false});
      const chunk=result.output.find(item=>item.type==='chunk');
      for(const path of Object.keys(chunk.modules))this.addWatchFile(path);
      return `export default ${JSON.stringify(chunk.code.replaceAll('</script','<\\/script'))}`;
    },
  };
}
