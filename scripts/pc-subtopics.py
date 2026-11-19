"""Sub-topic pass for the AllianceBernstein GCO audit (James approved, 19 Nov; under $1).

Reads exports/pc.json (from pc-export.yml), takes every piece tagged to a private or structured
credit sub-class or naming asset-based finance, and asks Claude Haiku to give each one a primary
sub-topic from a fixed list (plus up to two secondary ones). Writes exports/pc-subtopics.json.
Stops before the cost reaches MAX_USD. Needs ANTHROPIC_API_KEY.
"""
import json, os, re, sys, time, urllib.request

MODEL = 'claude-haiku-5-5'
PRICE_IN, PRICE_OUT = 0.10 / 1e6, 0.50 / 1e6
MAX_USD = float(os.environ.get('MAX_USD', '1.0'))
BATCH = 20

TOPICS = {
    'direct-lending': 'Direct lending & sponsor finance (corporate loans to PE-backed / middle-market companies, unitranche)',
    'credit-risk': 'Credit risk & stress in private credit (defaults, PIK, covenants, bubbles, blow-ups, valuation marks)',
    'abf-general': 'Asset-based finance as a whole (the case for ABF, market size, how it fits a portfolio)',
    'consumer-sme': 'Consumer & SME lending (consumer loans, cards, BNPL, auto, student, small business, fintech platforms)',
    'residential': 'Residential mortgages & housing finance (non-QM, RMBS, home equity, buy-to-let, housing shortage)',
    'cre-debt': 'Commercial real estate debt (CRE loans, CMBS, real estate credit)',
    'fund-finance': 'Fund finance (NAV loans, subscription lines, GP financing)',
    'srt': 'Significant / synthetic risk transfer and bank capital relief trades',
    'hard-assets': 'Hard assets: aviation, shipping, rail, equipment and leasing',
    'royalties-ip': 'Royalties, IP and litigation finance (music, pharma)',
    'digital-infra': 'Digital infrastructure & AI build-out financing (data centres, fibre, power for AI)',
    'infra-energy': 'Infrastructure & energy debt (project finance, renewables, transition)',
    'bank-partnerships': 'Banks and private credit (bank retreat, forward-flow and origination partnerships, regulation)',
    'insurance': 'Insurers & private credit (insurance balance sheets, annuities, capital treatment)',
    'wealth-access': 'Wealth & semi-liquid access (evergreen funds, BDCs, interval funds, ELTIFs/LTAFs, retail investors)',
    'clo': 'CLOs and broadly syndicated / leveraged loans',
    'opportunistic': 'Opportunistic, distressed & special situations credit',
    'ig-private': 'Investment-grade private credit & private placements',
    'securitised-public': 'Public securitised markets (agency MBS, ABS spreads and relative value)',
    'allocation': 'Private credit in portfolios (strategic allocation, public vs private, diversification, illiquidity)',
    'regional': 'Regional private credit markets (Europe, UK, Asia, emerging markets)',
    'other': 'None of these / not really about private or structured credit',
}
SUBS = {'Private Markets › Private credit', 'Private Markets › Asset-based finance',
        'Fixed Income & Credit › Securitised & ABS', 'Fixed Income & Credit › Leveraged loans'}
ABF = re.compile(r'asset[- ]based (financ|lend)|\babf\b|specialty financ|asset[- ]backed financ', re.I)

SYSTEM = ('You classify asset management insight pieces about private and structured credit by sub-topic. '
          'Choose from this fixed list (use the key):\n' + '\n'.join(f'- {k}: {v}' for k, v in TOPICS.items()) +
          '\n\nFor each piece give "primary" (the one sub-topic it is mainly about) and "secondary" (0-2 others it '
          'substantially covers). Judge by what the piece argues, not by passing mentions. Reply with JSON only: '
          '{"results":[{"i":<index>,"primary":"<key>","secondary":["<key>"]}]}')


def call(prompt):
    body = json.dumps({'model': MODEL, 'max_tokens': 2000, 'system': SYSTEM,
                       'messages': [{'role': 'user', 'content': prompt}]}).encode()
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body, headers={
        'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:
            print('retry', attempt, str(e)[:120]); time.sleep(5 * (attempt + 1))
    raise RuntimeError('API failed')


def main(src, out):
    P = json.load(open(src))['pieces']
    core = [p for p in P if SUBS & set(p.get('sub_asset_classes') or [])
            or ABF.search(f"{p.get('title') or ''} {p.get('summary') or ''}")]
    print(len(core), 'pieces')
    res, cost = {}, 0.0
    for b in range(0, len(core), BATCH):
        if cost >= MAX_USD * 0.95:
            print(f'stopping: cost ${cost:.3f} near the ${MAX_USD} limit'); break
        chunk = core[b:b + BATCH]
        prompt = '\n\n'.join(f"[{i}] {p.get('title') or '(untitled)'}\n{(p.get('summary') or '')[:900]}" for i, p in enumerate(chunk))
        r = call(prompt)
        u = r.get('usage', {}); cost += u.get('input_tokens', 0) * PRICE_IN + u.get('output_tokens', 0) * PRICE_OUT
        txt = ''.join(c.get('text', '') for c in r.get('content', []))
        try:
            items = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])['results']
        except Exception:
            print('unparsed batch', b); continue
        for it in items:
            i = it.get('i')
            if isinstance(i, int) and 0 <= i < len(chunk):
                prim = it.get('primary') if it.get('primary') in TOPICS else 'other'
                sec = [s for s in (it.get('secondary') or []) if s in TOPICS and s != prim][:2]
                res[chunk[i]['id']] = {'primary': prim, 'secondary': sec}
        print(f'{b + len(chunk)}/{len(core)} done, ${cost:.3f}')
    json.dump({'model': MODEL, 'cost_usd': round(cost, 4), 'topics': TOPICS, 'n': len(res), 'pieces': res}, open(out, 'w'))
    print(f'classified {len(res)} of {len(core)}; cost ${cost:.3f}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
