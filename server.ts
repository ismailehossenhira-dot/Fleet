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

      const prompt = `You are an ultra-fast, high-precision Automatic Number Plate Recognition (ANPR) and Vehicle OCR engine specialized in Bangladeshi commercial and private vehicles (বাংলাদেশি গাড়ির নাম্বার প্লেট ও চলন্ত গাড়ি সনাক্তকরণ).

CRITICAL SCANNING INSTRUCTIONS FOR MOVING VEHICLES & FRONT-FACING TRUCKS/BUSES:
1. Examine the ENTIRE front profile of the vehicle:
   - Front hood / bonnet (many Bangladeshi trucks/pickups have plate stickers or painted numbers on the left, right, or center of the bonnet/hood, e.g. "ঢাকা মেট্রো-ম ১১-৮৭৫৭")
   - Front bumper / number plate bracket
   - Radiator grill and cabin body
   - Windshield top/bottom banner
2. Account for real-world driving & fleet conditions:
   - Moving vehicles (চলন্ত গাড়ি) with slight angle, perspective tilt, or motion
   - Low light, night conditions, glare from headlights or dust
   - Surrounding vinyl stickers, artwork, stripes, or Tata / Ashok Leyland logos (e.g. decorative wings or colors around the plate)
   - Dents, bends, or painted typography
3. Read the complete Bengali text (BRTA format) and translate accurately to standard English code:
   - "ঢাকা মেট্রো-ম ১১-৮৭৫৭" -> English: "DM-MA 11-8757" (ঢাকা মেট্রো ম = DM-MA)
   - "ঢাকা মেট্রো-ম ১১-২২৩৩" -> English: "DM-MA 11-2233" (ঢাকা মেট্রো ম = DM-MA)
   - "ঢাকা মেট্রো-উ ১২৩৪৫৬" -> English: "DM-U 123456" (ঢাকা মেট্রো উ = DM-U)
   - "ঢাকা মেট্রো-ঊ ১১-০০৯৯" -> English: "DM-AU 11-0099" (ঢাকা মেট্রো ঊ = DM-AU)
   - "ঢাকা মেট্রো-ন ১২-৩৪৫৬" -> English: "DM-N 12-3456" (ঢাকা মেট্রো ন = DM-N)
   - "ঢাকা মেট্রো-ট ১১-৫৫৬৬" -> English: "DM-TA 11-5566"
   - "ঢাকা মেট্রো-ড ১২-৩৩৪৪" -> English: "DM-DA 12-3344"
   - "ঢাকা মেট্রো-চ ১১-২২৩৩" -> English: "DM-CHA 11-2233"
   - "ঢাকা মেট্রো-গ ১১-২২৩৩" -> English: "DM-GA 11-2233"
   - "ঢাকা মেট্রো-ব ১১-২২৩৩" -> English: "DM-BA 11-2233"
   - "ঢাকা মেট্রো-ভ ১১-২২৩৩" -> English: "DM-BHA 11-2233"
   - "চট্ট মেট্রো-ট ১২-৩৪৫৬" -> English: "CM-TA 12-3456"
   - "খুলনা মেট্রো-ন ১১-২২৩৩" -> English: "KM-N 11-2233"
   - "গাজীপুর-ম ১১-২২৩৩" -> English: "GZ-MA 11-2233"

${vehicleHintList}

Analyze the image with maximum recall and return a STRICT JSON object in this schema:
{
  "detected": boolean, // true if any vehicle license plate, bonnet sticker, or vehicle number was detected
  "plateTextBangla": string, // Complete Bengali text e.g. "ঢাকা মেট্রো-ম ১১-৮৭৫৭" or "ঢাকা মেট্রো-ম ১১-২২৩৩"
  "plateTextEnglish": string, // Translated English text e.g. "DM-MA 11-8757", "DM-MA 11-2233", "DM-U 123456", "DM-AU 11-0099", "DM-N 12-3456"
  "plateTextStandard": string, // Standardized normalized representation
  "metroOrDistrict": string, // e.g. "ঢাকা মেট্রো", "চট্টগ্রাম মেট্রো", "গাজীপুর", etc.
  "metroOrDistrictEng": string, // e.g. "DM", "CM", "KM", "GZ", etc.
  "vehicleClass": string, // The Bangla letter e.g. "ম", "উ", "ঊ", "ন", "ট", "ড", "ব", "ভ", "ক", "খ", "গ", "ঘ", "চ", "ছ", "জ", "ঝ", "প", "ফ", "স", "হ", etc.
  "vehicleClassEng": string, // The English transliteration e.g. "MA", "U", "AU", "N", "TA", "DA", "CHA", "GA", "BA", "BHA", etc.
  "digitsBangla": string, // Numbers in Bengali script e.g. "১১-৮৭৫৭" or "১২৩৪৫৬"
  "digitsEnglish": string, // Numbers in English digits e.g. "11-8757" or "123456"
  "rawSixDigits": string, // English digits without dashes e.g. "118757"
  "matchedVehicleNumber": string, // If this closely matches any vehicle from registered vehicles list, provide the exact vehicleNumber string, else empty
  "confidence": number // 0.0 to 1.0 confidence score
}

If no vehicle license plate or vehicle number is visible anywhere on the vehicle body, return {"detected": false, "plateTextBangla": "", "confidence": 0}.
Output ONLY valid JSON without markdown wrapping.`;

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
