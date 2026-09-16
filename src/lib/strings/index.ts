/**
 * The copy, in the language this device is set to. Picked once, at import
 * time: every module that names a string reads it while it is being loaded,
 * which is also why changing the language reloads the app.
 */

import { currentLanguage } from '../language';
import { cs } from './cs';
import { en, type Strings } from './en';

export type { Strings };
export { packLabel } from './pack-names';

export const strings: Strings = currentLanguage() === 'cs' ? cs : en;
