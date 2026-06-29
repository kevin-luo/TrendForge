import { createId, TrendForgeError, type TrendItem } from "@trendforge/core";

// DeepSeek web search for product discovery — replaces Product Hunt API dependency

export async function searchProducts(query: string, apiKey: string, baseUrl?: string): Promise<TrendItem[]> {
  if (!apiKey) throw new TrendForgeError("NO_API_KEY", "DeepSeek API key required for product search");
  
  const base = (baseUrl ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  const system = `You are a product research assistant with web search capability.
Search the web for products matching the user's query. For each product found, extract structured data.
Always include a direct image URL (JPG/PNG/WEBP format, not webpage URLs) for each product.`;

  const user = `Find products matching: "${query}"
For each product, output exactly in this format (one product per line, fields separated by triple pipes):
NAME ||| URL ||| IMAGE_URL ||| DESCRIPTION ||| VOTES ||| CATEGORY
Where IMAGE_URL is a direct link to a product image/screenshot (must be .jpg/.png/.webp extension or a known CDN image URL).
List up to 8 products. Search Product Hunt, GitHub, and tech news sites.`;

  const response = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 3000,
      enable_search: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TrendForgeError("DEEPSEEK_SEARCH_ERROR", "Product search failed", { status: response.status, body }, response.status);
  }

  const data = await response.json() as any;
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new TrendForgeError("EMPTY_RESULT", "No product data returned from search");

  const items: TrendItem[] = [];
  const lines = text.split(/\n/).filter(l => l.includes("|||"));
  
  for (const line of lines.slice(0, 8)) {
    const parts = line.split("|||").map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length < 3) continue;
    
    const name = parts[0] ?? "";
    const url = parts[1] ?? "";
    const imageUrl = parts[2] ?? "";
    const description = parts[3] ?? "";
    const votes = parseInt(parts[4] ?? "0", 10) || 0;
    const category = parts[5] ?? "";

    // Validate image URL looks like an actual image
    const hasImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(imageUrl) || 
                     imageUrl.includes("ph-files.imgix.net") ||
                     imageUrl.includes("producthunt.com") ||
                     imageUrl.includes("cdn.") ||
                     imageUrl.includes("media.");

    items.push({
      id: createId(),
      source: "deepseek-search",
      title: name,
      url: url || "https://example.com",
      summary: description,
      content: description,
      author: category || "Unknown",
      score: votes,
      comments: Math.round(votes * 0.15),
      rank: items.length + 1,
      raw: { imageUrl: hasImage ? imageUrl : "", sourceUrl: url }
    });
  }

  return items.slice(0, 6);
}
