---
version: 1
slug: "design-review-link-html"
primary_target: "design/review-link.html"
related_targets: ["design/admin.html"]
---

# Review link page (customer)

Scope: the standalone customer page at /r/[token] (design draft: design/review-link.html). Mode: Operate (one task: post an honest review). Admin draft (design/admin.html) inherits the same world.

Audience: customers of local service businesses and online shoppers, on a phone, opened from SMS/WhatsApp/email. Job: rate, accept or tweak a pre-written draft, copy it to a portal. Constraints: no navigation; the customer picks the rating; no pressure toward 5 stars; reward only after copying and only on portals that allow incentives.

## Direction contract

THESIS: The draft is the top sheet of a duplicate book; posting lifts a blue carbon copy off it and hands it to the portal. This refuses the category default of a centred logo, an amber star row and a rounded textarea card.

OWN-WORLD: White bond paper, ink #101522, carbon blue #2346e0 with a pale carbon wash #e9eefb. The sheet has a 1px ink border, 3px corners and no soft shadows. The carbon is an offset blue duplicate under the sheet. Type is Schibsted Grotesk throughout, with a tight display heading at -0.035em. Small spaced numerals mark sheet numbers (NO. 0241 · ORIGINAL). Stars are ink glyphs, never amber. Chips are pills, with ink fill when on.

STORY: The customer sees their review already written, understands they control the rating and the words, and posts in one tap without feeling pushed.

FIRST VIEWPORT (390x844): brand mark and name at top left; a 36px greeting heading; a one-line lede; a 5-star ink row; highlight chips; the sheet stack (sheet over carbon) holding the draft; then a full-width blue "Copy & open Google" button with secondary portals as text below it.

FORM: Carbon Copy, the IMPECCABLE'S PICK card (my rank 1 grounded candidate; the assigned one was The Guest Book). seed: 7cac6a54e24943a9. Signature interaction: on Copy, the blue carbon slides out from under the sheet toward the portal and the sheet stamps COPIED. Motion grammar: GSAP, damped ease-out with no bounce. The draft re-types line by line when the rating or chips change. Lenis smooth scroll. Reduced motion shows instant states.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
