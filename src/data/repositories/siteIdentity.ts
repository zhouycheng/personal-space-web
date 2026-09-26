import identity from '../../content/site/site.json' with { type: 'json' };
import { validateSiteIdentity } from './siteValidation.ts';

export const siteIdentity = validateSiteIdentity(identity);
