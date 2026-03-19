# Reprompt — Query Rewriter for ChatGPT Shopping Triggers

## Product Requirements Document

---

## 1. Problem Statement

ChatGPT is rapidly evolving from an answer engine into a storefront. Between September 2025 and January 2026, unsolicited product recommendations grew from 15% to 28% of responses (Profound research, 100k prompts). Yet **79% of prompts never trigger shopping results**, and only ~6% trigger reliably.

Marketers have no way to systematically understand *which phrasings* of their customers' queries will surface product cards vs. which will get a text-only answer. The gap between "What's a good dining room set?" (triggers shopping) and "What's the typical price range for a dining room set that seats six?" (informational — yet ChatGPT still inserts product cards) is subtle and unpredictable.

The problem compounds: only **18% of ChatGPT conversations trigger a web search at all**, and even within those, **Turn 1 is 2.5x more likely to trigger citations than Turn 10**. The window for product discovery is narrow and front-loaded. Sources travel in packs — ChatGPT cites ~4 sources per turn in co-citation clusters (NerdWallet + The Points Guy, The Verge + TechRadar), and brands need to land inside these clusters, not displace them.

**Reprompt** bridges this gap: given any customer query, it generates rephrased variants optimized to trigger ChatGPT's shopping/product recommendation behavior, scores them on likelihood of surfacing product cards, and predicts which co-citation clusters the rewrite will activate.

---

## 2. Target User

- **AEO/GEO strategists** at e-commerce brands who need to understand the query surface area that drives product recommendations
- **Content marketers** optimizing landing pages and product descriptions for AI discoverability
- **Profound's internal research team** (dog-fooding) to expand Shopping Analysis capabilities

---

## 3. Key Insights from Research

| Insight | Source | Implication |
|---|---|---|
| Open-ended, preference-driven prompts trigger shopping at **12.1%** — 4x the rate of brand-direct queries | Profound 2M prompt study | Rewriter should steer toward preference/use-case framing, not brand mentions |
| Shopping query fan-outs avg **7 words** (vs 12 for normal search fan-outs) | Search Engine Land | Rephrased queries should be concise and product-specific |
| Prompts that reliably trigger describe a **specific, shippable product need** with enough detail to match a real SKU | Profound | Rewriter must inject specificity: material, use-case, size, price range |
| **83% of carousel products** come from Google Shopping top 40 organic results | Profound/SEL reverse-engineering study | We can use Google Shopping API as a proxy signal for what ChatGPT would surface |
| Health (47%), productivity (42%), sleep (41%) queries have highest unsolicited rec rates | Profound 10k conversation study | Problem-solution framing is a high-value rewrite strategy |
| No public API exposes ChatGPT shopping results | OpenAI Developer Community | Must build evaluation pipeline using proxy signals + optional browser automation |
| LinkedIn jumped from #11 → #5 on ChatGPT in 3 months; user-generated content (posts/articles) grew from 27% → 35% of citations | Profound LinkedIn study | Content type matters — rewrites should consider what *type* of content (UGC, editorial, product pages) the AI is likely to cite alongside product cards |
| Profound uses **synthetic prompt baskets** (curated, repeatable query sets) tested across 6 AI platforms alongside organic prompt tracking with 7-day rolling averages | Profound methodology | Our eval pipeline should mirror this: controlled baskets for benchmarking + organic tracking for drift detection |
| Cross-platform consistency matters — LinkedIn ranked #1 across all 6 AI platforms for professional queries, not just ChatGPT | Profound multi-engine analysis | Rewrites should be tested multi-platform; a rewrite that triggers shopping across ChatGPT + Gemini + Perplexity is more robust |
| Only **18% of ChatGPT conversations** trigger a web search at all; rate held steady Oct–Dec 2025 | Profound citation sources study (730k conversations) | Shopping triggers are a subset of the 18% that trigger search — rewriting must first cross the "search trigger" threshold before shopping can activate |
| **Turn 1 is 2.5x more likely** to trigger citations than turn 10, and 4x more likely than turn 20 (12.6% → 4.5% → 3.0%) | Profound citation sources study | Rewrites should be optimized as **conversation openers** — the first message is prime real estate for product discovery |
| Sources travel in packs: **co-citation clusters** form by vertical (NerdWallet + The Points Guy at 14%, The Verge + TechRadar at 10%) | Profound co-citation analysis | Rewrites that trigger queries landing in established co-citation clusters are more likely to surface products alongside trusted sources |
| Citation distribution has a **Gini coefficient of 0.8** — top 10 domains capture only 12% of all citations; long tail is massive | Profound citation sources study | Opportunity for niche/specialist brands: the playing field is more open than Google's where top results dominate |
| ~6 unique citations per conversation, ~4 per turn; ChatGPT cites competitors side by side (source triangulation) | Profound citation sources study | Rewrites should aim to land the brand in a **multi-source citation set**, not as sole authority — frame queries to invite comparison |

---

## 4. Core Features

### 4.1 Query Rewriter Engine

**Input:** A natural-language customer query (e.g., "how do I organize my home office?")

**Output:** 5-10 rephrased variants ranked by estimated shopping-trigger probability, each annotated with:
- Shopping trigger score (0-100)
- Rewrite strategy applied (see below)
- Predicted product categories that would surface
- **Citation cluster prediction**: which trusted domains the rewrite is likely to co-cite alongside (e.g., "This rewrite lands in the NerdWallet + The Points Guy cluster")
- **Turn 1 fitness**: boolean flag — is this rewrite optimized as a conversation opener? (Turn 1 = 12.6% citation rate vs 4.5% at turn 10)how 

**Rewrite Strategies (applied combinatorially):**

| Strategy | Description | Example |
|---|---|---|
| **Specificity Injection** | Add product-matchable details (material, size, use-case, price range) | "organize home office" → "best desk organizer set for small home office under $50" |
| **Preference Framing** | Reframe as preference/recommendation request | "dining room set pricing" → "which dining room set that seats six is the best value?" |
| **Problem-to-Product Bridge** | Convert problem statement into solution-seeking query | "I can't sleep well" → "what products help with falling asleep faster?" |
| **Comparison Trigger** | Frame as comparison to activate product card UI | "good running shoes" → "lightweight running shoes for flat feet vs normal arch" |
| **Use-Case Anchoring** | Ground in specific scenario/persona | "laptop for work" → "best laptop for a remote software developer who travels weekly" |
| **Conciseness Optimization** | Trim to ~7 words matching fan-out patterns | "what is the best type of comfortable office chair for long hours" → "best ergonomic office chair for long hours" |
| **Co-Citation Cluster Targeting** | Frame query to land in an established co-citation vertical where trusted domains already travel together | "credit card tips" → "best travel credit cards compared by annual fee and rewards" (targets NerdWallet + The Points Guy cluster) |
| **Turn 1 Opener Framing** | Optimize as a conversation-starting query that maximizes the 12.6% Turn 1 citation rate — factual grounding questions ("what is X", "how does Y work") that demand web search | "tell me about standing desks" → "what are the top-rated standing desks for home offices in 2026?" |

### 4.2 Shopping Trigger Scorer

A classification model that estimates the probability a query will trigger ChatGPT shopping results, based on:

- **Lexical signals**: Transactional keywords, product attribute mentions, comparison language
- **Structural signals**: Query length (sweet spot ~7 words), question type (what/which/best), specificity level
- **Semantic signals**: Embedding similarity to known shopping-triggering prompts
- **Category signals**: Whether the query maps to product categories with high shopping trigger rates

**Architecture:** Lightweight classifier (fine-tuned DeBERTa or distilled model) trained on a labeled dataset of queries with known shopping trigger outcomes. Falls back to LLM-based scoring for cold-start.

### 4.3 Evaluation Pipeline (Inspired by Profound's Dual-Source Methodology)

Profound's LinkedIn citation study used two complementary approaches: (1) organic real-user prompt tracking across millions of queries with 7-day rolling averages, and (2) synthetic prompt baskets — curated, repeatable query sets tested across 6 AI platforms (ChatGPT, Gemini, Google AI Overviews, AI Mode, Copilot, Perplexity) to measure citation behavior in a controlled way. We adopt the same dual-source philosophy:

**Source A — Synthetic Prompt Baskets (Controlled Measurement)**

Curated baskets of prompts organized by **topic cluster** (e.g., home & furniture, health & wellness, electronics, fitness, food & kitchen) tested systematically across AI platforms. Each basket contains:
- 20-50 prompts per cluster, spanning informational → transactional intent spectrum
- Original phrasing + Reprompt-generated rewrites for A/B comparison
- Tested across ChatGPT, Gemini, and Perplexity (multi-platform, matching Profound's cross-engine approach)

This gives us **structured, repeatable measurement** — we can re-run the same basket weekly to track whether rewrites maintain their shopping-trigger effectiveness as AI platforms evolve.

**Source B — Organic Query Tracking (Real-World Signal)**

Log all queries processed through Reprompt and track outcomes over time using 7-day rolling averages (same cadence as Profound's domain rank tracking). This captures:
- Which rewrite strategies produce the highest trigger rates in practice
- Drift detection: do strategies that worked last month still work?
- Category-level trends (e.g., health queries may respond differently to rewrites than electronics)

**Ground-Truth Collection Methods:**

1. **Google Shopping Proxy**: Query Google Shopping API / SerpApi with the rewritten prompt. If structured product results come back → high proxy score. (83% of ChatGPT carousel items come from Google Shopping.)
2. **Fan-Out Simulation**: Generate the ~1.16 shopping fan-out queries that ChatGPT would produce (7-word product-specific variants), then check Google Shopping coverage.
3. **Multi-Platform Citation Check**: Following Profound's methodology, test rewrites across multiple AI platforms — not just ChatGPT. A query that triggers shopping on ChatGPT *and* product citations on Perplexity/Gemini is a stronger signal than one that only works on ChatGPT.
4. **Optional Browser Validation**: Playwright-based headless validation against chatgpt.com for ground-truth labeling (batch, not real-time). Used to build training data, not in the hot path.

### 4.4 Dashboard / API

- **Web UI**: Paste a query → see ranked rewrites with scores and predicted product categories
- **REST API**: `POST /rewrite` with query → returns scored variants (for integration into Profound's platform or customer workflows)
- **Batch mode**: Upload CSV of queries → get back scored rewrites for each

---

## 5. Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                       │
│         Web UI (Next.js)  /  REST API               │
└──────────────┬──────────────────────────┬───────────┘
               │                          │
               ▼                          ▼
┌──────────────────────┐    ┌──────────────────────────┐
│   Rewriter Service   │    │   Batch Processing       │
│                      │    │   (CSV upload → results)  │
│  ┌────────────────┐  │    └──────────────────────────┘
│  │ LLM Rewriter   │  │
│  │ (Claude/GPT)   │  │
│  │                 │  │
│  │ Strategy Engine │  │
│  │ (8 strategies)  │  │
│  └───────┬────────┘  │
│          │           │
│  ┌───────▼────────┐  │
│  │ Trigger Scorer  │  │
│  │                 │  │
│  │ - Classifier    │  │
│  │ - Google Shop   │  │
│  │   proxy signal  │  │
│  │ - Fan-out sim   │  │
│  └────────────────┘  │
└──────────────────────┘
               │
               ▼
┌──────────────────────────┐
│   Data Layer             │
│                          │
│  - Query history DB      │
│  - Training dataset      │
│  - Google Shopping cache  │
│  - Rewrite audit log     │
└──────────────────────────┘
```

### Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Backend** | Python (FastAPI) | Fast prototyping, excellent LLM/NLP ecosystem |
| **LLM for rewriting** | Claude API (claude-sonnet-4-6) | Cost-effective, strong instruction following for rewrite strategies |
| **Trigger scorer** | Fine-tuned DeBERTa (v3-base) → ONNX for inference | Fast, cheap, accurate intent classification |
| **Google Shopping proxy** | SerpApi or Google Shopping Content API | 83% of ChatGPT carousel items come from here |
| **Frontend** | Next.js + Tailwind | Rapid UI development, good for demo |
| **Database** | SQLite (MVP) → PostgreSQL | Simple start, easy migration |
| **Eval pipeline** | Playwright (optional) | Ground-truth collection against chatgpt.com |

---

## 6. MVP Scope (Interview Demo)

For the interview project, scope to a **working vertical slice**:

### In Scope (MVP)
- [x] FastAPI backend with `/rewrite` endpoint
- [x] LLM-powered rewriter using Claude API with all 8 strategies
- [x] Heuristic-based trigger scorer (lexical + structural signals, no fine-tuned model yet)
- [x] Google Shopping proxy scoring via SerpApi (or mock if no API key)
- [x] Simple Next.js frontend: input query → see ranked rewrites with scores
- [x] 3-5 demo examples with before/after showing score improvements
- [x] Batch mode via CSV upload
- [x] Prompt basket framework: 5 topic clusters (135 curated prompts), basket runner, before/after comparison view
- [x] Multi-platform awareness in scoring (bonus points for cross-engine trigger potential)

### Out of Scope (Future)
- Fine-tuned DeBERTa classifier (requires labeled training data)
- Playwright browser validation pipeline
- Live multi-platform testing (Gemini, Perplexity APIs) — MVP uses Google Shopping proxy only
- 7-day rolling average dashboards (MVP logs data but doesn't chart trends)
- User accounts / auth
- Production deployment / scaling
- Integration with Profound's existing platform

---

## 7. API Design

### POST /rewrite

**Request:**
```json
{
  "query": "how do I organize my home office?",
  "num_variants": 5,
  "strategies": ["all"],       // or specific: ["specificity_injection", "preference_framing"]
  "product_category": null,    // optional: hint for more relevant rewrites
  "include_proxy_scores": true // whether to run Google Shopping proxy check
}
```

**Response:**
```json
{
  "original_query": "how do I organize my home office?",
  "original_score": 12,
  "rewrites": [
    {
      "query": "best desk organizer set for small home office under $50",
      "score": 87,
      "strategy": "specificity_injection",
      "predicted_categories": ["desk organizers", "office storage", "desk accessories"],
      "proxy_signals": {
        "google_shopping_results": 42,
        "fan_out_coverage": 0.83
      },
      "citation_cluster": "home_and_lifestyle",
      "co_citation_neighbors": ["The Spruce", "Better Homes & Gardens", "Wirecutter"],
      "turn1_optimized": true
    },
    {
      "query": "which home office organizers do people recommend the most?",
      "score": 74,
      "strategy": "preference_framing",
      "predicted_categories": ["office organization", "storage solutions"],
      "proxy_signals": {
        "google_shopping_results": 31,
        "fan_out_coverage": 0.67
      },
      "citation_cluster": "home_and_lifestyle",
      "co_citation_neighbors": ["Reddit", "Wirecutter"],
      "turn1_optimized": true
    }
  ],
  "metadata": {
    "processing_time_ms": 1842,
    "model_version": "claude-sonnet-4-6"
  }
}
```

### POST /rewrite/batch

**Request:** Multipart form upload of CSV with `query` column.

**Response:** CSV download with original queries + top rewrite + score.

### GET /strategies

Returns available rewrite strategies with descriptions.

---

## 8. Scoring Algorithm (Heuristic MVP)

The trigger score (0-100) is a weighted composite:

```python
score = (
    0.25 * lexical_score +          # transactional keywords, product attributes
    0.15 * structural_score +        # length (~7 words optimal), question type
    0.20 * specificity_score +       # SKU-matchable details (material, size, price)
    0.20 * google_shopping_proxy +   # normalized count of Google Shopping results
    0.10 * citation_cluster_score +  # likelihood of landing in established co-citation vertical
    0.10 * turn1_fitness_score       # optimized as conversation opener (search-triggering patterns)
)
```

**Lexical Score (0-100):**
- +20 for transactional keywords (best, top, recommended, buy, compare)
- +15 for product attribute mentions (size, color, material, price range)
- +15 for comparison/preference language (vs, or, which, better)
- +10 for use-case mention (for + activity/persona)
- -20 for pure informational framing (what is, how does, explain, history of)

**Structural Score (0-100):**
- Query length: peak at 7 words (100), linear decay to 0 at 3 or 15 words
- Question type: "which/what [product]" → 80, "best [product]" → 90, "how to" → 30
- Presence of adjectives/modifiers → +20

**Specificity Score (0-100):**
- Product category identifiable → +30
- Price constraint mentioned → +20
- Size/quantity specified → +20
- Material/feature specified → +15
- Target persona/use-case → +15

**Google Shopping Proxy (0-100):**
- Normalized: `min(100, google_shopping_result_count * 2.5)`
- 0 results → 0, 40+ results → 100

**Citation Cluster Score (0-100):**

Based on Profound's finding that sources travel in packs (Gini 0.8, ~4 citations/turn):
- Query maps to a known high-co-citation vertical (finance, tech, health, travel) → +40
- Comparison/review language present ("compared", "vs", "top rated") → +30 (invites multi-source triangulation)
- Query specificity sufficient to match editorial/review content, not just Wikipedia → +30
- Pure informational ("what is X") likely to cite only Wikipedia → -20

**Turn 1 Fitness Score (0-100):**

Based on Profound's finding that Turn 1 has 12.6% citation rate (2.5x Turn 10):
- Factual grounding pattern ("what are the best...", "which X is...") → +40 (demands web search)
- Self-contained question (no references to prior context like "that one" or "the above") → +30
- Research-journey initiator (broad enough to open exploration, specific enough to trigger search) → +30
- Follow-up/clarification pattern ("can you explain more", "what about...") → -40

---

## 9. Rewriter Prompt Design

The core LLM prompt for generating rewrites:

```
You are an expert at rewriting queries to trigger product recommendations
in AI shopping assistants like ChatGPT.

Given a user query, generate {n} rephrased variants using these strategies:

1. SPECIFICITY INJECTION: Add product-matchable details (material, size,
   use-case, price range) so the query maps to real SKUs.
2. PREFERENCE FRAMING: Reframe as a recommendation/preference request
   using "best", "which", "recommended".
3. PROBLEM-TO-PRODUCT BRIDGE: Convert problem statements into
   product-solution queries.
4. COMPARISON TRIGGER: Frame as a product comparison to activate
   structured comparison UI.
5. USE-CASE ANCHORING: Ground in a specific scenario, persona, or
   context that implies a purchase decision.
6. CONCISENESS OPTIMIZATION: Distill to ~7 words that describe a
   specific, shippable product need.
7. CO-CITATION CLUSTER TARGETING: Frame the query so it lands in an
   established vertical where trusted domains co-cite each other
   (e.g., finance → NerdWallet + The Points Guy; tech → The Verge +
   TechRadar). Use comparison/review language that invites multi-source
   citation. ChatGPT cites ~4 sources per turn — aim to be in the set.
8. TURN 1 OPENER FRAMING: Optimize as a conversation-starting query.
   Turn 1 has a 12.6% citation rate (2.5x turn 10). Use factual-
   grounding patterns ("what are the top...", "which X is best for...")
   that demand a web search on the first message.

Rules:
- Each rewrite should be a natural query a real person would type
- Aim for 5-10 words per rewrite (shopping fan-outs average 7 words)
- Include enough specificity to match real products (SKU-matchable)
- Never mention brands unless the original query does
- Output JSON array with strategy label for each rewrite

Original query: "{query}"
```

---

## 10. Success Metrics

| Metric | Target (MVP) | Measurement |
|---|---|---|
| **Score lift** | Avg +40 points from original to best rewrite | Heuristic scorer |
| **Google Shopping hit rate** | 80%+ of rewrites return Google Shopping results | SerpApi |
| **Rewrite naturalness** | 4+/5 human rating | Manual eval on 50 queries |
| **Latency** | <3s for single query rewrite | API response time |
| **Strategy diversity** | All 8 strategies represented across top rewrites | Automated check |
| **Turn 1 fitness rate** | 90%+ of top rewrites flagged as Turn 1 optimized | Heuristic check |
| **Citation cluster coverage** | 70%+ of rewrites map to a known co-citation vertical | Cluster classifier |
| **Cross-platform consistency** | Top rewrite triggers shopping on 2+ AI platforms | Multi-platform basket test |
| **Temporal stability** | Score drift <10% over 7-day rolling window | Weekly basket re-runs (Profound methodology) |

---

## 11. Citation Dynamics Model (Inspired by Profound's Citation Sources Study)

Profound's analysis of 730k ChatGPT conversations revealed a citation ecosystem with clear structure. Reprompt uses these dynamics as a scoring and strategy layer.

### The Citation Funnel

```
100% of conversations
  └─ 18% trigger web search          ← "search threshold"
       └─ ~6 citations/conversation   ← source triangulation
            └─ ~4 citations/turn       ← co-citation clusters
                 └─ shopping cards      ← product recommendation layer
```

Reprompt's job is to push queries **down this funnel** — from "no search triggered" → "search triggered" → "cited alongside trusted sources" → "shopping cards surfaced."

### Turn Position Strategy

| Turn | Citation Rate | Reprompt Strategy |
|---|---|---|
| Turn 1 | 12.6% | **Primary target.** Rewrites should be self-contained, research-initiating questions that demand web search. |
| Turn 2-3 | 7.5-9.0% | Secondary. Follow-up rewrites that deepen into product specifics. |
| Turn 5+ | <6.2% | Diminishing returns. Not worth optimizing for — if shopping hasn't triggered by Turn 3, the conversation has moved past the discovery window. |

This means Reprompt's highest-value output is the **Turn 1 rewrite** — the version of the query that, if typed as a first message, maximizes the chance of both web search triggering and product cards appearing.

### Co-Citation Cluster Map (MVP)

Based on Profound's co-citation pair analysis, we maintain a lightweight lookup of known verticals and their dominant co-citation partners:

| Vertical | Top Co-Citation Pair | Co-Citation Rate | Cluster Domains |
|---|---|---|---|
| Personal Finance | NerdWallet + The Points Guy | 14% | NerdWallet, The Points Guy, Bankrate, Credit Karma |
| Tech/Electronics | The Verge + TechRadar | 10% | The Verge, TechRadar, Tom's Guide, CNET, Wirecutter |
| Health | MDPI + NIH | 7% | NIH, WebMD, Mayo Clinic, Healthline, MDPI |
| Home & Lifestyle | Wirecutter + The Spruce | est. 8% | Wirecutter, The Spruce, Better Homes & Gardens, HGTV |
| Travel | Kayak + Expedia | est. 6% | Kayak, Expedia, TripAdvisor, Lonely Planet |

**How this is used:** When scoring a rewrite, we check if the query's topic maps to a known cluster. Rewrites that would land in a high-co-citation vertical score higher because ChatGPT is more likely to pull in multiple sources (including product recommendations) when it has established citation partners to triangulate against.

### The "Wide but Shallow" Opportunity

With a Gini coefficient of 0.8 and top 10 domains capturing only 12% of citations, the distribution is radically different from Google (where top 3 results capture ~60% of clicks). This means:
- **Niche brands have a real shot** — you don't need to outrank Wikipedia, you need to appear *alongside* it in relevant citation clusters
- **Rewrites should invite multi-source responses** — comparison and review language triggers ChatGPT's source triangulation behavior, creating more citation slots for brands to fill
- **The long tail is the game** — hundreds of thousands of domains split the remaining 88% of citations

---

## 12. Prompt Basket Framework (Inspired by Profound's LinkedIn Citation Methodology)

Profound's LinkedIn citation study demonstrated the power of **synthetic prompt baskets** — curated query sets designed to represent real user behavior, tested repeatedly across platforms for structured measurement. Reprompt adopts this as a first-class feature.

### Basket Structure

Each basket is a JSONL file:

```json
{"query": "how do I organize my home office", "cluster": "home_office", "intent": "informational", "expected_trigger": false}
{"query": "best desk organizer for small spaces", "cluster": "home_office", "intent": "transactional", "expected_trigger": true}
{"query": "I keep losing things on my desk", "cluster": "home_office", "intent": "problem", "expected_trigger": false}
```

### Topic Clusters (MVP set)

| Cluster | # Prompts | Rationale |
|---|---|---|
| Health & Wellness | 30 | Highest unsolicited rec rate (47%) |
| Productivity & Home Office | 25 | High unsolicited rec rate (42%) |
| Sleep | 25 | High unsolicited rec rate (41%) |
| Consumer Electronics | 30 | High shopping volume, clear product taxonomy |
| Home & Furniture | 25 | Jasman's blog post example category |

### Basket Test Cycle

Following Profound's 7-day rolling average approach:

1. **Run basket** through Reprompt → generate rewrites for each prompt
2. **Score both originals and rewrites** using the trigger scorer
3. **Validate sample** against Google Shopping proxy (and optionally ChatGPT/Gemini/Perplexity)
4. **Log results** with timestamp → build time-series of trigger rates
5. **Repeat weekly** → detect drift in platform behavior and strategy effectiveness

### Why This Matters

This mirrors exactly how Profound conducts its own research — they don't just track organic behavior, they maintain controlled synthetic baskets for repeatable, comparable measurement. Building this into Reprompt shows:
- Deep understanding of Profound's research methodology
- The tool isn't just a one-shot rewriter — it's a **measurement framework** for ongoing AEO optimization
- Natural integration point with Profound's Prompt Volumes and Shopping Analysis products

---

## 13. Demo Walkthrough (Interview)

1. **Open the UI** — clean input box with "Enter a customer query"
2. **Type:** "I've been having trouble sleeping lately"
   - Original score: **8** (pure informational, no product signal)
   - Top rewrite: "best products to help fall asleep faster" → score **82**
   - Shows predicted categories: sleep masks, white noise machines, melatonin supplements
3. **Type:** "what's a good price for a couch?"
   - Original score: **34** (implicit shopping, but vague)
   - Top rewrite: "best mid-range sofa under $1000 for small apartment" → score **91**
4. **Show prompt basket**: Run the "Sleep" basket (25 prompts) → show before/after trigger scores across the cluster. Highlight that 41% of sleep queries already get unsolicited recs, and Reprompt pushes that even higher with targeted rewrites.
5. **Show batch mode**: Upload 20 queries from a mattress brand → export CSV showing which customer queries are closest to triggering shopping and how to optimize content around them
6. **Talk methodology**: "This evaluation approach mirrors Profound's own research — synthetic prompt baskets for controlled measurement, tested across platforms, tracked over time with rolling averages. The same framework that produced the LinkedIn citation study and the 100k shopping prompt analysis."
7. **Show citation cluster insight**: For a finance query, show how the rewrite targets the NerdWallet + Points Guy co-citation cluster (14% co-citation rate). "Your brand doesn't need to beat Wikipedia — it needs to appear alongside these trusted co-citation partners. Only 18% of conversations trigger search, but when they do, ChatGPT cites ~4 sources per turn. Reprompt gets you into that set."
8. **Explain the "why"**: Connect back to Jasman's blog post — this tool helps marketers get into the room where "intent is being manufactured out of thin air." And connect to the citation sources research: "The citation distribution has a Gini of 0.8 — it's wide but shallow. Top 10 domains only capture 12%. The long tail is the game, and Reprompt helps brands find their lane."

---

## 14. Implementation Plan

| Phase | Tasks | Time |
|---|---|---|
| **Phase 1: Backend Core** | FastAPI scaffolding, Claude rewriter integration, heuristic scorer | Day 1 |
| **Phase 2: Google Shopping Proxy** | SerpApi integration, fan-out simulation, proxy scoring | Day 1 |
| **Phase 3: Frontend** | Next.js UI, query input, results display, score visualization | Day 2 |
| **Phase 4: Prompt Baskets** | Basket JSONL format, 5 topic clusters (135 prompts), basket runner + comparison view | Day 2 |
| **Phase 5: Batch + Polish** | CSV upload/download, demo examples, error handling, README | Day 3 |
| **Phase 6: Demo Prep** | End-to-end walkthrough, talking points, edge cases | Day 3 |

---

## 15. Why This Matters for Profound

This tool directly extends Profound's **Shopping Analysis** and **Citation Intelligence** products:

- **Current state**: Profound tracks which products appear in AI shopping results and which domains get cited
- **This adds**: Predictive + generative capability — given a query, *predict* whether it will trigger shopping, *generate* optimized variants that will, and *map* which co-citation clusters the brand will land in
- **Strategic fit**: Moves Profound from read-only analytics ("here's what happened") to read-write optimization ("here's how to make it happen") — exactly their stated vision
- **Data flywheel**: Every query processed generates training data for a future fine-tuned classifier, improving accuracy over time
- **Bridges two research streams**: Connects the shopping trigger research (100k prompts, 2M prompt study) with the citation dynamics research (730k conversations) — shopping triggers don't exist in isolation, they happen within the broader citation ecosystem

The unsolicited recommendation trend (15% → 28% and growing) means the surface area for product discovery in AI is expanding fast. Combined with the citation dynamics (18% search trigger rate, Gini 0.8, Turn 1 prime real estate), brands that can systematically map their customer queries to shopping-triggering phrasings *and* position themselves within the right co-citation clusters will capture disproportionate share of this new channel.

---

*Built as an interview project demonstrating understanding of Profound's AEO platform, ChatGPT shopping mechanics, and the growing unsolicited recommendation opportunity.*
