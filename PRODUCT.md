# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js (App Router) on Cloudflare Workers via OpenNext, D1 + Drizzle, R2 for logo uploads, OpenRouter for text generation. Current design drafts are static HTML.

## Users
- **Customers** of a business (equally local-service clients such as clinics, salons and restaurants, and online shoppers). They open a unique review link on their phone from SMS, WhatsApp or email, shortly after a visit or delivery. Their job is to leave an honest review with as little effort as possible.
- **Business admin** (single business in v1). Sets up brand, products, and review portals, then creates one link per customer.

## Product Purpose
Remove the writer's block between a good (or bad) experience and a posted review. The customer opens a link and finds a draft that is already written from the brand, product, and visit context. They choose their own rating, tweak the draft, and copy it to Google, Trustpilot, or another portal in one tap. Success means more completed reviews that still sound like the customer.

## Positioning
The draft is context-aware, built from the business's own product knowledge and the specific visit, and it follows the rating the customer picks, so a 2-star review gets an honest draft rather than a glowing one. Compliance is built into the product rather than left to policy text.

## Operating Context
- Review links are unique per customer: an unguessable token for one product and visit, on a standalone page with no navigation. The only outbound links are the portal buttons.
- Portals are third-party (Google, Trustpilot, Amazon, Yelp, Facebook, G2) or the business's own site. Submission works as copy to clipboard plus opening the portal in a new tab.
- The admin creates links one at a time from a form.

## Capabilities and Constraints
- The customer picks the star rating, which is never pre-filled. Highlight chips steer the draft, and Short/Detailed variants are available.
- Rewards are generic (code, link, or manual). They show only after copying and only for portals that allow incentives. Google, Amazon, Trustpilot, Yelp, and Facebook are hard-locked off.
- No review gating: low ratings see the same portals as high ratings.
- Customer name/email are never sent to the LLM.
- Undecided: CSV import, email/SMS sending, multi-business, analytics.

## Brand Commitments
- Product name: Review Assist.
- Blue accent (explicitly not violet), white canvas, clean and simple, not cluttered. The user cited hyperfolio.framer.website as a reference for cleanliness.
- Smooth motion with GSAP and Lenis, requested by the user.
- Must never feel pushy toward 5 stars.

## Evidence on Hand
No real customers, testimonials, or metrics. The demo business "Lopez Dental" is synthetic and must be labelled as demo content.

## Product Principles
1. Effort near zero: the draft is ready before the customer arrives.
2. The customer's voice and rating rule, and the draft follows them.
3. Honest by construction: no gating, no incentives where they aren't allowed, no pressure.
4. One page, one job: post the review.
