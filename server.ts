import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  addCashFlowEntry,
  createProduct,
  deleteProduct,
  getLoyaltyWallet,
  listCashFlowAndAnalytics,
  listOrders,
  listProducts,
  placeOrder,
  redeemWalletPointsForCode,
  trackOrderByCode,
  updateOrderStatus,
  updateProduct,
  validateDiscountCode,
} from './src/db/repository.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { AuthRequest, optionalAuth, requireAuth } from './src/middleware/auth.ts';
import { formatCsvReport, OrderStatus } from './src/utils/commerce.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_COORDS = {
  latitude: 35.6767441,
  longitude: 10.0935975,
};

function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('rate-limit')
  );
}

interface CachedStoreMapsPayload {
  quotaExceeded: boolean;
  store: Record<string, unknown>;
  photos: Array<{ url: string; attributions: Array<{ displayName: string; uri: string }> }>;
  groundingSummary: string;
  groundingLinks: Array<{ title: string; uri: string; snippet?: string }>;
}

const STORE_MAPS_CACHE_TTL_MS = 15 * 60 * 1000;
const GROUNDING_COOLDOWN_MS = 10 * 60 * 1000;
let storeMapsCache: { data: CachedStoreMapsPayload; expiresAt: number } | null = null;
let storeMapsInFlight: Promise<CachedStoreMapsPayload> | null = null;
let groundingCooldownUntil = 0;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, store: 'Gentleman Atelier — Kairouan' });
  });

  // Sync Firebase Auth user to Cloud SQL
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await getOrCreateUser(
        req.user.uid,
        req.user.email || '',
        req.user.name || req.body?.displayName || ''
      );
      res.json({ user });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to sync user';
      res.status(500).json({ error: msg });
    }
  });

  // Catalog
  app.get('/api/products', async (_req, res) => {
    try {
      const items = await listProducts();
      res.json({ products: items });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load catalog';
      res.status(500).json({ error: msg });
    }
  });

  // Loyalty wallet & 10-pt redemption
  app.get('/api/loyalty/:phone', async (req, res) => {
    try {
      const wallet = await getLoyaltyWallet(req.params.phone);
      res.json({ wallet });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch loyalty wallet';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/loyalty/redeem', async (req, res) => {
    try {
      const result = await redeemWalletPointsForCode(String(req.body?.phone ?? ''));
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Redemption failed';
      const status = msg.includes('10 loyalty points') || msg.includes('Valid phone') ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/discount/validate', async (req, res) => {
    try {
      const code = await validateDiscountCode(String(req.body?.code ?? ''));
      if (!code) {
        return res.json({ valid: false, discount: null, error: 'Code not found or already redeemed.' });
      }
      res.json({ valid: true, discount: code });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Validation failed';
      res.status(500).json({ error: msg });
    }
  });

  // Checkout & Orders
  app.post('/api/orders', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const result = await placeOrder({
        customerName: String(req.body?.customerName ?? ''),
        customerPhone: String(req.body?.customerPhone ?? ''),
        deliveryAddress: String(req.body?.deliveryAddress ?? ''),
        city: String(req.body?.city ?? ''),
        discountCode: req.body?.discountCode ? String(req.body.discountCode) : undefined,
        userUid: req.user?.uid,
        items: Array.isArray(req.body?.items) ? req.body.items : [],
      });
      res.status(201).json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to place order';
      const isClientErr =
        msg.includes('required') ||
        msg.includes('empty') ||
        msg.includes('stock') ||
        msg.includes('Discount code') ||
        msg.includes('not found');
      res.status(isClientErr ? 400 : 500).json({ error: msg });
    }
  });

  app.get('/api/orders/track/:code', async (req, res) => {
    try {
      const order = await trackOrderByCode(req.params.code);
      if (!order) {
        return res.status(404).json({ error: 'Order code not found.' });
      }
      res.json({ order });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tracking lookup failed';
      res.status(500).json({ error: msg });
    }
  });

  // Owner Studio: Analytics, Inventory, Orders & Cashflow
  app.get('/api/admin/overview', async (_req, res) => {
    try {
      const data = await listCashFlowAndAnalytics();
      res.json(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load dashboard';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/products', async (req, res) => {
    try {
      const body = req.body ?? {};
      if (!body.name || !body.category || !body.priceTnd) {
        return res.status(400).json({ error: 'Name, category, and price are required.' });
      }
      const created = await createProduct({
        name: String(body.name),
        category: String(body.category),
        description: String(body.description || 'Crafted menswear piece from Gentleman Kairouan.'),
        priceTnd: Number(body.priceTnd),
        costTnd: Number(body.costTnd ?? Math.round(Number(body.priceTnd) * 0.55)),
        stock: Number(body.stock ?? 10),
        pointsReward: Number(body.pointsReward ?? 4),
        sizes: Array.isArray(body.sizes) ? body.sizes : ['S', 'M', 'L', 'XL'],
        colors: Array.isArray(body.colors)
          ? body.colors
          : [{ name: 'Obsidian', hex: '#1B1E24' }],
        garmentType: String(body.garmentType || 'blazer'),
        imageKey: String(body.imageKey || 'garment_tailored_blazer'),
        featured: Boolean(body.featured ?? true),
      });
      res.status(201).json({ product: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to add product';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/products/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid product ID' });
      const patch: Record<string, unknown> = {};
      if (req.body?.name !== undefined) patch.name = String(req.body.name);
      if (req.body?.category !== undefined) patch.category = String(req.body.category);
      if (req.body?.priceTnd !== undefined) patch.priceTnd = Number(req.body.priceTnd);
      if (req.body?.costTnd !== undefined) patch.costTnd = Number(req.body.costTnd);
      if (req.body?.stock !== undefined) patch.stock = Number(req.body.stock);
      if (req.body?.pointsReward !== undefined) patch.pointsReward = Number(req.body.pointsReward);
      const updated = await updateProduct(id, patch);
      if (!updated) return res.status(404).json({ error: 'Product not found' });
      res.json({ product: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update product';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/admin/products/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const deleted = await deleteProduct(id);
      if (!deleted) return res.status(404).json({ error: 'Product not found' });
      res.json({ deleted });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete product';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/orders/:id/status', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const status = String(req.body?.status ?? '') as OrderStatus;
      if (!['confirmed', 'tailoring', 'dispatched', 'delivered'].includes(status)) {
        return res.status(400).json({ error: 'Invalid order status' });
      }
      const result = await updateOrderStatus(id, status);
      if (!result) return res.status(404).json({ error: 'Order not found' });
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update status';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/ledger', async (req, res) => {
    try {
      const body = req.body ?? {};
      if (!body.description || !body.amountTnd || !['income', 'expense'].includes(body.entryType)) {
        return res.status(400).json({ error: 'Valid entryType, description, and amountTnd required.' });
      }
      const created = await addCashFlowEntry({
        entryType: body.entryType,
        category: String(body.category || (body.entryType === 'income' ? 'Sale' : 'Atelier Expense')),
        description: String(body.description),
        amountTnd: Number(body.amountTnd),
        referenceCode: String(body.referenceCode || ''),
        entryDate: String(body.entryDate || new Date().toISOString().slice(0, 10)),
      });
      res.status(201).json({ entry: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to add ledger entry';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/admin/export/:type', async (req, res) => {
    try {
      const type = req.params.type;
      if (type === 'orders') {
        const rows = await listOrders();
        const csv = formatCsvReport(
          ['Order Code', 'Customer', 'Phone', 'City', 'Subtotal (TND)', 'Discount (TND)', 'Shipping (TND)', 'Total (TND)', 'Points Earned', 'Status', 'Date'],
          rows.map((o) => [
            o.orderCode,
            o.customerName,
            o.customerPhone,
            o.city,
            o.subtotalTnd,
            o.discountTnd,
            o.shippingTnd,
            o.totalTnd,
            o.pointsEarned,
            o.status,
            o.createdAt?.toISOString().slice(0, 10) ?? '',
          ])
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="gentleman-orders.csv"');
        return res.send(csv);
      }

      if (type === 'inventory') {
        const rows = await listProducts();
        const csv = formatCsvReport(
          ['ID', 'Name', 'Category', 'Price (TND)', 'Cost (TND)', 'Margin (TND)', 'Stock', 'Points Reward'],
          rows.map((p) => [
            p.id,
            p.name,
            p.category,
            p.priceTnd,
            p.costTnd,
            p.priceTnd - p.costTnd,
            p.stock,
            p.pointsReward,
          ])
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="gentleman-inventory.csv"');
        return res.send(csv);
      }

      if (type === 'cashflow') {
        const { entries } = await listCashFlowAndAnalytics();
        const csv = formatCsvReport(
          ['Date', 'Type', 'Category', 'Description', 'Reference', 'Amount (TND)'],
          entries.map((e) => [
            e.entryDate,
            e.entryType,
            e.category,
            e.description,
            e.referenceCode,
            e.entryType === 'income' ? e.amountTnd : -e.amountTnd,
          ])
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="gentleman-cashflow.csv"');
        return res.send(csv);
      }

      res.status(400).json({ error: 'Invalid export type' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Export failed';
      res.status(500).json({ error: msg });
    }
  });

  // Google Maps Places (New) + Gemini Maps Grounding for Gentleman Kairouan (cached + 429 backoff)
  app.get('/api/store/maps-info', async (_req, res) => {
    try {
      const now = Date.now();
      if (storeMapsCache && storeMapsCache.expiresAt > now) {
        return res.json(storeMapsCache.data);
      }

      if (!storeMapsInFlight) {
        storeMapsInFlight = (async (): Promise<CachedStoreMapsPayload> => {
          const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
          let placeData: Record<string, unknown> | null = null;
          let photos: Array<{ url: string; attributions: Array<{ displayName: string; uri: string }> }> = [];
          let quotaExceeded = false;

          if (mapsKey && mapsKey !== 'MY_GOOGLE_MAPS_API_KEY') {
            try {
              const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': mapsKey,
                  'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
                  'X-Goog-FieldMask':
                    'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.regularOpeningHours,places.googleMapsUri,places.photos,places.location',
                },
                body: JSON.stringify({
                  textQuery: 'Gentleman Kairouan clothing store',
                  locationBias: {
                    circle: {
                      center: STORE_COORDS,
                      radius: 1500.0,
                    },
                  },
                  pageSize: 3,
                }),
              });

              if (searchRes.status === 429) {
                quotaExceeded = true;
              } else if (searchRes.ok) {
                const json = (await searchRes.json()) as { places?: Array<Record<string, any>> };
                const best = json.places?.[0];
                if (best) {
                  placeData = {
                    id: best.id,
                    name: best.displayName?.text || 'Gentleman',
                    address: best.formattedAddress || 'Kairouan, Tunisia',
                    rating: best.rating,
                    userRatingCount: best.userRatingCount,
                    googleMapsUri: best.googleMapsUri || 'https://maps.app.goo.gl/kNZD5xJUovHBy7aP6',
                    openingHours: best.regularOpeningHours?.weekdayDescriptions || [],
                    location: best.location || STORE_COORDS,
                  };

                  const rawPhotos = Array.isArray(best.photos) ? best.photos.slice(0, 4) : [];
                  const photoPromises = rawPhotos.map(async (p: any) => {
                    try {
                      const mediaRes = await fetch(
                        `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=900&skipHttpRedirect=true`,
                        {
                          headers: {
                            'X-Goog-Api-Key': mapsKey,
                            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
                          },
                        }
                      );
                      if (mediaRes.ok) {
                        const mediaJson = (await mediaRes.json()) as { photoUri?: string };
                        if (mediaJson.photoUri) {
                          return {
                            url: mediaJson.photoUri,
                            attributions: Array.isArray(p.authorAttributions)
                              ? p.authorAttributions.map((a: any) => ({
                                  displayName: a.displayName || 'Google Maps Contributor',
                                  uri: a.uri || 'https://maps.google.com',
                                }))
                              : [],
                          };
                        }
                      }
                    } catch {
                      // Skip failed photo fetch
                    }
                    return null;
                  });
                  photos = (await Promise.all(photoPromises)).filter(
                    (x): x is { url: string; attributions: Array<{ displayName: string; uri: string }> } =>
                      x !== null
                  );
                }
              }
            } catch {
              // Places lookup failed gracefully; fallback metadata below
            }
          }

          // Maps Grounding via gemini-4-hydrogen (skipped during 429 cooldown)
          let groundingSummary = '';
          const groundingLinks: Array<{ title: string; uri: string; snippet?: string }> = [];
          const ai = getGeminiClient();
          if (ai && Date.now() >= groundingCooldownUntil) {
            try {
              const response = await ai.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents:
                  'Provide concise location context and nearby landmarks for the Gentleman clothing boutique in Kairouan, Tunisia near 35.6767, 10.0936.',
                config: {
                  tools: [{ googleMaps: {} }],
                  toolConfig: {
                    retrievalConfig: {
                      latLng: STORE_COORDS,
                    },
                  },
                },
              });
              groundingSummary = response.text || '';
              const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
              for (const chunk of chunks as Array<any>) {
                if (chunk.maps?.uri) {
                  groundingLinks.push({
                    title: chunk.maps.title || 'Google Maps Place',
                    uri: chunk.maps.uri,
                    snippet: chunk.maps.placeAnswerSources?.reviewSnippets?.[0]?.snippet,
                  });
                }
              }
            } catch (err) {
              if (isQuotaError(err)) {
                groundingCooldownUntil = Date.now() + GROUNDING_COOLDOWN_MS;
              }
            }
          }

          const payload: CachedStoreMapsPayload = {
            quotaExceeded,
            store: placeData ?? {
              name: 'Gentleman Atelier — Kairouan',
              address: 'Avenue Abi Zammaa El Balaoui, Kairouan 3100, Tunisia',
              googleMapsUri: 'https://maps.app.goo.gl/kNZD5xJUovHBy7aP6',
              location: STORE_COORDS,
              openingHours: [
                'Monday - Saturday: 09:30 - 20:30',
                'Sunday: 10:00 - 16:00',
              ],
            },
            photos,
            groundingSummary:
              groundingSummary ||
              'Located in central Kairouan near Avenue Abi Zammaa El Balaoui and the historic Medina quarter, with same-day local tailoring pickup and nationwide courier dispatch.',
            groundingLinks:
              groundingLinks.length > 0
                ? groundingLinks
                : [
                    {
                      title: 'Gentleman Boutique — Kairouan (Google Maps)',
                      uri: 'https://maps.app.goo.gl/kNZD5xJUovHBy7aP6',
                    },
                  ],
          };

          storeMapsCache = {
            data: payload,
            expiresAt: Date.now() + STORE_MAPS_CACHE_TTL_MS,
          };
          return payload;
        })().finally(() => {
          storeMapsInFlight = null;
        });
      }

      const result = await storeMapsInFlight;
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to load store location info';
      res.status(500).json({ error: msg });
    }
  });

  // Multi-turn Gemini Stylist Chatbot (gemini-4-hydrogen)
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini AI is not configured. Add GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const message = String(req.body?.message ?? '').trim();
      if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
      }

      const catalog = await listProducts();
      const catalogBrief = catalog
        .map(
          (p) =>
            `- ${p.name} (${p.category}): ${p.priceTnd} TND, ${p.stock} in stock, earns +${p.pointsReward} loyalty pts`
        )
        .join('\n');

      const chat = ai.chats.create({
        model: 'gemini-4-hydrogen',
        config: {
          systemInstruction: `You are the Gentleman Atelier Kairouan personal menswear stylist and concierge.
You speak warmly and professionally in the user's language (English, French, or Tunisian Darija).
Key Store Facts:
- Boutique: Gentleman Atelier, Kairouan, Tunisia (https://maps.app.goo.gl/kNZD5xJUovHBy7aP6)
- Loyalty Program: Every garment purchased earns loyalty points. Reaching 10 points unlocks a 10% OFF promo code (GENT10-XXXX) for the next purchase.
- Shipping: Free inside Kairouan and on orders >= 350 TND across Tunisia; otherwise 8 TND. Personalized WhatsApp confirmation & tracking updates are sent for every order.
Current Catalog:
${catalogBrief}
Keep advice practical, concise, and tailored.`,
        },
        history: history.map((h: { role: string; text: string }) => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }],
        })),
      });

      const response = await chat.sendMessage({ message });
      res.json({ reply: response.text || 'How can I assist with your wardrobe today?' });
    } catch (error: unknown) {
      if (isQuotaError(error)) {
        return res.status(429).json({
          error: 'The AI Stylist reached its temporary rate limit. Please wait a moment and try again.',
        });
      }
      const msg = error instanceof Error ? error.message : 'Stylist request failed';
      res.status(500).json({ error: msg });
    }
  });

  // High-Thinking Owner Financial & Inventory Insights (gemini-4-hydrogen + ThinkingLevel.HIGH)
  app.post('/api/ai/owner-insights', async (_req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini AI is not configured. Add GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const data = await listCashFlowAndAnalytics();
      const prompt = `Analyze this live store data for Gentleman Atelier (Kairouan, Tunisia) and give 4 concrete, numbered executive recommendations covering cash flow (money in vs money out), low-stock restock priorities, margin optimization, and loyalty retention:
Summary: Income ${data.summary.totalIncome} TND, Expenses ${data.summary.totalExpenses} TND, Net Profit ${data.summary.netProfit} TND (${data.summary.profitMarginPct}% margin).
Inventory: ${data.products.map((p) => `${p.name}: price ${p.priceTnd} TND, cost ${p.costTnd} TND, stock ${p.stock}`).join('; ')}
Recent Orders: ${data.orders.length} orders, ${data.loyaltyCount} active loyalty wallets.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          systemInstruction:
            'You are a sharp retail CFO and menswear merchandiser advising a Tunisian boutique owner. Be concise, quantitative, and practical.',
        },
      });

      res.json({ analysis: response.text || 'No insights generated.' });
    } catch (error: unknown) {
      if (isQuotaError(error)) {
        return res.status(429).json({
          error: 'AI financial analysis is temporarily rate-limited. Try again in a minute or add a billing-enabled key in Settings > Secrets.',
        });
      }
      const msg = error instanceof Error ? error.message : 'Analysis failed';
      res.status(500).json({ error: msg });
    }
  });

  // Lookbook Image Generation / Editing endpoint
  app.post('/api/ai/lookbook-edit', async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key not available.',
        });
      }
      const prompt = String(req.body?.prompt ?? '').trim();
      if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: { parts: [{ text: `Luxury menswear editorial studio photography: ${prompt}` }] },
        config: {
          imageConfig: {
            aspectRatio: '4:3',
            imageSize: '1K',
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          return res.json({ imageUrl: `data:${mime};base64,${part.inlineData.data}` });
        }
      }
      res.status(500).json({ error: 'No image returned from model.' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Image generation unavailable';
      const needsPaid =
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('403') ||
        msg.includes('429') ||
        msg.includes('paid');
      res.status(needsPaid ? 402 : 500).json({
        paidKeyRequired: needsPaid,
        error: needsPaid
          ? 'AI Lookbook image generation requires a billing-enabled API key in Settings > Secrets. Use the real-time 3D Garment Studio snapshot below in the meantime.'
          : msg,
      });
    }
  });

  // Vite or Static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // Live API WebSocket bridge for real-time voice conversations (gemini-3.8-live)
  const wss = new WebSocketServer({ server, path: '/live-stylist' });
  wss.on('connection', async (clientWs: WebSocket) => {
    const ai = getGeminiClient();
    if (!ai) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY not configured.' }));
      clientWs.close();
      return;
    }

    let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    try {
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
          },
          systemInstruction:
            'You are Gentleman Atelier Kairouan voice stylist. Help shoppers pick menswear, explain the 10-point 10% loyalty reward, and assist with order tracking warmly in English, French, or Tunisian Darija.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err) => {
            console.error('Gemini Live error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: 'Voice session error.' }));
            }
          },
        },
      });
      clientWs.send(JSON.stringify({ ready: true }));
    } catch (err) {
      console.error('Failed to connect Gemini Live:', err);
      clientWs.send(JSON.stringify({ error: 'Unable to open live voice session.' }));
      clientWs.close();
      return;
    }

    clientWs.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as { audio?: string; text?: string };
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (parsed.text && session) {
          session.sendRealtimeInput({ text: parsed.text });
        }
      } catch {
        // Ignore malformed frames
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // Ignore close error
      }
    });
  });

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Gentleman Atelier server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
