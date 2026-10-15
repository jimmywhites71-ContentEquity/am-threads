# AM Intelligence — manager roster v1

*15 Oct 2026. Source: the top 100 of the Thinking Ahead Institute / Pensions & Investments 500 ranking, 2023 edition (total assets at end-2022, USD), supplied by James, plus ten houses he added. The code copy is `lib/roster.ts` in the am-threads repository; this doc is generated from it. Exclusions and wave 2 are proposals for James to confirm.*

## How the ranking maps to what we track
The ranking lists **groups**; the product tracks the **houses that publish**.
- **Wave 1 — 71 houses:** 61 houses for 57 ranked groups, plus ten added by James (15 Oct): M&G, AQR, Bridgewater, Blackstone, Apollo, Lazard, Robeco, Royal London, Man Group and Ninety One. Some groups publish through more than one house: Allianz (PIMCO and Allianz GI), BNY (BNY Investments, Insight, Newton), Natixis (Natixis IM and Loomis Sayles). Some publish under another name: Prudential Financial → PGIM, Sun Life → MFS, Ameriprise → Columbia Threadneedle, MassMutual → Barings.
- **Wave 2 — 16 houses.** Real output but regional, smaller or mainly non-English. Added once wave 1 runs cleanly.
- **Merged — 2.** Credit Suisse is now UBS; AXA IM now belongs to BNP Paribas.
- **Proposed exclusions — 25.** Banks and insurers managing in-house money, an index sub-adviser, a holding company, and Chinese fund firms publishing mainly in Chinese.

**Total: 87 houses** (71 in wave 1, 16 in wave 2).

## Rules that follow from the roster
- **Attention index:** every house on the roster is supply, so its content must be left out of the independent attention measure. This matters for Mercer (a consultant) and for M&G's Bond Vigilantes, which AlphaThreads reads.
- **Ranking date:** the 2023 edition (end-2022 assets). A later edition would reorder the middle of the list.

## Sources and checking
Every house except the first eleven starts with its site's robots.txt, which names its sitemaps; pages are kept when their address looks like insight content. The Source check workflow (a dry run) reports for each house what it found or why it failed; the weekly check-in proposes fixes.

## Wave 1 — ranked top 100

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
| 25 | Sun Life Financial | Canada | $979bn | MFS Investment Management | MFS, its publishing house. |
| 26 | Ameriprise Financial | U.S. | $956bn | Columbia Threadneedle Investments |  |
| 28 | Schroders | U.K. | $887bn | Schroders |  |
| 29 | Deutsche Bank | Germany | $877bn | DWS |  |
| 32 | Manulife | Canada | $845bn | Manulife Investment Management |  |
| 33 | Aegon Group | Netherlands | $798bn | Aegon Asset Management |  |
| 34 | Brookfield Asset Mgmt. | Canada | $790bn | Brookfield Asset Management |  |
| 35 | Charles Schwab Investment | U.S. | $758bn | Charles Schwab | Mostly broker and retail commentary; tag channel as retail. |
| 36 | Royal Bank of Canada | Canada | $738bn | RBC Global Asset Management | RBC Global Asset Management, including BlueBay. |
| 39 | Federated Hermes | U.S. | $669bn | Federated Hermes |  |
| 40 | Fidelity International | U.K. | $663bn | Fidelity International |  |
| 41 | New York Life Investments | U.S. | $654bn | New York Life Investments |  |
| 43 | AllianceBernstein | U.S. | $646bn | AllianceBernstein |  |
| 45 | Principal Financial | U.S. | $635bn | Principal Asset Management |  |
| 46 | Dimensional Fund Advisors | U.S. | $584bn | Dimensional Fund Advisors |  |
| 47 | MetLife Investment Mgmt. | U.S. | $580bn | MetLife Investment Management |  |
| 48 | Macquarie Group | Australia | $543bn | Macquarie Asset Management |  |
| 49 | Generali Group | Italy | $539bn | Generali Investments |  |
| 52 | KKR | U.S. | $504bn | KKR |  |
| 55 | MassMutual | U.S. | $466bn | Barings | Barings, its publishing house. |
| 56 | Allspring Global Investments | U.S. | $465bn | Allspring Global Investments |  |
| 58 | abrdn | U.K. | $452bn | aberdeen | Renamed aberdeen. |
| 60 | Voya Financial | U.S. | $439bn | Voya Investment Management |  |
| 61 | Neuberger Berman | U.S. | $427bn | Neuberger Berman |  |
| 67 | Nordea | Denmark | $383bn | Nordea Asset Management |  |
| 68 | Ares Mgmt. | U.S. | $352bn | Ares Management |  |
| 69 | Mercer | U.S. | $345bn | Mercer | Consultant and OCIO. As a tracked manager it must be left out of the attention index. |
| 74 | Dodge & Cox | U.S. | $323bn | Dodge & Cox |  |
| 76 | SEI Investments | U.S. | $316bn | SEI |  |
| 78 | Janus Henderson Group | U.K. | $287bn | Janus Henderson Investors |  |
| 79 | Russell Investments | U.S. | $276bn | Russell Investments |  |
| 84 | Baillie Gifford | U.K. | $269bn | Baillie Gifford |  |
| 86 | Aviva | U.K. | $268bn | Aviva Investors |  |
| 94 | Pictet Asset Mgmt. | Switzerland | $237bn | Pictet Asset Management |  |

## Wave 1 — added by James

| Rank | Group (as ranked) | Market | Assets | House(s) tracked | Note |
|---|---|---|---|---|---|
| – | AQR | U.S. | – | AQR | Outside the ranked list; added by James. |
| – | Bridgewater | U.S. | – | Bridgewater Associates | Outside the ranked list; added by James. |
| – | M&G | U.K. | – | M&G Investments | Not in the ranking; added by James. Includes Bond Vigilantes, which AlphaThreads also reads (see attention-index rule). |
| – | Blackstone | U.S. | – | Blackstone | Not in the ranking; added by James. |
| – | Apollo | U.S. | – | Apollo | Not in the ranking; added by James. |
| – | Lazard | U.S. | $216bn | Lazard Asset Management | Rank 103; added by James. |
| – | Robeco Group | Netherlands | $183bn | Robeco | Rank 115; added by James. |
| – | Royal London Group | U.K. | $177bn | Royal London Asset Management | Rank 118; added by James. |
| – | Man Group | U.K. | $143bn | Man Group | Rank 139; added by James. |
| – | Ninety One | South Africa | $159bn | Ninety One | Rank 132; added by James. |

## Wave 2

| Rank | Group (as ranked) | Market | Assets | House(s) tracked | Note |
|---|---|---|---|---|---|
| 27 | Power Financial | Canada | $918bn | Mackenzie Investments | Mackenzie Investments (Canada). Putnam was sold to Franklin Templeton. |
| 31 | Sumitomo Mitsui Trust Holdings | Japan | $855bn | Amova Asset Management (formerly Nikko AM) | Its international house (formerly Nikko AM) publishes in English. |
| 37 | Mitsubishi UFJ Financial Group | Japan | $729bn | First Sentier Investors | First Sentier Investors, its English-language house. |
| 54 | Nomura Asset Mgmt. | Japan | $469bn | Nomura Asset Management |  |
| 57 | Asset Management One | Japan | $460bn | Asset Management One |  |
| 59 | Union Investment | Germany | $441bn | Union Investment | Mainly German-language. |
| 63 | Intesa Sanpaolo | Italy | $415bn | Eurizon | Eurizon, its asset manager. |
| 66 | U.S. Bancorp | U.S. | $390bn | U.S. Bank Asset Management | Wealth commentary rather than asset-management research. |
| 71 | MEAG | Germany | $328bn | MEAG | Munich Re's asset manager; limited output. |
| 72 | TD Asset Mgmt. | Canada | $326bn | TD Asset Management |  |
| 82 | Swiss Life Asset Managers | Switzerland | $271bn | Swiss Life Asset Managers |  |
| 88 | Prudential | U.K. | $260bn | Eastspring Investments | Eastspring Investments (Asia). M&G demerged in 2019 and is not in this ranking. |
| 96 | Samsung Group | South Korea | $235bn | Samsung Asset Management |  |
| 98 | Scotiabank | Canada | $230bn | 1832 Asset Management | 1832 Asset Management. |
| 99 | Zurcher Kantonalbank | Switzerland | $226bn | Swisscanto | Swisscanto; mainly German-language. |
| 100 | BMO Wealth Mgmt. | Canada | $225bn | BMO Global Asset Management |  |

## Merged into another group

| Rank | Group | Market | Assets | Tracked under |
|---|---|---|---|---|
| 24 | AXA Group | France | $995bn | AXA IM now belongs to BNP Paribas (rank 17). |
| 53 | Credit Suisse | Switzerland | $477bn | Now part of UBS (rank 10). |

## Proposed exclusions

| Rank | Group | Market | Assets | Why |
|---|---|---|---|---|
| 30 | Geode Capital Mgmt. | U.S. | $866bn | Index sub-adviser; publishes no thought leadership. |
| 38 | Postal Savings Bank of China | China | $716bn | Bank; no public investment thought leadership in English. |
| 42 | Affiliated Managers Group | U.S. | $651bn | Holding company; its affiliates publish separately. Add named affiliates if wanted. |
| 44 | Nippon Life Insurance | Japan | $643bn | Insurer; little public thought leadership in English. |
| 50 | Dai-ichi Life Holdings | Japan | $538bn | Insurer; its asset management is through Asset Management One (rank 57). |
| 51 | Ping An Bank | China | $518bn | Bank; no public investment thought leadership in English. |
| 62 | Zenkyoren | Japan | $425bn | Agricultural co-operative insurer; no public thought leadership. |
| 64 | LBBW | Germany | $405bn | Bank; little public asset-management thought leadership. |
| 65 | E Fund Mgmt. | China | $398bn | Publishes mainly in Chinese. |
| 70 | Meiji Yasuda Life Insurance | Japan | $330bn | Insurer; little public thought leadership in English. |
| 73 | Shinkin Central Bank | Japan | $323bn | Bank; no public thought leadership. |
| 75 | Agricultural Bank of China | China | $318bn | Bank; no public investment thought leadership in English. |
| 77 | Jackson Financial | U.S. | $291bn | Insurer (PPM America); little public thought leadership. |
| 80 | Banco do Brasil | Brazil | $274bn | Bank; publishes mainly in Portuguese. |
| 81 | Societe Generale | France | $273bn | Sold Lyxor to Amundi; no separate asset-management publishing. |
| 83 | Dekabank Group | Germany | $271bn | Mainly German-language retail commentary. |
| 85 | Harvest Fund Mgmt. | China | $268bn | Publishes mainly in Chinese. |
| 87 | China Southern Asset Mgmt. | China | $264bn | Publishes mainly in Chinese. |
| 89 | NISA Investment | U.S. | $259bn | Overlay and passive manager; little public thought leadership. |
| 90 | China Asset Mgmt. | China | $257bn | Publishes mainly in Chinese. |
| 91 | Sumitomo Life Insurance | Japan | $257bn | Insurer; no public thought leadership in English. |
| 92 | ICBC Credit Suisse Asset Mgmt. | China | $248bn | Publishes mainly in Chinese. |
| 93 | Resona Holdings | Japan | $241bn | Bank; no public thought leadership in English. |
| 95 | GF Securities | China | $235bn | Publishes mainly in Chinese. |
| 97 | Zurich Financial Services | Switzerland | $232bn | Insurer managing its own money. |
