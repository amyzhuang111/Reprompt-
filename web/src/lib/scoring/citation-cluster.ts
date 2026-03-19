// Citation cluster scorer: maps queries to co-citation verticals.

export const CO_CITATION_MAP = {
  verticals: [
    {
      name: "personal_finance",
      co_citation_rate: 0.14,
      keywords: ["credit card", "loan", "mortgage", "banking", "invest", "savings", "finance", "insurance", "refinance", "debt", "budget", "retirement", "401k", "ira", "stock", "crypto", "rewards", "annual fee", "apr", "interest rate"],
      domains: ["NerdWallet", "The Points Guy", "Bankrate", "Credit Karma"],
    },
    {
      name: "tech_electronics",
      co_citation_rate: 0.10,
      keywords: ["laptop", "phone", "tablet", "headphone", "speaker", "camera", "monitor", "keyboard", "mouse", "tv", "smartwatch", "earbuds", "router", "charger", "gaming", "console", "gpu", "processor", "ssd", "tech"],
      domains: ["The Verge", "TechRadar", "Tom's Guide", "CNET", "Wirecutter"],
    },
    {
      name: "health_wellness",
      co_citation_rate: 0.07,
      keywords: ["health", "supplement", "vitamin", "sleep", "wellness", "fitness", "exercise", "nutrition", "diet", "protein", "omega", "probiotic", "melatonin", "medication", "therapy", "mental health", "anxiety", "stress"],
      domains: ["NIH", "WebMD", "Mayo Clinic", "Healthline"],
    },
    {
      name: "home_lifestyle",
      co_citation_rate: 0.08,
      keywords: ["furniture", "sofa", "couch", "desk", "chair", "mattress", "pillow", "rug", "lamp", "shelf", "organizer", "storage", "kitchen", "bathroom", "bedroom", "living room", "home office", "decor", "cleaning", "garden"],
      domains: ["Wirecutter", "The Spruce", "Better Homes & Gardens", "HGTV"],
    },
    {
      name: "travel",
      co_citation_rate: 0.06,
      keywords: ["flight", "hotel", "travel", "vacation", "trip", "booking", "airfare", "resort", "cruise", "luggage", "backpack", "destination", "itinerary", "passport", "visa", "airline"],
      domains: ["Kayak", "Expedia", "TripAdvisor", "Lonely Planet"],
    },
  ],
};

export function identifyCluster(query: string): { name: string; domains: string[] } {
  const q = query.toLowerCase();
  let bestCluster = "";
  let bestDomains: string[] = [];
  let bestHits = 0;

  for (const vertical of CO_CITATION_MAP.verticals) {
    const hits = vertical.keywords.filter(kw => {
      const re = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
      return re.test(q);
    }).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestCluster = vertical.name;
      bestDomains = vertical.domains;
    }
  }
  return { name: bestCluster, domains: bestDomains };
}

export function score(query: string): number {
  let s = 0;
  const q = query.toLowerCase();
  const { name } = identifyCluster(query);
  if (name) s += 40;
  if (/\b(compared|vs|versus|top rated|review|rated|ranking)\b/.test(q)) s += 30;
  if (/\b(best|top|recommended)\b/.test(q) && q.split(/\s+/).length >= 5) s += 30;
  if (/\b(what is|define|meaning of|history of)\b/.test(q)) s -= 20;
  return Math.max(0, Math.min(100, s));
}
