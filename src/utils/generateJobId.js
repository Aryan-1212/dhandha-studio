/**
 * Job ID Generator
 * -----------------
 * Produces a UUID v4 string to be used as a unique job identifier.
 */

import { v4 as uuidv4 } from 'uuid';

export const generateJobId = () => uuidv4();

export default generateJobId;
