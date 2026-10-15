// The core manager universe: the top 100 of the Thinking Ahead Institute / Pensions & Investments
// 500 ranking (2023 edition, total assets in USD million at end-2022), as James asked on 15 Oct 2026.
//
// The ranking lists groups; the product tracks the houses that publish. So each row says what we do
// with it:
//   wave 1   – tracked from the start (English-language thought leadership of real volume)
//   wave 2   – tracked once wave 1 is stable (regional, smaller output, or mainly non-English)
//   merged   – now part of another group in this list; tracked under that group
//   excluded – no meaningful public thought leadership of its own (index-only managers, banks and
//              insurers managing in-house money, mainly Chinese- or Japanese-language publishers)
// Exclusions are proposals for James to confirm at the weekly check-in, not settled decisions.

export type RosterStatus = 'wave 1' | 'wave 2' | 'merged' | 'excluded'

export interface RosterRow {
  rank: number | null          // null = outside the top 100, kept by decision
  group: string                // as named in the ranking
  market: string
  aum_musd: number | null
  status: RosterStatus
  /** Manager ids (lib/sources.ts) of the houses tracked for this group */
  houses: string[]
  note?: string
}

export const RANKING = 'TAI / P&I 500, 2023 edition (end-2022 assets)'

export const ROSTER: RosterRow[] = [
  { rank: 1, group: 'BlackRock', market: 'U.S.', aum_musd: 8594488, status: 'wave 1', houses: ['blackrock'] },
  { rank: 2, group: 'Vanguard Group', market: 'U.S.', aum_musd: 7252612, status: 'wave 1', houses: ['vanguard'] },
  { rank: 3, group: 'Fidelity Investments', market: 'U.S.', aum_musd: 3655574, status: 'wave 1', houses: ['fidelity-us'] },
  { rank: 4, group: 'State Street Global', market: 'U.S.', aum_musd: 3481473, status: 'wave 1', houses: ['ssga'] },
  { rank: 5, group: 'J.P. Morgan Chase', market: 'U.S.', aum_musd: 2766000, status: 'wave 1', houses: ['jpmam'] },
  { rank: 6, group: 'Goldman Sachs Group', market: 'U.S.', aum_musd: 2547000, status: 'wave 1', houses: ['gsam'] },
  { rank: 7, group: 'Allianz Group', market: 'Germany', aum_musd: 2285496, status: 'wave 1', houses: ['pimco', 'allianzgi'], note: 'Two houses: PIMCO and Allianz Global Investors.' },
  { rank: 8, group: 'Capital Group', market: 'U.S.', aum_musd: 2175965, status: 'wave 1', houses: ['capital-group'] },
  { rank: 9, group: 'Amundi', market: 'France', aum_musd: 2031753, status: 'wave 1', houses: ['amundi'] },
  { rank: 10, group: 'UBS', market: 'Switzerland', aum_musd: 1845000, status: 'wave 1', houses: ['ubs-am'], note: 'UBS Asset Management. Credit Suisse (rank 53) is now part of UBS.' },
  { rank: 11, group: 'BNY Mellon', market: 'U.S.', aum_musd: 1836032, status: 'wave 1', houses: ['bny', 'insight', 'newton'], note: 'BNY Investments plus its two big publishing boutiques, Insight and Newton.' },
  { rank: 12, group: 'Legal & General Group', market: 'U.K.', aum_musd: 1444393, status: 'wave 1', houses: ['lgam'] },
  { rank: 13, group: 'Invesco', market: 'U.S.', aum_musd: 1409204, status: 'wave 1', houses: ['invesco'] },
  { rank: 14, group: 'Franklin Templeton', market: 'U.S.', aum_musd: 1387686, status: 'wave 1', houses: ['franklin'], note: 'Franklin Templeton Institute; specialist managers (Western Asset, ClearBridge, Brandywine) publish under its site.' },
  { rank: 15, group: 'Prudential Financial', market: 'U.S.', aum_musd: 1377417, status: 'wave 1', houses: ['pgim'] },
  { rank: 16, group: 'T. Rowe Price Group', market: 'U.S.', aum_musd: 1274700, status: 'wave 1', houses: ['troweprice'] },
  { rank: 17, group: 'BNP Paribas', market: 'France', aum_musd: 1269246, status: 'wave 1', houses: ['bnppam'], note: 'Includes AXA Investment Managers (rank 24), bought by BNP Paribas; check whether AXA IM still publishes on its own site.' },
  { rank: 18, group: 'Northern Trust', market: 'U.S.', aum_musd: 1249500, status: 'wave 1', houses: ['ntam'] },
  { rank: 19, group: 'Morgan Stanley Inv. Mgmt.', market: 'U.S.', aum_musd: 1234226, status: 'wave 1', houses: ['msim'] },
  { rank: 20, group: 'Natixis Investment Managers', market: 'France', aum_musd: 1151280, status: 'wave 1', houses: ['natixis', 'loomis'], note: 'Natixis IM plus Loomis Sayles, its largest publishing affiliate.' },
  { rank: 21, group: 'Wellington Mgmt.', market: 'U.S.', aum_musd: 1149360, status: 'wave 1', houses: ['wellington'] },
  { rank: 22, group: 'Nuveen', market: 'U.S.', aum_musd: 1090174, status: 'wave 1', houses: ['nuveen'] },
  { rank: 23, group: 'HSBC Holdings', market: 'U.K.', aum_musd: 1087000, status: 'wave 1', houses: ['hsbc-am'] },
  { rank: 24, group: 'AXA Group', market: 'France', aum_musd: 995407, status: 'merged', houses: ['bnppam'], note: 'AXA IM now belongs to BNP Paribas (rank 17).' },
  { rank: 25, group: 'Sun Life Financial', market: 'Canada', aum_musd: 978776, status: 'wave 1', houses: ['mfs'], note: 'MFS, its publishing house.' },
  { rank: 26, group: 'Ameriprise Financial', market: 'U.S.', aum_musd: 956300, status: 'wave 1', houses: ['columbia-threadneedle'] },
  { rank: 27, group: 'Power Financial', market: 'Canada', aum_musd: 917607, status: 'wave 2', houses: ['mackenzie'], note: 'Mackenzie Investments (Canada). Putnam was sold to Franklin Templeton.' },
  { rank: 28, group: 'Schroders', market: 'U.K.', aum_musd: 887227, status: 'wave 1', houses: ['schroders'] },
  { rank: 29, group: 'Deutsche Bank', market: 'Germany', aum_musd: 876789, status: 'wave 1', houses: ['dws'] },
  { rank: 30, group: 'Geode Capital Mgmt.', market: 'U.S.', aum_musd: 866352, status: 'excluded', houses: [], note: 'Index sub-adviser; publishes no thought leadership.' },
  { rank: 31, group: 'Sumitomo Mitsui Trust Holdings', market: 'Japan', aum_musd: 855024, status: 'wave 2', houses: ['amova'], note: 'Its international house (formerly Nikko AM) publishes in English.' },
  { rank: 32, group: 'Manulife', market: 'Canada', aum_musd: 844776, status: 'wave 1', houses: ['manulife-im'] },
  { rank: 33, group: 'Aegon Group', market: 'Netherlands', aum_musd: 797852, status: 'wave 1', houses: ['aegon-am'] },
  { rank: 34, group: 'Brookfield Asset Mgmt.', market: 'Canada', aum_musd: 790000, status: 'wave 1', houses: ['brookfield'] },
  { rank: 35, group: 'Charles Schwab Investment', market: 'U.S.', aum_musd: 757647, status: 'wave 1', houses: ['schwab'], note: 'Mostly broker and retail commentary; tag channel as retail.' },
  { rank: 36, group: 'Royal Bank of Canada', market: 'Canada', aum_musd: 737999, status: 'wave 1', houses: ['rbc-gam'], note: 'RBC Global Asset Management, including BlueBay.' },
  { rank: 37, group: 'Mitsubishi UFJ Financial Group', market: 'Japan', aum_musd: 728633, status: 'wave 2', houses: ['first-sentier'], note: 'First Sentier Investors, its English-language house.' },
  { rank: 38, group: 'Postal Savings Bank of China', market: 'China', aum_musd: 715966, status: 'excluded', houses: [], note: 'Bank; no public investment thought leadership in English.' },
  { rank: 39, group: 'Federated Hermes', market: 'U.S.', aum_musd: 668901, status: 'wave 1', houses: ['federated-hermes'] },
  { rank: 40, group: 'Fidelity International', market: 'U.K.', aum_musd: 663100, status: 'wave 1', houses: ['fidelity-intl'] },
  { rank: 41, group: 'New York Life Investments', market: 'U.S.', aum_musd: 653638, status: 'wave 1', houses: ['nyli'] },
  { rank: 42, group: 'Affiliated Managers Group', market: 'U.S.', aum_musd: 650800, status: 'excluded', houses: [], note: 'Holding company; its affiliates publish separately. Add named affiliates if wanted.' },
  { rank: 43, group: 'AllianceBernstein', market: 'U.S.', aum_musd: 646400, status: 'wave 1', houses: ['alliancebernstein'] },
  { rank: 44, group: 'Nippon Life Insurance', market: 'Japan', aum_musd: 642528, status: 'excluded', houses: [], note: 'Insurer; little public thought leadership in English.' },
  { rank: 45, group: 'Principal Financial', market: 'U.S.', aum_musd: 635300, status: 'wave 1', houses: ['principal-am'] },
  { rank: 46, group: 'Dimensional Fund Advisors', market: 'U.S.', aum_musd: 583714, status: 'wave 1', houses: ['dimensional'] },
  { rank: 47, group: 'MetLife Investment Mgmt.', market: 'U.S.', aum_musd: 579837, status: 'wave 1', houses: ['metlife-im'] },
  { rank: 48, group: 'Macquarie Group', market: 'Australia', aum_musd: 542791, status: 'wave 1', houses: ['macquarie-am'] },
  { rank: 49, group: 'Generali Group', market: 'Italy', aum_musd: 538762, status: 'wave 1', houses: ['generali-investments'] },
  { rank: 50, group: 'Dai-ichi Life Holdings', market: 'Japan', aum_musd: 538289, status: 'excluded', houses: [], note: 'Insurer; its asset management is through Asset Management One (rank 57).' },
  { rank: 51, group: 'Ping An Bank', market: 'China', aum_musd: 517931, status: 'excluded', houses: [], note: 'Bank; no public investment thought leadership in English.' },
  { rank: 52, group: 'KKR', market: 'U.S.', aum_musd: 503897, status: 'wave 1', houses: ['kkr'] },
  { rank: 53, group: 'Credit Suisse', market: 'Switzerland', aum_musd: 477259, status: 'merged', houses: ['ubs-am'], note: 'Now part of UBS (rank 10).' },
  { rank: 54, group: 'Nomura Asset Mgmt.', market: 'Japan', aum_musd: 468829, status: 'wave 2', houses: ['nomura-am'] },
  { rank: 55, group: 'MassMutual', market: 'U.S.', aum_musd: 466000, status: 'wave 1', houses: ['barings'], note: 'Barings, its publishing house.' },
  { rank: 56, group: 'Allspring Global Investments', market: 'U.S.', aum_musd: 464898, status: 'wave 1', houses: ['allspring'] },
  { rank: 57, group: 'Asset Management One', market: 'Japan', aum_musd: 459526, status: 'wave 2', houses: ['am-one'] },
  { rank: 58, group: 'abrdn', market: 'U.K.', aum_musd: 452400, status: 'wave 1', houses: ['aberdeen'], note: 'Renamed aberdeen.' },
  { rank: 59, group: 'Union Investment', market: 'Germany', aum_musd: 440996, status: 'wave 2', houses: ['union-investment'], note: 'Mainly German-language.' },
  { rank: 60, group: 'Voya Financial', market: 'U.S.', aum_musd: 438964, status: 'wave 1', houses: ['voya-im'] },
  { rank: 61, group: 'Neuberger Berman', market: 'U.S.', aum_musd: 427269, status: 'wave 1', houses: ['neuberger'] },
  { rank: 62, group: 'Zenkyoren', market: 'Japan', aum_musd: 424700, status: 'excluded', houses: [], note: 'Agricultural co-operative insurer; no public thought leadership.' },
  { rank: 63, group: 'Intesa Sanpaolo', market: 'Italy', aum_musd: 414514, status: 'wave 2', houses: ['eurizon'], note: 'Eurizon, its asset manager.' },
  { rank: 64, group: 'LBBW', market: 'Germany', aum_musd: 404763, status: 'excluded', houses: [], note: 'Bank; little public asset-management thought leadership.' },
  { rank: 65, group: 'E Fund Mgmt.', market: 'China', aum_musd: 397881, status: 'excluded', houses: [], note: 'Publishes mainly in Chinese.' },
  { rank: 66, group: 'U.S. Bancorp', market: 'U.S.', aum_musd: 390000, status: 'wave 2', houses: ['us-bank'], note: 'Wealth commentary rather than asset-management research.' },
  { rank: 67, group: 'Nordea', market: 'Denmark', aum_musd: 383122, status: 'wave 1', houses: ['nordea-am'] },
  { rank: 68, group: 'Ares Mgmt.', market: 'U.S.', aum_musd: 351997, status: 'wave 1', houses: ['ares'] },
  { rank: 69, group: 'Mercer', market: 'U.S.', aum_musd: 344915, status: 'wave 1', houses: ['mercer'], note: 'Consultant and OCIO. As a tracked manager it must be left out of the attention index.' },
  { rank: 70, group: 'Meiji Yasuda Life Insurance', market: 'Japan', aum_musd: 329510, status: 'excluded', houses: [], note: 'Insurer; little public thought leadership in English.' },
  { rank: 71, group: 'MEAG', market: 'Germany', aum_musd: 327956, status: 'wave 2', houses: ['meag'], note: "Munich Re's asset manager; limited output." },
  { rank: 72, group: 'TD Asset Mgmt.', market: 'Canada', aum_musd: 326073, status: 'wave 2', houses: ['td-am'] },
  { rank: 73, group: 'Shinkin Central Bank', market: 'Japan', aum_musd: 323492, status: 'excluded', houses: [], note: 'Bank; no public thought leadership.' },
  { rank: 74, group: 'Dodge & Cox', market: 'U.S.', aum_musd: 322933, status: 'wave 1', houses: ['dodge-cox'] },
  { rank: 75, group: 'Agricultural Bank of China', market: 'China', aum_musd: 317636, status: 'excluded', houses: [], note: 'Bank; no public investment thought leadership in English.' },
  { rank: 76, group: 'SEI Investments', market: 'U.S.', aum_musd: 315612, status: 'wave 1', houses: ['sei'] },
  { rank: 77, group: 'Jackson Financial', market: 'U.S.', aum_musd: 290549, status: 'excluded', houses: [], note: 'Insurer (PPM America); little public thought leadership.' },
  { rank: 78, group: 'Janus Henderson Group', market: 'U.K.', aum_musd: 287290, status: 'wave 1', houses: ['janus-henderson'] },
  { rank: 79, group: 'Russell Investments', market: 'U.S.', aum_musd: 276485, status: 'wave 1', houses: ['russell'] },
  { rank: 80, group: 'Banco do Brasil', market: 'Brazil', aum_musd: 274013, status: 'excluded', houses: [], note: 'Bank; publishes mainly in Portuguese.' },
  { rank: 81, group: 'Societe Generale', market: 'France', aum_musd: 273277, status: 'excluded', houses: [], note: 'Sold Lyxor to Amundi; no separate asset-management publishing.' },
  { rank: 82, group: 'Swiss Life Asset Managers', market: 'Switzerland', aum_musd: 270767, status: 'wave 2', houses: ['swiss-life-am'] },
  { rank: 83, group: 'Dekabank Group', market: 'Germany', aum_musd: 270554, status: 'excluded', houses: [], note: 'Mainly German-language retail commentary.' },
  { rank: 84, group: 'Baillie Gifford', market: 'U.K.', aum_musd: 268705, status: 'wave 1', houses: ['baillie-gifford'] },
  { rank: 85, group: 'Harvest Fund Mgmt.', market: 'China', aum_musd: 268275, status: 'excluded', houses: [], note: 'Publishes mainly in Chinese.' },
  { rank: 86, group: 'Aviva', market: 'U.K.', aum_musd: 267766, status: 'wave 1', houses: ['aviva-investors'] },
  { rank: 87, group: 'China Southern Asset Mgmt.', market: 'China', aum_musd: 264000, status: 'excluded', houses: [], note: 'Publishes mainly in Chinese.' },
  { rank: 88, group: 'Prudential', market: 'U.K.', aum_musd: 259800, status: 'wave 2', houses: ['eastspring'], note: 'Eastspring Investments (Asia). M&G demerged in 2019 and is not in this ranking.' },
  { rank: 89, group: 'NISA Investment', market: 'U.S.', aum_musd: 259207, status: 'excluded', houses: [], note: 'Overlay and passive manager; little public thought leadership.' },
  { rank: 90, group: 'China Asset Mgmt.', market: 'China', aum_musd: 256824, status: 'excluded', houses: [], note: 'Publishes mainly in Chinese.' },
  { rank: 91, group: 'Sumitomo Life Insurance', market: 'Japan', aum_musd: 256597, status: 'excluded', houses: [], note: 'Insurer; no public thought leadership in English.' },
  { rank: 92, group: 'ICBC Credit Suisse Asset Mgmt.', market: 'China', aum_musd: 248334, status: 'excluded', houses: [], note: 'Publishes mainly in Chinese.' },
  { rank: 93, group: 'Resona Holdings', market: 'Japan', aum_musd: 241356, status: 'excluded', houses: [], note: 'Bank; no public thought leadership in English.' },
  { rank: 94, group: 'Pictet Asset Mgmt.', market: 'Switzerland', aum_musd: 236705, status: 'wave 1', houses: ['pictet-am'] },
  { rank: 95, group: 'GF Securities', market: 'China', aum_musd: 235116, status: 'excluded', houses: [], note: 'Publishes mainly in Chinese.' },
  { rank: 96, group: 'Samsung Group', market: 'South Korea', aum_musd: 234958, status: 'wave 2', houses: ['samsung-am'] },
  { rank: 97, group: 'Zurich Financial Services', market: 'Switzerland', aum_musd: 231976, status: 'excluded', houses: [], note: 'Insurer managing its own money.' },
  { rank: 98, group: 'Scotiabank', market: 'Canada', aum_musd: 229660, status: 'wave 2', houses: ['1832-am'], note: '1832 Asset Management.' },
  { rank: 99, group: 'Zurcher Kantonalbank', market: 'Switzerland', aum_musd: 225839, status: 'wave 2', houses: ['swisscanto'], note: 'Swisscanto; mainly German-language.' },
  { rank: 100, group: 'BMO Wealth Mgmt.', market: 'Canada', aum_musd: 225498, status: 'wave 2', houses: ['bmo-gam'] },
  // Outside the top 100, added to wave 1 by James (15 Oct 2026). Ranks are from the same ranking where
  // the house appears in it; M&G, Blackstone and Apollo are not in it.
  { rank: null, group: 'AQR', market: 'U.S.', aum_musd: null, status: 'wave 1', houses: ['aqr'], note: 'Outside the ranked list; added by James.' },
  { rank: null, group: 'Bridgewater', market: 'U.S.', aum_musd: null, status: 'wave 1', houses: ['bridgewater'], note: 'Outside the ranked list; added by James.' },
  { rank: null, group: 'M&G', market: 'U.K.', aum_musd: null, status: 'wave 1', houses: ['mandg'], note: 'Not in the ranking; added by James. Includes Bond Vigilantes, which AlphaThreads also reads (see attention-index rule).' },
  { rank: null, group: 'Blackstone', market: 'U.S.', aum_musd: null, status: 'wave 1', houses: ['blackstone'], note: 'Not in the ranking; added by James.' },
  { rank: null, group: 'Apollo', market: 'U.S.', aum_musd: null, status: 'wave 1', houses: ['apollo'], note: 'Not in the ranking; added by James.' },
  { rank: null, group: 'Lazard', market: 'U.S.', aum_musd: 216125, status: 'wave 1', houses: ['lazard'], note: 'Rank 103; added by James.' },
  { rank: null, group: 'Robeco Group', market: 'Netherlands', aum_musd: 182623, status: 'wave 1', houses: ['robeco'], note: 'Rank 115; added by James.' },
  { rank: null, group: 'Royal London Group', market: 'U.K.', aum_musd: 177497, status: 'wave 1', houses: ['rlam'], note: 'Rank 118; added by James.' },
  { rank: null, group: 'Man Group', market: 'U.K.', aum_musd: 143300, status: 'wave 1', houses: ['man-group'], note: 'Rank 139; added by James.' },
  { rank: null, group: 'Ninety One', market: 'South Africa', aum_musd: 159294, status: 'wave 1', houses: ['ninety-one'], note: 'Rank 132; added by James.' },
]
