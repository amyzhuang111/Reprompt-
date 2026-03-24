// Category-driven scoring system
// Based on Profound's March 2026 research: shopping triggers are CATEGORY-driven,
// not intent-driven. Their 4-gate decision tree achieves 95-96% accuracy.

// ---------------------------------------------------------------------------
// 1. Category definitions with base trigger rates and keyword lists
// ---------------------------------------------------------------------------

export interface CategoryInfo {
  category: string;
  baseRate: number;
  displayName: string;
  keywords: string[];
}

const CATEGORIES: CategoryInfo[] = [
  {
    category: "apparel_fashion",
    baseRate: 62,
    displayName: "Apparel & Fashion",
    keywords: [
      "clothing", "clothes", "shoes", "sneakers", "boots", "jacket", "coat",
      "dress", "shirt", "blouse", "pants", "jeans", "shorts", "skirt",
      "hat", "cap", "beanie", "sunglasses", "watch", "watches", "jewelry",
      "necklace", "bracelet", "ring", "earrings", "handbag", "purse",
      "wallet", "belt", "scarf", "gloves", "socks", "underwear", "bra",
      "leggings", "hoodie", "sweater", "cardigan", "blazer", "suit",
      "tie", "sandals", "heels", "loafers", "slippers", "activewear",
      "swimsuit", "bikini", "outfit", "fashion", "apparel", "wardrobe",
      "denim", "leather jacket", "running shoes", "trainers",
    ],
  },
  {
    category: "physical_products",
    baseRate: 56,
    displayName: "Physical Products",
    keywords: [
      "laptop", "phone", "smartphone", "headphones", "earbuds", "chair",
      "desk", "mattress", "pillow", "camera", "speaker", "monitor",
      "keyboard", "mouse", "blender", "vacuum", "air fryer", "organizer",
      "lamp", "shelf", "backpack", "tablet", "tv", "television",
      "router", "charger", "console", "gpu", "processor", "ssd",
      "printer", "projector", "microphone", "webcam", "drone", "tripod",
      "sofa", "couch", "rug", "curtain", "fan", "heater",
      "air purifier", "humidifier", "dehumidifier", "toaster", "oven",
      "dishwasher", "washing machine", "dryer", "refrigerator", "fridge",
      "freezer", "stroller", "car seat", "crib", "baby monitor",
      "power bank", "cable", "adapter", "stand", "mount", "holder",
      "tool", "drill", "saw", "wrench", "screwdriver", "gadget",
      "appliance", "furniture", "cookware", "pan", "pot", "knife",
      "cutting board", "scale", "thermometer", "grill", "smoker",
      "pressure cooker", "instant pot", "espresso machine", "coffee maker",
      "water bottle", "thermos", "lunchbox", "cooler",
    ],
  },
  {
    category: "consumables",
    baseRate: 30,
    displayName: "Consumables",
    keywords: [
      "vitamins", "vitamin", "supplements", "supplement", "protein",
      "protein powder", "creatine", "pre-workout", "bcaa", "collagen",
      "coffee", "tea", "snacks", "groceries", "food", "drinks",
      "shampoo", "conditioner", "soap", "body wash", "lotion",
      "moisturizer", "sunscreen", "toothpaste", "mouthwash",
      "deodorant", "cleaning supplies", "detergent", "disinfectant",
      "paper towels", "trash bags", "batteries", "light bulbs",
      "candles", "air freshener", "pet food", "dog food", "cat food",
      "baby formula", "diapers", "wipes", "sleep", "sleep aid", "skincare", "serum",
      "face wash", "toner", "eye cream", "lip balm", "makeup",
      "foundation", "mascara", "concealer", "perfume", "cologne",
      "fragrance", "whey", "omega", "probiotic", "melatonin",
      "electrolytes", "energy drink", "snack bar", "granola",
    ],
  },
  {
    category: "health_medical",
    baseRate: 6,
    displayName: "Health & Medical",
    keywords: [
      "medication", "prescription", "therapy", "treatment",
      "medical device", "blood pressure", "insulin", "glucose monitor",
      "cpap", "hearing aid", "wheelchair", "crutches", "brace",
      "bandage", "first aid", "otc", "over the counter",
      "antibiotic", "painkiller", "antidepressant", "inhaler",
      "epipen", "nebulizer", "thermometer medical", "stethoscope",
      "diagnosis", "symptom", "doctor", "physician", "surgery",
      "hospital", "clinic", "rehabilitation", "physical therapy",
      "mental health", "psychiatrist", "psychologist", "counseling",
    ],
  },
  {
    category: "vehicle_equipment",
    baseRate: 2,
    displayName: "Vehicle & Equipment",
    keywords: [
      "car", "truck", "motorcycle", "suv", "sedan", "minivan",
      "tractor", "generator", "industrial", "heavy machinery",
      "forklift", "excavator", "bulldozer", "crane", "compressor",
      "welder", "lathe", "cnc", "vehicle", "automobile", "rv",
      "trailer", "boat", "atv", "snowmobile", "jet ski",
      "lawn mower", "snow blower", "chainsaw", "log splitter",
    ],
  },
  {
    category: "travel",
    baseRate: 0.6,
    displayName: "Travel",
    keywords: [
      "flight", "flights", "hotel", "hotels", "resort", "cruise",
      "vacation", "airfare", "booking", "airline", "airport",
      "destination", "itinerary", "passport", "visa", "travel",
      "trip", "tour", "hostel", "airbnb", "rental car",
      "luggage", "suitcase", "carry on", "backpacking",
      "all inclusive", "getaway", "excursion", "transit",
    ],
  },
  {
    category: "services",
    baseRate: 0.5,
    displayName: "Services",
    keywords: [
      "plumber", "plumbing", "lawyer", "attorney", "contractor",
      "consultant", "cleaning service", "tutoring", "tutor",
      "accountant", "electrician", "mechanic", "landscaper",
      "painter", "mover", "moving service", "catering",
      "photographer", "videographer", "web designer", "developer",
      "personal trainer", "real estate agent", "realtor",
      "babysitter", "nanny", "pet sitter", "dog walker",
      "handyman", "interior designer", "architect",
      "therapist", "dentist", "orthodontist", "chiropractor",
      "hire", "service provider", "agency",
    ],
  },
  {
    category: "software",
    baseRate: 0.1,
    displayName: "Software & SaaS",
    keywords: [
      "app", "software", "saas", "subscription", "plugin",
      "platform", "crm", "erp", "api", "cloud",
      "hosting", "domain", "website builder", "cms",
      "project management", "productivity tool", "automation",
      "analytics", "dashboard", "workflow", "integration",
      "vpn", "antivirus", "password manager", "backup",
      "ide", "code editor", "database", "devops",
      "ai tool", "chatbot", "no-code", "low-code",
    ],
  },
  {
    category: "financial",
    baseRate: 0,
    displayName: "Financial Products",
    keywords: [
      "credit card", "loan", "mortgage", "insurance",
      "banking", "investment", "invest", "savings account",
      "checking account", "refinance", "debt", "retirement",
      "401k", "ira", "stock", "stocks", "bond", "bonds",
      "mutual fund", "etf", "crypto", "cryptocurrency", "bitcoin",
      "rewards card", "annual fee", "apr", "interest rate",
      "portfolio", "brokerage", "annuity", "life insurance",
      "auto insurance", "health insurance", "home insurance",
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. Category classifier
// ---------------------------------------------------------------------------

export function classifyCategory(query: string): {
  category: string;
  baseRate: number;
  displayName: string;
} {
  const q = query.toLowerCase();

  let bestCategory: CategoryInfo | null = null;
  let bestHits = 0;

  for (const cat of CATEGORIES) {
    let hits = 0;
    for (const kw of cat.keywords) {
      // Build a word-boundary regex for multi-word and single-word keywords
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("\\b" + escaped + "\\b");
      if (re.test(q)) {
        hits++;
      }
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestCategory = cat;
    }
  }

  if (!bestCategory || bestHits === 0) {
    return { category: "none", baseRate: 0, displayName: "Uncategorized" };
  }

  return {
    category: bestCategory.category,
    baseRate: bestCategory.baseRate,
    displayName: bestCategory.displayName,
  };
}

// ---------------------------------------------------------------------------
// 3. ScoreBreakdown interface (new fields + deprecated old fields)
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  // --- New category-driven fields ---
  category: string;
  category_base_rate: number;
  commercial_intent: number;
  product_specificity: number;
  composite: number;

  // --- Deprecated legacy fields (kept for backward compatibility) ---
  lexical: number;
  structural: number;
  specificity: number;
  shopping_proxy: number;
  citation_cluster: number;
  turn1_fitness: number;
}

// ---------------------------------------------------------------------------
// 4. Signal detectors
// ---------------------------------------------------------------------------

const COMMERCIAL_INTENT_PATTERNS: RegExp[] = [
  /\b(best|top)\b/,
  /\bbuy\b/,
  /\brecommend(ed|ation|ations)?\b/,
  /\bwhich (should|one|do)\b/,
  /\bcompare\b/,
  /\bcomparison\b/,
  /\bvs\.?\b/,
  /\bversus\b/,
  /\bworth (it|buying|getting)\b/,
  /\bshould i (get|buy|choose)\b/,
  /\btop[- ]rated\b/,
  /\bhighest[- ]rated\b/,
  /\bmost popular\b/,
  /\bwhere (to|can i) buy\b/,
  /\bdeal(s)?\b/,
  /\bdiscount(s)?\b/,
  /\bcoupon(s)?\b/,
  /\bcheap(est|er)?\b/,
  /\baffordable\b/,
  /\bbudget\b/,
  /\bunder \$?\d/,
  /\bfor (the |a )?price\b/,
  /\bbang for (the |your )?buck\b/,
  /\breview(s|ed)?\b/,
  /\brated\b/,
  /\branking(s)?\b/,
  /\balternative(s)?\b/,
  /\breplacement(s)?\b/,
  /\bupgrade\b/,
];

const INFORMATIONAL_PATTERNS: RegExp[] = [
  /\bwhat is\b/,
  /\bwhat are\b/,
  /\bhow does\b/,
  /\bhow do\b/,
  /\bhow to\b/,
  /\bexplain\b/,
  /\bdefine\b/,
  /\bdefinition\b/,
  /\bmeaning of\b/,
  /\bhistory of\b/,
  /\bwhy (does|do|is|are)\b/,
  /\bdifference between\b/,
  /\bpurpose of\b/,
  /\bwho (is|was|invented)\b/,
  /\bwhen (did|was|is)\b/,
  /\bcan you (explain|tell me about|describe)\b/,
];

const PRICE_PATTERNS: RegExp[] = [
  /\$\d+/,
  /\bunder \$?\d/,
  /\bover \$?\d/,
  /\baround \$?\d/,
  /\bprice(d|s)?\b/,
  /\bcost(s|ing)?\b/,
  /\bbudget\b/,
  /\baffordable\b/,
  /\bcheap\b/,
];

/**
 * The "Amazon test": does this query sound like something you'd type into Amazon?
 * Checks for product-noun + modifier patterns typical of Amazon searches.
 */
function passesAmazonTest(query: string): boolean {
  const q = query.toLowerCase();

  // Pattern: "best X for Y", "X under $Y", "top X", specific product noun present
  if (/\bbest \w+/.test(q)) return true;
  if (/\btop \d+ \w+/.test(q)) return true;
  if (/\w+ under \$?\d/.test(q)) return true;
  if (/\bbuy(ing)? (a |an |the )?\w+/.test(q)) return true;

  // Check if any product-category keyword is present alongside a modifier
  const hasProductKeyword = CATEGORIES.some(
    (cat) =>
      cat.category !== "services" &&
      cat.category !== "software" &&
      cat.category !== "financial" &&
      cat.category !== "travel" &&
      cat.keywords.some((kw) => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp("\\b" + escaped + "\\b").test(q);
      })
  );

  const hasShoppingModifier =
    /\b(best|top|good|great|recommended|for|under|cheap|affordable|rated|review|buy|new|quality|durable|lightweight|portable|premium|professional)\b/.test(
      q
    );

  return hasProductKeyword && hasShoppingModifier;
}

function measureCommercialIntent(query: string): number {
  const q = query.toLowerCase();
  let score = 0;
  let hits = 0;

  for (const pattern of COMMERCIAL_INTENT_PATTERNS) {
    if (pattern.test(q)) {
      hits++;
    }
  }

  // Scale: 1 hit = 30, 2 = 55, 3 = 75, 4+ = 90
  if (hits >= 4) score = 90;
  else if (hits === 3) score = 75;
  else if (hits === 2) score = 55;
  else if (hits === 1) score = 30;

  return Math.min(100, score);
}

function measureProductSpecificity(query: string): number {
  const q = query.toLowerCase();
  let score = 0;

  // Check if a specific product noun is named (not just a category)
  const hasProductNoun = CATEGORIES.some((cat) =>
    cat.keywords.some((kw) => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp("\\b" + escaped + "\\b").test(q);
    })
  );
  if (hasProductNoun) score += 40;

  // Brand-like capitalized words or specific model references
  if (/\b[A-Z][a-zA-Z]+\s[A-Z0-9]/.test(query)) score += 20;

  // Specific numeric specs (e.g., "15 inch", "256gb", "4k")
  if (/\b\d+\s?(inch|gb|tb|mp|hz|watts?|lbs?|oz|mm|cm)\b/i.test(q))
    score += 20;

  // Material or feature specifics
  if (
    /\b(stainless steel|memory foam|noise cancell?ing|wireless|bluetooth|usb-c|oled|led|mechanical|ergonomic|organic|waterproof)\b/i.test(
      q
    )
  )
    score += 20;

  return Math.min(100, score);
}

function isInformational(query: string): boolean {
  const q = query.toLowerCase();
  return INFORMATIONAL_PATTERNS.some((p) => p.test(q));
}

function hasPriceMention(query: string): boolean {
  const q = query.toLowerCase();
  return PRICE_PATTERNS.some((p) => p.test(q));
}

// ---------------------------------------------------------------------------
// 5. Main scorer: 4-gate category-driven decision tree
// ---------------------------------------------------------------------------

export function scoreQuery(query: string): ScoreBreakdown {
  // Gate 1: Classify category and get base trigger rate
  const { category, baseRate } = classifyCategory(query);

  // Gate 2: Measure commercial intent
  const commercialIntent = measureCommercialIntent(query);

  // Gate 3: Measure product specificity
  const productSpecificity = measureProductSpecificity(query);

  // Gate 4: Apply modifiers to base rate
  let score = baseRate;

  // Commercial intent amplifier (research: 76% with intent vs 17% without for product cats)
  if (commercialIntent > 0) {
    const intentMultiplier = 1 + (commercialIntent / 100) * 3; // 1x to 4x
    score = score * intentMultiplier;
  }

  // Product specificity bonus
  if (productSpecificity >= 40) {
    score += 15;
  }

  // Price mention bonus
  if (hasPriceMention(query)) {
    score += 10;
  }

  // Pure informational dampener
  if (isInformational(query) && commercialIntent === 0) {
    score = score * 0.3;
  }

  // The "Amazon test" bonus
  if (passesAmazonTest(query)) {
    score += 20;
  }

  // Problem-to-product patterns (Profound: health 47%, productivity 42%, sleep 41% unsolicited rec rates)
  const problemPatterns = /\b(can't sleep|trouble sleeping|back pain|sore|tired|exhausted|organize|messy|noisy|loud|uncomfortable|sweating|hot sleeper|cold feet|dry skin|acne|hair loss|snoring)\b/i;
  if (problemPatterns.test(query) && baseRate > 0) {
    score += 15;
  }

  // Clamp to 0-95 (cap at 95 per research findings)
  const composite = Math.max(0, Math.min(95, Math.round(score)));

  return {
    // New category-driven fields
    category,
    category_base_rate: baseRate,
    commercial_intent: commercialIntent,
    product_specificity: productSpecificity,
    composite,

    // Deprecated legacy fields (set to 0 for backward compatibility)
    lexical: 0,
    structural: 0,
    specificity: 0,
    shopping_proxy: 0,
    citation_cluster: 0,
    turn1_fitness: 0,
  };
}

// ---------------------------------------------------------------------------
// 6. Re-export legacy utilities so existing imports don't break
// ---------------------------------------------------------------------------

export { identifyCluster } from "./citation-cluster";
export { score as turn1Score } from "./turn1-fitness";
