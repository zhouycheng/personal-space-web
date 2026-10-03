import { islandAppearance as island } from "../../config/islandAppearance.ts";
import { islandRocks, rockBase, shoreRadius } from '../../config/islandTerrain.ts';
import { islandLeisure } from '../../config/islandLeisure.ts';
import { workspaceAppearance as workspace } from "../../config/workspaceAppearance.ts";
import { palmBounds } from '../../config/islandVegetation.ts';

/** Fit the island envelope and furniture inside an inset viewport. Distance uses
 * the existing orbit vector (sin(angle), sin(elevation), cos(angle)). */
export function islandViewDistance(aspect: number, angle: number, elevation: number, fov = 38) {
  const sy = Math.sin(elevation), norm = Math.hypot(1, sy);
  const sa = Math.sin(angle), ca = Math.cos(angle);
  const vertical = Math.tan(fov * Math.PI / 360) * 0.76;
  const horizontal = Math.tan(fov * Math.PI / 360) * Math.max(0.3, aspect) * 0.8;
  let distance = 0;
  const fit = (x: number, y: number, z: number) => {
    const depth = (sa*x + sy*y + ca*z) / norm;
    const right = ca*x - sa*z, up = (-sa*sy*x + y - ca*sy*z) / norm;
    distance = Math.max(distance, depth + Math.abs(right)/horizontal, depth + Math.abs(up)/vertical);
  };
  for (let i = 0; i < 128; i++) {
    const t = i/128 * Math.PI*2;
    const extent = shoreRadius(t) * 1.035;
    fit(Math.cos(t)*island.radiusX*extent, island.seaLevel-0.35, Math.sin(t)*island.radiusZ*extent);
  }
  const dock=islandLeisure.dock;
  for(const x of [dock.start-.2,dock.end+.2]) for(const z of [dock.z-dock.width*.65,dock.z+dock.width*.65])
    fit(x,dock.deck+.65-.35,z-island.centerZ);
  for(const x of [dock.end-islandLeisure.boat.offsetFromEnd-1.8,dock.end-islandLeisure.boat.offsetFromEnd+1.8])for(const z of [dock.z+.7,dock.z+2.3])
    fit(x,.35,z-island.centerZ);
  for (const x of [-1.8,1.8]) for (const z of [-2.1,0.9]) fit(x,2.5-0.35,z-island.centerZ);
  for (const rock of islandRocks) {
    const extent=Math.hypot(rock.width,rock.depth)*1.16;
    for(const x of [-extent,extent]) for(const z of [-extent,extent])
      fit(rock.x+x,rockBase(rock)+rock.height*1.08-.35,rock.z+z-island.centerZ);
  }
  for(const palm of palmBounds) for(const x of [-palm.radius,palm.radius])
    for(const z of [-palm.radius,palm.radius]) fit(palm.x+x,palm.top-.35,palm.z+z-island.centerZ);
  const roof=workspace.canopy;
  for(const x of [roof.left-.7,roof.right+.7]) for(const z of [roof.back-.7,roof.front+.5]) fit(x,roof.height+.3-.35,z-island.centerZ);
  return distance / norm;
}
