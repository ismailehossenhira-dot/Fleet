import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let genaiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genaiClient;
}

// Bengali to English digit translation map
const BANGLA_TO_ENG_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

function convertBanglaDigitsToEnglish(str: string): string {
  return str.replace(/[০-৯]/g, d => BANGLA_TO_ENG_DIGITS[d] || d);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 camera image uploads
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // API Health
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "FleetFlow Pro ANPR Server" });
  });

  // Bangladeshi License Plate Recognition (ANPR / OCR)
  app.post("/api/anpr/scan-plate", async (req, res) => {
    try {
      const { image, registeredVehicles } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, message: "No image provided" });
      }

      // Strip data URL prefix if present
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

      const ai = getGenAI();
      if (!ai) {
        return res.status(503).json({
          success: false,
          message: "Gemini API key not configured on server. Please use manual or QR scan."
        });
      }

      const vehicleHintList = Array.isArray(registeredVehicles) && registeredVehicles.length > 0
        ? `Registered Fleet Vehicles in Database for matching:\n${registeredVehicles.slice(0, 100).map((v: any) => `- ${v.vehicleNumber} (Type: ${v.type || 'N/A'})`).join("\n")}`
        : "";

      const prompt = `You are an expert Automatic Number Plate Recognition (ANPR) system specializing in Bangladeshi vehicle license plates (বাংলাদেশি গাড়ির নাম্বার প্লেট).

Look closely at the image. Detect if there is a vehicle license plate.
Bangladeshi number plates are typically written in Bengali (Bangla) script in standard BRTA format, for example:
- "ঢাকা মেট্রো-ম ১১-২২৩৩"
- "ঢাকা মেট্রো-ন ১২-৩৪৫৬"
- "ঢাকা মেট্রো-উ ১২৩৪৫৬"
- "ঢাকা মেট্রো-ঊ ১১-০০৯৯"
- "ঢাকা মেট্রো-ড ১২-৩৩৪৪"
- "ঢাকা মেট্রো-ট ১১-৫৫৬৬"
- "চট্ট মেট্রো-ট ১২-৩৪৫৬"
- "খুলনা মেট্রো-ন ১১-২২৩৩"
- "গাজীপুর-ম ১১-২২৩৩"
- Or English digits like "DHAKA METRO M 11-2233" or digits "12-3456" / "123456".

${vehicleHintList}

Analyze the plate precisely and return a STRICT JSON object in this exact schema:
{
  "detected": boolean, // true if a license plate or vehicle number was found
  "plateTextBangla": string, // Full Bangla text e.g. "ঢাকা মেট্রো-ম ১১-২২৩৩" or "ঢাকা মেট্রো-উ ১২৩৪৫৬"
  "plateTextStandard": string, // Normalized standard representation
  "metroOrDistrict": string, // e.g. "ঢাকা মেট্রো", "চট্টগ্রাম মেট্রো", "গাজীপুর", etc.
  "vehicleClass": string, // The Bangla letter e.g. "ম", "উ", "ঊ", "ন", "ট", "ড", "ব", "ভ", "ক", "খ", "গ", "ঘ", "চ", "ছ", "জ", "ঝ", "প", "ফ", "স", "হ", etc.
  "digitsBangla": string, // The numbers in Bengali script e.g. "১১-২২৩৩" or "১২৩৪৫৬"
  "digitsEnglish": string, // The numbers in English digits e.g. "11-2233" or "123456"
  "rawSixDigits": string, // Just the 6 digits (or 4-6 digits) in English without dashes e.g. "112233"
  "matchedVehicleNumber": string, // If this closely matches any vehicle from registered vehicles list, provide the exact vehicleNumber string, else empty
  "confidence": number // 0.0 to 1.0 confidence score
}

If no vehicle license plate is clearly visible, return {"detected": false, "plateTextBangla": "", "confidence": 0}.
Output ONLY valid JSON. Do not include markdown code block syntax if possible, just the raw JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const textResponse = response.text?.trim() || "{}";
      let parsedResult: any = {};
      try {
        parsedResult = JSON.parse(textResponse);
      } catch (parseErr) {
        // Clean markdown backticks if any
        const cleaned = textResponse.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        parsedResult = JSON.parse(cleaned);
      }

      // Ensure English digits conversion if missing
      if (parsedResult.digitsBangla && !parsedResult.digitsEnglish) {
        parsedResult.digitsEnglish = convertBanglaDigitsToEnglish(parsedResult.digitsBangla);
      }
      if (parsedResult.digitsEnglish && !parsedResult.rawSixDigits) {
        parsedResult.rawSixDigits = parsedResult.digitsEnglish.replace(/[^0-9]/g, "");
      }

      return res.json({
        success: true,
        data: parsedResult
      });
    } catch (error: any) {
      console.error("ANPR Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to process image for license plate recognition"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FleetFlow Pro Server running on port ${PORT}`);
  });
}

startServer();
