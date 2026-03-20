import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { drizzle } from "drizzle-orm/d1";
import { eq, isNull, desc } from "drizzle-orm";
import { heroImages } from "../db/schemas/hero_images";
import { Buffer } from "node:buffer";
import { getSecret } from "@/backend/utils/secrets";

const heroImageSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  url: z.string()
});

const heroStateSchema = z.object({
  greeting: z.string(),
  image: heroImageSchema.nullable()
});

const feedbackSchema = z.object({
  id: z.string(),
  rating: z.enum(["up", "down"])
});

export const sessionRoutes = new OpenAPIHono<{ Bindings: Env }>();

const getHeroRoute = createRoute({
  method: "get",
  path: "/hero",
  operationId: "getHero",
  responses: {
    200: {
      description: "Get dynamic greeting and generated hero image.",
      content: {
        "application/json": {
          schema: heroStateSchema,
        },
      },
    },
  },
});

const getHeroImageRoute = createRoute({
  method: "get",
  path: "/hero/image/{id}",
  operationId: "getHeroImage",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Returns the raw image payload",
      content: {
        "image/jpeg": {
          schema: z.any()
        }
      }
    },
    404: {
      description: "Image not found",
      content: {
        "application/json": {
          schema: z.object({ error: z.string() })
        }
      }
    }
  }
});

const feedbackRoute = createRoute({
  method: "post",
  path: "/hero/feedback",
  operationId: "heroFeedback",
  request: {
    body: {
      content: {
        "application/json": {
          schema: feedbackSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Feedback saved",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() })
        }
      }
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() })
        }
      }
    }
  }
});

sessionRoutes.openapi(getHeroRoute, async (c) => {
  const d = new Date();
  
  // Extract clean hour using formatToParts to avoid hidden unicode LTR markers breaking parseInt
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
  const parts = formatter.formatToParts(d);
  const hourStr = parts.find(p => p.type === "hour")?.value || "0";
  const hour = parseInt(hourStr, 10);
  
  let timeOfDay: "morning" | "early afternoon" | "early evening" | "late evening" = "morning";
  if (hour >= 5 && hour < 12) timeOfDay = "morning";
  else if (hour >= 12 && hour < 17) timeOfDay = "early afternoon";
  else if (hour >= 17 && hour < 21) timeOfDay = "early evening";
  else timeOfDay = "late evening";

  // Safely calculate midnight Unix timestamp for today in LA
  const yearStr = parts.find(p => p.type === "year")?.value || "1970";
  const monthStr = parts.find(p => p.type === "month")?.value || "1";
  const dayStr = parts.find(p => p.type === "day")?.value || "1";
  
  // Create an ISO string of LA midnight, but interpret as UTC to find offset difference
  // Actually, easiest way: generate the LA date string, parse it in the server TZ. 
  // But Cloudflare is always UTC.
  const laMidnightUTC = new Date(`${yearStr}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}T00:00:00.000Z`);
  
  // Since PDT is UTC-7, LA midnight is 07:00 or 08:00 UTC. 
  // A clean trick is to get the current UTC timestamp, and subtract the LA time components to reach midnight.
  const laCurrentHour = parseInt(hourStr, 10);
  const laCurrentMin = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
  const laCurrentSec = parseInt(parts.find(p => p.type === "second")?.value || "0", 10);
  
  // Or simply: the previous cache query used the server's midnight. 
  // Let's keep it simple: any image for the *same time block* generated in the last 12 hours is valid.
  // We can just rely on the `imageType` and a 12-hour age limit instead of computing absolute midnight.
  const twelveHoursAgoUnix = Math.floor(Date.now() / 1000) - (12 * 60 * 60);

  const db = drizzle(c.env.DB);
  
  // 1. Check if we already have a valid image for this time block today
  const existingRecords = await db.select().from(heroImages).orderBy(desc(heroImages.createdAt)).limit(10);
  
  // We match imageType, ensure it's not downvoted, and ensure it was created recently (within last 12h)
  const cachedForBlock = existingRecords.find(img => img.imageType === timeOfDay && img.createdAt >= twelveHoursAgoUnix && img.rating !== "down");



  if (cachedForBlock) {
    return c.json({
      greeting: cachedForBlock.greeting,
      image: { id: cachedForBlock.id, prompt: cachedForBlock.prompt, url: cachedForBlock.url }
    }, 200);
  }

  // Generate Greeting
  let greeting = `Welcome back, Justin`;
  try {
     const prompt = `It is currently the ${timeOfDay}. Write a very short (2-5 words) natural dashboard greeting for Justin. No quotes or emojis. Make it warm and subtly cool.`;
     const resp = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages: [{ role: "user", content: prompt }], 
        max_tokens: 15
     });
     const responseData = resp as any;
     if (responseData?.response) {
         greeting = responseData.response.replace(/["']/g, "").trim();
     }
  } catch (e) {
     console.error("AI Text Gen fail", e);
  }

  // Parse feedback logic for better prompting
  const upImages = existingRecords.filter(img => img.rating === "up");
  const downPrompts = existingRecords.filter(img => img.rating === "down").map(img => img.prompt);

  // Generate Image Prompt
  const month = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "long" });
  let imagePrompt = "A beautiful abstract digital art background";
  try {
      const themes = ["cutesy cartoon", "neon lights", "tokyo nights", "lo-fi chill aesthetic", "retro synthwave", "cyberpunk skyline", "abstract geometric 3D glass"];
      const theme = themes[Math.floor(Math.random() * themes.length)];
      let aiPrompt = `Propose a single concise image generation prompt for a dashboard hero background for the ${timeOfDay}. Theme: ${theme}. Current month/holiday context: ${month}. Make it visually striking, NO TEXT in the image. Be descriptive about lighting and colors appropriate for the ${timeOfDay}.`;
      
      if (upImages.length > 0) {
          aiPrompt += ` Good prompt examples we liked: ${upImages.slice(-2).map(u => u.prompt).join(". ")}.`;
      }
      if (downPrompts.length > 0) {
          aiPrompt += ` Avoid elements from these bad prompts: ${downPrompts.slice(-2).join(". ")}.`;
      }
      
      const resp = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [{ role: "user", content: aiPrompt }], 
          max_tokens: 60
      });
      const respData = resp as any;
      if (respData?.response) {
          imagePrompt = respData.response.replace(/["']/g, "").trim();
      }
  } catch(e) {}

  const newId = "img_" + Date.now() + "_" + Math.random().toString(36).substring(7);
  
  try {
      // ⚡️ Generate SDK Image
      const imageBytes = await c.env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
          prompt: imagePrompt
      });
      
      let finalUrl = "";
      let cfImageId = null;

      // ⚡️ Upload to Cloudflare Images API
      const accountId = await getSecret(c.env, "CLOUDFLARE_ACCOUNT_ID") || "";
      const apiToken = await getSecret(c.env, "CLOUDFLARE_API_TOKEN") || "";

      if (accountId && apiToken) {
          try {
            const formData = new FormData();
            formData.append("file", new File([imageBytes as any], "hero.jpg", { type: "image/jpeg" }));
            
            const cfResp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiToken}`
              },
              body: formData
            });

            const cfData = await cfResp.json() as any;
            if (cfData.success && cfData.result) {
              cfImageId = cfData.result.id;
              // CF Images provides public variants array, usually named `public` or similar. Let's find one.
              finalUrl = cfData.result.variants[0] || ""; 
            } else {
              console.error("CF Images API Failed:", cfData.errors);
            }
          } catch (cfErr) {
            console.error("CF Images Exception:", cfErr);
          }
      }

      // ⚡️ Fallback to KV proxy endpoint if Images failed
      if (!finalUrl) {
         finalUrl = `/api/session/hero/image/${newId}`;
         try {
           await c.env.KV.put(`hero:${newId}`, imageBytes as any, {
             expirationTtl: 60 * 60 * 24 * 7, // 7 days
           });
         } catch (kvErr) {
           console.warn("KV put failed for hero image", kvErr);
           const base64 = Buffer.from(imageBytes as any).toString("base64");
           finalUrl = `data:image/jpeg;base64,${base64}`;
         }
      }

      // ⚡️ Store Tracking telemetry
      await db.insert(heroImages).values({
         id: newId,
         url: finalUrl,
         prompt: imagePrompt,
         greeting: greeting,
         imageType: timeOfDay,
         cfImageId: cfImageId,
      });

      return c.json({
          greeting,
          image: { id: newId, prompt: imagePrompt, url: finalUrl }
      }, 200);

  } catch (e) {
      console.error("Image generation error", e);
      // Fallback
      const okayImages = existingRecords.filter(i => i.rating !== "down");
      if (okayImages.length > 0) {
         const randomImg = okayImages[Math.floor(Math.random() * okayImages.length)];
         return c.json({
             greeting,
             image: { id: randomImg.id, prompt: randomImg.prompt, url: randomImg.url }
         }, 200);
      }
      return c.json({ greeting, image: null }, 200);
  }
});

sessionRoutes.openapi(getHeroImageRoute, async (c) => {
    const { id } = c.req.valid("param");
    const bytes = await c.env.KV.get(`hero:${id}`, "arrayBuffer");
    if (!bytes) {
        return c.json({ error: "Image not found" } as any, 404);
    }
    return new Response(bytes, {
        headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=604800",
            "Access-Control-Allow-Origin": "*",
        },
    }) as any;
});

sessionRoutes.openapi(feedbackRoute, async (c) => {
    const { id, rating } = c.req.valid("json");
    const db = drizzle(c.env.DB);
    
    try {
        await db.update(heroImages)
                .set({ rating })
                .where(eq(heroImages.id, id));
    } catch(e) {
        console.error("Feedback DB Update Error", e);
        return c.json({ success: false }, 500);
    }
    
    return c.json({ success: true }, 200);
});
