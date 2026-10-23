// One honest identity for every request this product makes. It names the product and, once
// BOT_CONTACT_URL is set, gives a page where a site owner can see who is reading and ask us to stop.
// Content Equity's contact section: lets a site owner see who is reading (James, 23 Oct 2026)
const contact = process.env.BOT_CONTACT_URL?.trim() || 'https://contentequity.co.uk/#contact'
export const UA = `Mozilla/5.0 (compatible; AMIntelligenceBot/0.1${contact ? `; +${contact}` : ''})`
