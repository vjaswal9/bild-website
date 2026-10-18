// Site-wide on/off switches for copy that is shown or hidden as a whole.
// Kept apart from SITE_CONFIG on purpose: that file also holds the WhatsApp
// invite links, which must never be imported into browser code, whereas these
// are safe to use anywhere, including client components.

// BILD's specialist WhatsApp groups (the "55 groups"). While false, every
// public mention of how many there are, and of the topics they cover, is
// hidden: the home page, About, the join form and FAQ, and the search
// descriptions. The number itself still lives in SITE_CONFIG.whatsappCommunities.
//
// Deliberately NOT affected: what happens after someone joins (being added to
// the BILD WhatsApp group, the welcome emails and join pages), the Code of
// Conduct, Privacy Policy and Terms, which describe how the groups are run.
//
// Set to true and deploy to bring it all back.
export const SHOW_SPECIALIST_WHATSAPP_GROUPS = false
