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

      // Robust base64 and mime-type extraction
      let base64Data = image;
      let mimeType = "image/jpeg";

      const commaIndex = image.indexOf(",");
      if (commaIndex !== -1 && image.startsWith("data:")) {
        const header = image.substring(0, commaIndex);
        base64Data = image.substring(commaIndex + 1);
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch && mimeMatch[1]) {
          mimeType = mimeMatch[1].trim();
        }
      }
      // Remove whitespace/newlines from base64 string
      base64Data = base64Data.replace(/[\r\n\s]/g, "");

      const ai = getGenAI();
      if (!ai) {
        return res.status(503).json({
          success: false,
          message: "Gemini API key not configured on server. Please check environment settings."
        });
      }

      const vehicleHintList = Array.isArray(registeredVehicles) && registeredVehicles.length > 0
        ? `Registered Fleet Vehicles in Database for matching reference:\n${registeredVehicles.slice(0, 100).map((v: any) => `- ${v.vehicleNumber} (Type: ${v.type || 'Commercial'})`).join("\n")}`
        : "";

      const prompt = `You are a world-class Automatic Number Plate Recognition (ANPR) and Vehicle OCR engine specialized in Bangladeshi commercial trucks, pickups, buses, and private vehicles (বাংলাদেশি গাড়ির নাম্বার প্লেট ও চলন্ত গাড়ি সনাক্তকরণ).

CRITICAL SCANNING INSTRUCTIONS FOR BANGLADESHI VEHICLES:
1. Bangladeshi vehicle registration plates / numbers are commonly formatted in TWO LINES:
   - Line 1 (District & Class): e.g. "ঢাকা মেট্রো-ম", "ঢাকা মেট্রো-উ", "ঢাকা মেট্রো-ঊ", "ঢাকা মেট্রো-ন", "ঢাকা মেট্রো-ট", "ঢাকা মেট্রো-ড", "ঢাকা মেট্রো-গ", "ঢাকা মেট্রো-চ", "চট্ট মেট্রো-ট", "গাজীপুর-ম"
   - Line 2 (Digits): e.g. "১১-৮৭৫৭", "১১-২২৩৩", "১২-৩৪৫৬", "১২৩৪৫৬"
   Combine both lines into the complete plate string: e.g. "ঢাকা মেট্রো-ম ১১-৮৭৫৭" or "ঢাকা মেট্রো-ম ১১-২২৩৩".

2. SCAN ALL VEHICLE LOCATIONS:
   - Front bonnet / hood: Bangladeshi commercial trucks (Tata, Ashok Leyland, Mahindra, etc.) almost always have the registration painted or stickered in a white or colored box on the front bonnet/hood (e.g. left side or middle of hood).
   - Front metal bumper & license plate bracket.
   - Radiator grill & cabin body.
   - Windshield top banner or visor.

3. IGNORE DECORATIVE LOGOS & NON-REGISTRATION TEXT:
   - Ignore manufacturer badges ("TATA", "ASHOK LEYLAND", "VOLVO", "TURBO").
   - Ignore battery / sponsor stickers (e.g. "পদ্মা ব্যাটারী", "মায়ের দোয়া", "আল্লাহ সর্বশক্তিমান").
   - Focus strictly on the official BRTA format: [District/Metro]-[Class] [Digits].

4. BANGLA TO ENGLISH TRANSLATIONS:
   - "ঢাকা মেট্রো-ম ১১-৮৭৫৭" -> English: "DM-MA 11-8757" (ম = MA)
   - "ঢাকা মেট্রো-ম ১১-২২৩৩" -> English: "DM-MA 11-2233" (ম = MA)
   - "ঢাকা মেট্রো-উ ১২৩৪৫৬" -> English: "DM-U 123456" (উ = U)
   - "ঢাকা মেট্রো-ঊ ১১-০০৯৯" -> English: "DM-AU 11-0099" (ঊ = AU)
   - "ঢাকা মেট্রো-ন ১২-৩৪৫৬" -> English: "DM-N 12-3456" (ন = N)
   - "ঢাকা মেট্রো-ট ১১-৫৫৬৬" -> English: "DM-TA 11-5566" (ট = TA)
   - "ঢাকা মেট্রো-ড ১২-৩৩৪৪" -> English: "DM-DA 12-3344" (ড = DA)
   - "ঢাকা মেট্রো-চ ১১-২২৩৩" -> English: "DM-CHA 11-2233" (চ = CHA)
   - "ঢাকা মেট্রো-গ ১১-২২৩৩" -> English: "DM-GA 11-2233" (গ = GA)
   - "ঢাকা মেট্রো-ব ১১-২২৩৩" -> English: "DM-BA 11-2233" (ব = BA)
   - "ঢাকা মেট্রো-ভ ১১-২২৩৩" -> English: "DM-BHA 11-2233" (ভ = BHA)
   - "চট্ট মেট্রো-ট ১২-৩৪৫৬" -> English: "CM-TA 12-3456" (ট = TA)
   - "খুলনা মেট্রো-ন ১১-২২৩৩" -> English: "KM-N 11-2233" (ন = N)
   - "গাজীপুর-ম ১১-২২৩৩" -> English: "GZ-MA 11-2233" (ম = MA)

${vehicleHintList}

Analyze the vehicle image with maximum sensitivity and return a STRICT JSON object in this schema:
{
  "detected": boolean, // true if any vehicle registration number or bonnet plate was identified
  "plateTextBangla": string, // Complete Bengali plate e.g. "ঢাকা মেট্রো-ম ১১-৮৭৫৭" or "ঢাকা মেট্রো-ম ১১-২২৩৩"
  "plateTextEnglish": string, // Translated English code e.g. "DM-MA 11-8757", "DM-MA 11-2233", "DM-U 123456"
  "plateTextStandard": string, // Standardized representation
  "metroOrDistrict": string, // e.g. "ঢাকা মেট্রো", "চট্টগ্রাম মেট্রো", "গাজীপুর", etc.
  "metroOrDistrictEng": string, // e.g. "DM", "CM", "KM", "GZ"
  "vehicleClass": string, // Bengali class letter e.g. "ম", "উ", "ঊ", "ন", "ট", "ড", "গ", "চ", "ব", "ভ", "ক", etc.
  "vehicleClassEng": string, // English class code e.g. "MA", "U", "AU", "N", "TA", "DA", "GA", "CHA", "BA", "BHA"
  "digitsBangla": string, // Numbers in Bengali e.g. "১১-৮৭৫৭" or "১২৩৪৫৬"
  "digitsEnglish": string, // Numbers in English digits e.g. "11-8757" or "123456"
  "rawSixDigits": string, // Digits only without dashes e.g. "118757"
  "matchedVehicleNumber": string, // If this closely matches any vehicle from the registered fleet list, provide that exact vehicleNumber string, else empty
  "confidence": number // 0.0 to 1.0 confidence score
}

If no vehicle license plate or registration marking is visible anywhere on the vehicle, return {"detected": false, "plateTextBangla": "", "confidence": 0}.
Output ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg"
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

      console.log("ANPR Result:", JSON.stringify(parsedResult));

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
