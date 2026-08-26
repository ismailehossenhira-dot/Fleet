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

      const prompt = `তুমি একজন অত্যন্ত দক্ষ Automatic Number Plate Recognition (ANPR / OCR) স্পেশালিস্ট এআই। তোমার কাজ হলো দেওয়া ছবি বা লাইভ ক্যামেরা ফ্রেম থেকে বাংলাদেশের গাড়ির নম্বর প্লেট অথবা বনেটে আঁকা রেজিস্ট্রেশন নম্বর নিখুঁতভাবে শনাক্ত করা।

=== নির্দেশনাবলী ===
১. ছবিতে কোনো গাড়ি, ট্রাক, পিকআপ, প্রাইভেট কার, বাস, মাইক্রোবাস, সিএনজি বা মোটরসাইকেল থাকলে সেটির নম্বর প্লেট বা রেজিস্ট্রেশন বক্স শনাক্ত করো।
২. সাধারণত বাংলাদেশি গাড়িতে নিচের মতো ফরম্যাট থাকে:
   - মেট্রো/জেলা: ঢাকা মেট্রো, চট্ট মেট্রো, চট্টগ্রাম, রাজশাহী, খুলনা, বরিশাল, সিলেট, রংপুর, ময়মনসিংহ, গাজীপুর, নারায়ণগঞ্জ, কুমিল্লা, ফরিদপুর, বগুড়া, ইত্যাদি।
   - বর্ণ/ক্লাস: ম, উ, ঊ, ন, ট, ড, ক, খ, গ, ঘ, চ, ছ, জ, ঝ, ব, ভ, প, ফ, ত, থ, দ, ধ, ল, হ, ইত্যাদি।
   - সিরিজ ও নম্বর: ১১-৮৭৫৭, ১১-২২৩৪, ১২-৩৪৫৬, ১৪-৭৮৯০, বা ৬ ডিজিট একসাথে ১২৩৪৫৬, অথবা ৪ ডিজিট ২২৩৪।
৩. বড় বাণিজ্যিক ট্রাকের বনেটে/সামনের হুডে অনেক সময় বাংলায় স্টেনসিল দিয়ে লেখা থাকে (যেমন "ঢাকা মেট্রো-ট ১১-৮৭৫৭" বা "মায়ের দোয়া" এর নিচে নম্বর)।
৪. যদি নম্বর প্লেট কিছুটা দূর থেকে দেখা যায় বা অস্পষ্ট থাকে, যতটুকু নম্বর নিশ্চিত পাওয়া যায় (যেমন শেষ ৪ ডিজিট বা সিরিজ ও ক্লাস) তা বের করো।
৫. রেফারেন্স ফ্লিট লিস্টে ম্যাচিং থাকলে সেটিকে অগ্রাধিকার দাও।

=== রেফারেন্স ডেটাবেস লিস্ট ===
${vehicleHintList}

=== আউটপুট ফরম্যাট (কঠোরভাবে শুধুমাত্র ভ্যালিড JSON প্রদান করবে) ===
{
  "total_vehicles_detected": 1,
  "detections": [
    {
      "vehicle_id": 1,
      "vehicle_type": "truck",
      "vehicle_position": "front",
      "plate_visible": true,
      "plate_text_bangla": "ঢাকা মেট্রো-ম ১১-৮৭৫৭",
      "plate_text_english": "DM-MA 11-8757",
      "division": "ঢাকা মেট্রো",
      "category_letter": "ম",
      "series_number": "১১",
      "registration_number": "৮৭৫৭",
      "matched_vehicle_number": "ঢাকা মেট্রো-ম ১১-৮৭৫৭",
      "confidence": "high",
      "format_match": true,
      "lighting_condition": "normal",
      "notes": ""
    }
  ]
}`;

      let response: any = null;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
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
      } catch (geminiPrimaryErr) {
        console.warn("Primary gemini-3.7-flash call warning, trying fallback model...", geminiPrimaryErr);
        response = await ai.models.generateContent({
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
      }

      const textResponse = response.text?.trim() || "{}";
      let parsedResult: any = {};
      try {
        parsedResult = JSON.parse(textResponse);
      } catch {
        const cleaned = textResponse.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        try {
          parsedResult = JSON.parse(cleaned);
        } catch {
          parsedResult = {};
        }
      }

      // Format primary detection for structured and backwards-compatible client usage
      const detections = Array.isArray(parsedResult.detections) ? parsedResult.detections : (parsedResult.detection ? [parsedResult.detection] : []);
      const primaryDetection = detections.find((d: any) => d.plate_visible && (d.plate_text_bangla || d.registration_number)) || detections[0] || (parsedResult.plate_text_bangla || parsedResult.plateTextBangla ? parsedResult : null);

      let plateTextBangla = primaryDetection?.plate_text_bangla || primaryDetection?.plateTextBangla || parsedResult.plateTextBangla || parsedResult.plate_text_bangla || "";
      let plateTextEnglish = primaryDetection?.plate_text_english || primaryDetection?.plateTextEnglish || parsedResult.plateTextEnglish || parsedResult.plate_text_english || "";
      let metroOrDistrict = primaryDetection?.division || primaryDetection?.metroOrDistrict || parsedResult.metroOrDistrict || parsedResult.division || "";
      let vehicleClass = primaryDetection?.category_letter || primaryDetection?.vehicleClass || parsedResult.vehicleClass || parsedResult.category_letter || "";
      let seriesNum = primaryDetection?.series_number || primaryDetection?.seriesNumber || "";
      let regNum = primaryDetection?.registration_number || primaryDetection?.registrationNumber || "";
      let matchedVehicleNumber = primaryDetection?.matched_vehicle_number || primaryDetection?.matchedVehicleNumber || parsedResult.matched_vehicle_number || parsedResult.matchedVehicleNumber || "";

      let digitsBangla = (seriesNum && regNum ? `${seriesNum}-${regNum}` : regNum || seriesNum) || parsedResult.digitsBangla || "";
      let digitsEnglish = digitsBangla ? convertBanglaDigitsToEnglish(digitsBangla) : "";
      let rawSixDigits = digitsEnglish.replace(/[^0-9]/g, "");

      // If plateTextBangla is empty but components exist, assemble it cleanly
      if (!plateTextBangla && (metroOrDistrict || vehicleClass || digitsBangla)) {
        plateTextBangla = [metroOrDistrict, vehicleClass ? `-${vehicleClass}` : '', digitsBangla ? ` ${digitsBangla}` : ''].filter(Boolean).join('');
      }

      const isDetected = Boolean(
        (plateTextBangla && plateTextBangla.trim().length >= 3) ||
        (plateTextEnglish && plateTextEnglish.trim().length >= 3) ||
        (rawSixDigits && rawSixDigits.length >= 3) ||
        (matchedVehicleNumber && matchedVehicleNumber.trim().length > 0) ||
        (primaryDetection && (primaryDetection.plate_visible || primaryDetection.plate_text_bangla || primaryDetection.registration_number))
      );

      const confidenceScore = primaryDetection?.confidence === 'high' ? 0.95 : primaryDetection?.confidence === 'medium' ? 0.75 : primaryDetection?.confidence === 'low' ? 0.45 : (typeof parsedResult.confidence === 'number' ? parsedResult.confidence : 0.85);

      const standardPayload = {
        detected: isDetected,
        total_vehicles_detected: parsedResult.total_vehicles_detected || (isDetected ? 1 : 0),
        detections: detections,
        primary_detection: primaryDetection,
        plateTextBangla,
        plateTextEnglish,
        plateTextStandard: plateTextBangla,
        metroOrDistrict,
        vehicleClass,
        digitsBangla,
        digitsEnglish,
        rawSixDigits,
        matchedVehicleNumber,
        vehicle_type: primaryDetection?.vehicle_type || 'commercial',
        vehicle_position: primaryDetection?.vehicle_position || 'সামনে',
        confidence: confidenceScore,
        confidence_level: primaryDetection?.confidence || 'high',
        format_match: primaryDetection?.format_match ?? true,
        lighting_condition: primaryDetection?.lighting_condition || 'day',
        notes: primaryDetection?.notes || ''
      };

      return res.json({
        success: true,
        data: standardPayload,
        raw_anpr: parsedResult
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
