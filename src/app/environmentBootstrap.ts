import { environmentAt } from '../config/studioTime';
import { readObservation } from '../infrastructure/client/observation';

// Bundled as a small synchronous head script: no scene, UI or location request.
const initial=environmentAt(new Date(),readObservation());
document.documentElement.style.setProperty('--environment-background',initial.lighting.background);
document.documentElement.style.setProperty('--environment-foreground',initial.lighting.foreground);
