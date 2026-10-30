/**
 * Links shown under the planner. Pure data, no fetching.
 *
 * Only links that were checked are listed. The build sandbox could reach GitHub,
 * npm and PyPI only, so organisation sites (food banks, aid agencies, donation
 * pages) could not be opened and are deliberately left out until someone checks
 * them. The GitHub projects below were checked via the GitHub API.
 */

export interface Resource {
  name: string;
  url: string;
  /** What the link is for, in plain words. */
  purpose: string;
}

export const OPEN_SOURCE_TOOLS: Resource[] = [
  {
    name: 'freeCodeCamp pantry-for-good',
    url: 'https://github.com/freeCodeCamp/pantry-for-good',
    purpose:
      'Open-source food bank logistics and inventory tool. The repository is archived (read-only) and was last pushed in 2019, so it may be out of date.',
  },
  {
    name: 'chrisvjs/food-bank-locator',
    url: 'https://github.com/chrisvjs/food-bank-locator',
    purpose: 'Open-source app for finding food banks in the UK: addresses, contacts and needed items.',
  },
];
