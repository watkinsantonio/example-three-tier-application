/**
 * Links shown under the planner. Pure data, no fetching.
 *
 * Research status: the build sandbox could reach GitHub, npm and PyPI only.
 * The organisation sites below were NOT opened from the sandbox, so the URLs
 * and descriptions come from general knowledge and must be re-checked before
 * the page is relied on. The GitHub projects were checked via the GitHub API.
 */

export interface Resource {
  name: string;
  url: string;
  /** What the link is for, in plain words. */
  purpose: string;
}

export const GIVE_RESOURCES: Resource[] = [
  {
    name: 'GiveWell',
    url: 'https://www.givewell.org',
    purpose: 'Independent research on which charities have strong evidence of cost-effectiveness.',
  },
  {
    name: 'World Food Programme',
    url: 'https://www.wfp.org',
    purpose: 'UN agency delivering food assistance in emergencies and to people facing hunger.',
  },
  {
    name: 'UNICEF',
    url: 'https://www.unicef.org',
    purpose: 'UN agency working on child nutrition and survival, including in crises.',
  },
  {
    name: 'ICRC',
    url: 'https://www.icrc.org',
    purpose: 'Neutral humanitarian organisation working in armed conflict, including food and water aid.',
  },
];

export const FIND_HELP_RESOURCES: Resource[] = [
  {
    name: 'Feeding America',
    url: 'https://www.feedingamerica.org',
    purpose: 'US network of food banks. Its site lists local food banks and pantries.',
  },
  {
    name: 'Global FoodBanking Network',
    url: 'https://www.foodbanking.org',
    purpose: 'Network of food banks worldwide, with a directory of member food banks.',
  },
  {
    name: '211',
    url: 'https://www.211.org',
    purpose: 'US and Canada referral line for local help, including food assistance.',
  },
];

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
    purpose: 'Open-source food bank locator for the UK: addresses, contacts and needed items.',
  },
];
