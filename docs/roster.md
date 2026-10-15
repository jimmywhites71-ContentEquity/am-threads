# AM Intelligence — manager roster v1

*15 Oct 2026. Source: the top 100 of the Thinking Ahead Institute / Pensions & Investments 500 ranking, 2023 edition (total assets at end-2022, USD), supplied by James. The code copy is `lib/roster.ts`; this doc is generated from it. Exclusions and waves are proposals for James to confirm.*

## How the ranking maps to what we track
The ranking lists **groups**; the product tracks the **houses that publish**. So:
- **Wave 1 — 57 ranked groups, 61 houses, plus AQR and Bridgewater** (outside the top 100, kept from the first roster; confirm). Some groups publish through more than one house: Allianz (PIMCO and Allianz GI), BNY (BNY Investments, Insight, Newton), Natixis (Natixis IM and Loomis Sayles). Some publish under another name: Prudential Financial → PGIM, Sun Life → MFS, Ameriprise → Columbia Threadneedle, MassMutual → Barings.
- **Wave 2 — 16 groups.** Real output but regional, smaller or mainly non-English. Added once wave 1 runs cleanly.
- **Merged — 2.** Credit Suisse is now UBS; AXA IM now belongs to BNP Paribas.
- **Proposed exclusions — 25.** Banks and insurers managing in-house money, an index sub-adviser, a holding company, and Chinese fund firms publishing mainly in Chinese.

**Total: 79 houses** (63 in wave 1, 16 in wave 2).

## Points to decide
1. **The ranking is the 2023 edition** (end-2022 assets). A later edition would reorder the middle of the list; the membership of the top 100 changes little.
2. **Notable houses outside this top 100:** M&G (not in the ranking), Blackstone and Apollo (not ranked by P&I), Lazard (103), Robeco (115), Royal London (118), Man Group (139), Ninety One (132), GMO. Add any you want as named extras.
3. **Mercer is in the top 100** as a consultant and outsourced CIO. As a tracked manager it must be left out of the attention index (and so must any roster house AlphaThreads reads, such as WTW if it is ever added).
4. **AMG's affiliates** (excluded as a holding company) could be added by name.

## Sources and checking
Every house except the first eleven starts with its site's robots.txt, which names its sitemaps; pages are kept when their address looks like insight content. This avoids guessing 68 sitemap addresses. The dry run of discovery, once deployed, reports for each house what it found or why it failed; the weekly check-in fixes the failures, typically by adding a house's own address pattern or switching to its listing page. Region and channel come from each house's own rules where set, otherwise from locale and audience segments in the address (`/uk/en/institutional/` → UK, institutional).

## Wave 1

| Rank | Group (as ranked) | Market | Assets | House(s) tracked | Note |
|---|---|---|---|---|---|
| 1 | BlackRock | U.S. | $8.59tn | BlackRock |  |
| 2 | Vanguard Group | U.S. | $7.25tn | Vanguard |  |
| 3 | Fidelity Investments | U.S. | $3.66tn | Fidelity Investments |  |
| 4 | State Street Global | U.S. | $3.48tn | State Street Global Advisors |  |
| 5 | J.P. Morgan Chase | U.S. | $2.77tn | J.P. Morgan Asset Management |  |
| 6 | Goldman Sachs Group | U.S. | $2.55tn | Goldman Sachs Asset Management |  |
| 7 | Allianz Group | Germany | $2.29tn | PIMCO, Allianz Global Investors | Two houses: PIMCO and Allianz Global Investors. |
| 8 | Capital Group | U.S. | $2.18tn | Capital Group |  |
| 9 | Amundi | France | $2.03tn | Amundi |  |
| 10 | UBS | Switzerland | $1.84tn | UBS Asset Management | UBS Asset Management. Credit Suisse (rank 53) is now part of UBS. |
| 11 | BNY Mellon | U.S. | $1.84tn | BNY Investments, Insight Investment, Newton Investment Management | BNY Investments plus its two big publishing boutiques, Insight and Newton. |
| 12 | Legal & General Group | U.K. | $1.44tn | L&G Asset Management |  |
| 13 | Invesco | U.S. | $1.41tn | Invesco |  |
| 14 | Franklin Templeton | U.S. | $1.39tn | Franklin Templeton | Franklin Templeton Institute; specialist managers (Western Asset, ClearBridge, Brandywine) publish under its site. |
| 15 | Prudential Financial | U.S. | $1.38tn | PGIM |  |
| 16 | T. Rowe Price Group | U.S. | $1.27tn | T. Rowe Price |  |
| 17 | BNP Paribas | France | $1.27tn | BNP Paribas Asset Management | Includes AXA Investment Managers (rank 24), bought by BNP Paribas; check whether AXA IM still publishes on its own site. |
| 18 | Northern Trust | U.S. | $1.25tn | Northern Trust Asset Management |  |
| 19 | Morgan Stanley Inv. Mgmt. | U.S. | $1.23tn | Morgan Stanley Investment Management |  |
| 20 | Natixis Investment Managers | France | $1.15tn | Natixis Investment Managers, Loomis Sayles | Natixis IM plus Loomis Sayles, its largest publishing affiliate. |
| 21 | Wellington Mgmt. | U.S. | $1.15tn | Wellington Management |  |
| 22 | Nuveen | U.S. | $1.09tn | Nuveen |  |
| 23 | HSBC Holdings | U.K. | $1.09tn | HSBC Asset Management |  |
| 25 | Sun Life Financial | Canada | $0.98tn | MFS Investment Management | MFS, its publishing house. |
| 26 | Ameriprise Financial | U.S. | $0.96tn | Columbia Threadneedle Investments |  |
| 28 | Schroders | U.K. | $0.89tn | Schroders |  |
| 29 | Deutsche Bank | Germany | $0.88tn | DWS |  |
| 32 | Manulife | Canada | $0.84tn | Manulife Investment Management |  |
| 33 | Aegon Group | Netherlands | $0.80tn | Aegon Asset Management |  |
| 34 | Brookfield Asset Mgmt. | Canada | $0.79tn | Brookfield Asset Management |  |
| 35 | Charles Schwab Investment | U.S. | $0.76tn | Charles Schwab | Mostly broker and retail commentary; tag channel as retail. |
| 36 | Royal Bank of Canada | Canada | $0.74tn | RBC Global Asset Management | RBC Global Asset Management, including BlueBay. |
| 39 | Federated Hermes | U.S. | $0.67tn | Federated Hermes |  |
| 40 | Fidelity International | U.K. | $0.66tn | Fidelity International |  |
| 41 | New York Life Investments | U.S. | $0.65tn | New York Life Investments |  |
| 43 | AllianceBernstein | U.S. | $0.65tn | AllianceBernstein |  |
| 45 | Principal Financial | U.S. | $0.64tn | Principal Asset Management |  |
| 46 | Dimensional Fund Advisors | U.S. | $0.58tn | Dimensional Fund Advisors |  |
| 47 | MetLife Investment Mgmt. | U.S. | $0.58tn | MetLife Investment Management |  |
| 48 | Macquarie Group | Australia | $0.54tn | Macquarie Asset Management |  |
| 49 | Generali Group | Italy | $0.54tn | Generali Investments |  |
| 52 | KKR | U.S. | $0.50tn | KKR |  |
| 55 | MassMutual | U.S. | $0.47tn | Barings | Barings, its publishing house. |
| 56 | Allspring Global Investments | U.S. | $0.46tn | Allspring Global Investments |  |
| 58 | abrdn | U.K. | $0.45tn | aberdeen | Renamed aberdeen. |
| 60 | Voya Financial | U.S. | $0.44tn | Voya Investment Management |  |
| 61 | Neuberger Berman | U.S. | $0.43tn | Neuberger Berman |  |
| 67 | Nordea | Denmark | $0.38tn | Nordea Asset Management |  |
| 68 | Ares Mgmt. | U.S. | $0.35tn | Ares Management |  |
| 69 | Mercer | U.S. | $0.34tn | Mercer | Consultant and OCIO. As a tracked manager it must be left out of the attention index. |
| 74 | Dodge & Cox | U.S. | $0.32tn | Dodge & Cox |  |
| 76 | SEI Investments | U.S. | $0.32tn | SEI |  |
| 78 | Janus Henderson Group | U.K. | $0.29tn | Janus Henderson Investors |  |
| 79 | Russell Investments | U.S. | $0.28tn | Russell Investments |  |
| 84 | Baillie Gifford | U.K. | $0.27tn | Baillie Gifford |  |
| 86 | Aviva | U.K. | $0.27tn | Aviva Investors |  |
| 94 | Pictet Asset Mgmt. | Switzerland | $0.24tn | Pictet Asset Management |  |
| – | AQR | U.S. | – | AQR | Outside the top 100; kept from the first roster. Confirm. |
| – | Bridgewater | U.S. | – | Bridgewater Associates | Outside the top 100; kept from the first roster. Confirm. |

## Wave 2

| Rank | Group (as ranked) | Market | Assets | House(s) tracked | Note |
|---|---|---|---|---|---|
| 27 | Power Financial | Canada | $0.92tn | Mackenzie Investments | Mackenzie Investments (Canada). Putnam was sold to Franklin Templeton. |
| 31 | Sumitomo Mitsui Trust Holdings | Japan | $0.86tn | Amova Asset Management (formerly Nikko AM) | Its international house (formerly Nikko AM) publishes in English. |
| 37 | Mitsubishi UFJ Financial Group | Japan | $0.73tn | First Sentier Investors | First Sentier Investors, its English-language house. |
| 54 | Nomura Asset Mgmt. | Japan | $0.47tn | Nomura Asset Management |  |
| 57 | Asset Management One | Japan | $0.46tn | Asset Management One |  |
| 59 | Union Investment | Germany | $0.44tn | Union Investment | Mainly German-language. |
| 63 | Intesa Sanpaolo | Italy | $0.41tn | Eurizon | Eurizon, its asset manager. |
| 66 | U.S. Bancorp | U.S. | $0.39tn | U.S. Bank Asset Management | Wealth commentary rather than asset-management research. |
| 71 | MEAG | Germany | $0.33tn | MEAG | Munich Re's asset manager; limited output. |
| 72 | TD Asset Mgmt. | Canada | $0.33tn | TD Asset Management |  |
| 82 | Swiss Life Asset Managers | Switzerland | $0.27tn | Swiss Life Asset Managers |  |
| 88 | Prudential | U.K. | $0.26tn | Eastspring Investments | Eastspring Investments (Asia). M&G demerged in 2019 and is not in this ranking. |
| 96 | Samsung Group | South Korea | $0.23tn | Samsung Asset Management |  |
| 98 | Scotiabank | Canada | $0.23tn | 1832 Asset Management | 1832 Asset Management. |
| 99 | Zurcher Kantonalbank | Switzerland | $0.23tn | Swisscanto | Swisscanto; mainly German-language. |
| 100 | BMO Wealth Mgmt. | Canada | $0.23tn | BMO Global Asset Management |  |

## Merged into another group

| Rank | Group | Market | Assets | Tracked under |
|---|---|---|---|---|
| 24 | AXA Group | France | $1.00tn | AXA IM now belongs to BNP Paribas (rank 17). |
| 53 | Credit Suisse | Switzerland | $0.48tn | Now part of UBS (rank 10). |

## Proposed exclusions

| Rank | Group | Market | Assets | Why |
|---|---|---|---|---|
| 30 | Geode Capital Mgmt. | U.S. | $0.87tn | Index sub-adviser; publishes no thought leadership. |
| 38 | Postal Savings Bank of China | China | $0.72tn | Bank; no public investment thought leadership in English. |
| 42 | Affiliated Managers Group | U.S. | $0.65tn | Holding company; its affiliates publish separately. Add named affiliates if wanted. |
| 44 | Nippon Life Insurance | Japan | $0.64tn | Insurer; little public thought leadership in English. |
| 50 | Dai-ichi Life Holdings | Japan | $0.54tn | Insurer; its asset management is through Asset Management One (rank 57). |
| 51 | Ping An Bank | China | $0.52tn | Bank; no public investment thought leadership in English. |
| 62 | Zenkyoren | Japan | $0.42tn | Agricultural co-operative insurer; no public thought leadership. |
| 64 | LBBW | Germany | $0.40tn | Bank; little public asset-management thought leadership. |
| 65 | E Fund Mgmt. | China | $0.40tn | Publishes mainly in Chinese. |
| 70 | Meiji Yasuda Life Insurance | Japan | $0.33tn | Insurer; little public thought leadership in English. |
| 73 | Shinkin Central Bank | Japan | $0.32tn | Bank; no public thought leadership. |
| 75 | Agricultural Bank of China | China | $0.32tn | Bank; no public investment thought leadership in English. |
| 77 | Jackson Financial | U.S. | $0.29tn | Insurer (PPM America); little public thought leadership. |
| 80 | Banco do Brasil | Brazil | $0.27tn | Bank; publishes mainly in Portuguese. |
| 81 | Societe Generale | France | $0.27tn | Sold Lyxor to Amundi; no separate asset-management publishing. |
| 83 | Dekabank Group | Germany | $0.27tn | Mainly German-language retail commentary. |
| 85 | Harvest Fund Mgmt. | China | $0.27tn | Publishes mainly in Chinese. |
| 87 | China Southern Asset Mgmt. | China | $0.26tn | Publishes mainly in Chinese. |
| 89 | NISA Investment | U.S. | $0.26tn | Overlay and passive manager; little public thought leadership. |
| 90 | China Asset Mgmt. | China | $0.26tn | Publishes mainly in Chinese. |
| 91 | Sumitomo Life Insurance | Japan | $0.26tn | Insurer; no public thought leadership in English. |
| 92 | ICBC Credit Suisse Asset Mgmt. | China | $0.25tn | Publishes mainly in Chinese. |
| 93 | Resona Holdings | Japan | $0.24tn | Bank; no public thought leadership in English. |
| 95 | GF Securities | China | $0.24tn | Publishes mainly in Chinese. |
| 97 | Zurich Financial Services | Switzerland | $0.23tn | Insurer managing its own money. |
