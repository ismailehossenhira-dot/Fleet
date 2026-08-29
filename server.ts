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

      const prompt = `You are an industry-grade OpenALPR (Automated License Plate Recognition) and Computer Vision engine tailored for Bangladesh Vehicle Registration Plates & Vehicle Fleet Tracking.

Analyze the provided camera/video frame and extract license plate candidates following the OpenALPR schema and BRTA (Bangladesh Road Transport Authority) plate standards.

=== BANGLADESH LICENSE PLATE & VEHICLE PATTERNS ===
1. BRTA Standard Format:
   - Metro/District: ঢাকা মেট্রো, চট্টগ্রাম মেট্রো, চট্ট মেট্রো, রাজশাহী, খুলনা, বরিশাল, সিলেট, রংপুর, ময়মনসিংহ, গাজীপুর, নারায়ণগঞ্জ, কুমিল্লা, ফরিদপুর, বগুড়া, দিনাজপুর, পাবনা, ইত্যাদি। (English codes: DM, CM, RM, KM, BM, SM, RPM, GZM, NG, COM, FAR, BOG, DIN, PAB, etc.)
   - Vehicle Class / Category Letter:
     * ম (MA / Heavy Truck/Commercial Lorry)
     * উ / ঊ (U / AU / Pickup, Delivery Van)
     * ন (N / Microbus)
     * ট (TA / Mini Truck, Medium Cargo)
     * ড (DA / Covered Van)
     * ক / খ / গ / ঘ (KA, KHA, GA, GHA / Private Car, Sedan)
     * চ / ছ (CHA, CHHA / Microbus, Human Hauler)
     * জ / ঝ (JA, JHA / Bus, Commercial Coach)
     * ব / ভ (BA, BHA / Large Bus)
     * প / ফ (PA, FA / Special/Cargo)
     * ত / থ / দ / ধ (TA, THA, DA, DHA / Prime Mover, Trailer)
     * ল / হ (LA, HA / Motorcycle, Auto Rickshaw)
   - Series & Registration Digits:
     * 2-digit series (e.g. ১১, ১২, ১৩, ১৪, ১৫, ২১...) + 4-digit number (e.g. ৮৭৫৭, ২২৩৪, ১২৩৪...)
     * or 6-digit combined string (e.g. ১২৩৪৫৬, ১১৮৭৫৭)
2. Commercial Hood / Bumper Stencils:
   - Many Bangladeshi commercial trucks feature hand-painted or stenciled registration text across the front hood or lower bumper (often below decorative slogans like 'মায়ের দোয়া'). Recognize these as primary license identifiers!
3. OpenALPR Candidate Ranking:
   - Provide top candidates with confidence percentages (0 to 100), template match score (1 for valid BRTA format, 0 otherwise), and corner bounding coordinates.

=== REGISTERED FLEET REFERENCE DATABASE ===
${vehicleHintList}

=== OPENALPR OUTPUT JSON SCHEMA (Strict Valid JSON Only) ===
{
  "total_vehicles_detected": 1,
  "processing_time_ms": 145,
  "openalpr_results": [
    {
      "plate": "ঢাকা মেট্রো-ম ১১-৮৭৫৭",
      "confidence": 95.8,
      "matches_template": 1,
      "plate_index": 0,
      "region": "bd",
      "region_confidence": 99.0,
      "processing_time_ms": 42.5,
      "coordinates": [
        {"x": 120, "y": 340},
        {"x": 380, "y": 340},
        {"x": 380, "y": 420},
        {"x": 120, "y": 420}
      ],
      "candidates": [
        {
          "plate": "ঢাকা মেট্রো-ম ১১-৮৭৫৭",
          "plate_bangla": "ঢাকা মেট্রো-ম ১১-৮৭৫৭",
          "plate_english": "DM-MA 11-8757",
          "confidence": 95.8,
          "matches_template": 1
        },
        {
          "plate": "ঢাকা মেট্রো-ম ১১৮৭৫৭",
          "plate_bangla": "ঢাকা মেট্রো-ম ১১৮৭৫৭",
          "plate_english": "DM-MA 118757",
          "confidence": 88.2,
          "matches_template": 1
        }
      ],
      "vehicle_region": {
        "x": 60,
        "y": 180,
        "width": 520,
        "height": 400
      },
      "vehicle": {
        "body_type": "truck",
        "make": "Tata",
        "model": "1613",
        "color": "blue",
        "orientation": "front"
      }
    }
  ],
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
      "confidence_score": 95.8,
      "format_match": true,
      "lighting_condition": "normal",
      "notes": ""
    }
  ]
}`;

      const startTime = Date.now();
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
        console.warn("Primary OpenALPR model call warning, trying fallback model...", geminiPrimaryErr);
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
      const totalElapsedMs = Date.now() - startTime;

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

      // Format OpenALPR results and primary detection for structured client usage
      const openalprResults = Array.isArray(parsedResult.openalpr_results) ? parsedResult.openalpr_results : [];
      const primaryOpenalpr = openalprResults[0] || null;

      const detections = Array.isArray(parsedResult.detections) ? parsedResult.detections : (parsedResult.detection ? [parsedResult.detection] : []);
      const primaryDetection = detections.find((d: any) => d.plate_visible && (d.plate_text_bangla || d.registration_number)) || detections[0] || (parsedResult.plate_text_bangla || parsedResult.plateTextBangla ? parsedResult : null);

      let plateTextBangla = primaryDetection?.plate_text_bangla || primaryDetection?.plateTextBangla || primaryOpenalpr?.plate || parsedResult.plateTextBangla || parsedResult.plate_text_bangla || "";
      let plateTextEnglish = primaryDetection?.plate_text_english || primaryDetection?.plateTextEnglish || primaryOpenalpr?.candidates?.[0]?.plate_english || parsedResult.plateTextEnglish || parsedResult.plate_text_english || "";
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
        (primaryDetection && (primaryDetection.plate_visible || primaryDetection.plate_text_bangla || primaryDetection.registration_number)) ||
        (primaryOpenalpr && primaryOpenalpr.plate)
      );

      const confidenceScore = primaryDetection?.confidence_score 
        ? primaryDetection.confidence_score / 100 
        : primaryOpenalpr?.confidence 
        ? primaryOpenalpr.confidence / 100 
        : primaryDetection?.confidence === 'high' 
        ? 0.95 
        : primaryDetection?.confidence === 'medium' 
        ? 0.75 
        : 0.85;

      const standardPayload = {
        detected: isDetected,
        total_vehicles_detected: parsedResult.total_vehicles_detected || (isDetected ? 1 : 0),
        processing_time_ms: parsedResult.processing_time_ms || totalElapsedMs,
        detections: detections,
        primary_detection: primaryDetection,
        openalpr_results: openalprResults,
        primary_openalpr: primaryOpenalpr,
        plateTextBangla,
        plateTextEnglish,
        plateTextStandard: plateTextBangla,
        metroOrDistrict,
        vehicleClass,
        digitsBangla,
        digitsEnglish,
        rawSixDigits,
        matchedVehicleNumber,
        vehicle_type: primaryDetection?.vehicle_type || primaryOpenalpr?.vehicle?.body_type || 'commercial',
        vehicle_position: primaryDetection?.vehicle_position || primaryOpenalpr?.vehicle?.orientation || 'front',
        confidence: confidenceScore,
        confidence_level: primaryDetection?.confidence || (confidenceScore > 0.85 ? 'high' : 'medium'),
        format_match: primaryDetection?.format_match ?? (primaryOpenalpr?.matches_template === 1),
        lighting_condition: primaryDetection?.lighting_condition || 'normal',
        notes: primaryDetection?.notes || ''
      };

      return res.json({
        success: true,
        data: standardPayload,
        openalpr: {
          version: "2.8.101-bd-edition",
          data_type: "alpr_results",
          epoch_time: Date.now(),
          img_width: 1280,
          img_height: 720,
          processing_time_ms: totalElapsedMs,
          results: openalprResults
        },
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
