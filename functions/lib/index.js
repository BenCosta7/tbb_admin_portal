"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPdfText = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const storage_1 = require("firebase-functions/v2/storage");
const vertexai_1 = require("@google-cloud/vertexai");
// Initialize Firebase Admin SDK
admin.initializeApp();
// Initialize the Vertex AI client
const vertexAI = new vertexai_1.VertexAI({
    project: process.env.GCLOUD_PROJECT,
    location: 'us-central1'
});
const generativeModel = vertexAI.getGenerativeModel({
    // Using the flash model we know works in your project
    model: 'gemini-2.5-flash-preview-05-20',
});
/**
 * Cloud Function to extract text, send it to Gemini for analysis,
 * and save the results in a structured format for the app.
 */
exports.extractPdfText = (0, storage_1.onObjectFinalized)({
    cpu: 2,
    timeoutSeconds: 300,
    memory: "1GiB",
    region: 'us-central1',
}, async (event) => {
    var _a, _b, _c, _d;
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;
    // --- 1. Basic Validation ---
    if (!filePath || !contentType || !filePath.startsWith("lab_reports/") || contentType !== "application/pdf") {
        functions.logger.log(`File ${filePath} is not a valid PDF in 'lab_reports/'. Ignoring.`);
        return;
    }
    const pathParts = filePath.split('/');
    if (pathParts.length < 3) {
        functions.logger.error(`Invalid file path structure: ${filePath}. Expected 'lab_reports/USER_ID/filename.pdf'.`);
        return;
    }
    const userId = pathParts[1];
    const fileName = pathParts[2];
    functions.logger.log(`Processing PDF file: ${filePath} for user: ${userId}`);
    const bucket = admin.storage().bucket(fileBucket);
    const file = bucket.file(filePath);
    try {
        // --- 2. Extract Text from PDF ---
        const [pdfBuffer] = await file.download();
        const pdfData = await (0, pdf_parse_1.default)(pdfBuffer);
        const extractedText = pdfData.text;
        if (!extractedText) {
            functions.logger.warn("No text could be extracted from the PDF.");
            return;
        }
        functions.logger.log("✅ Successfully extracted text from PDF.");
        // --- 3. Dynamic Prompt Engineering and AI Call ---
        const prompt = `
            You are an expert medical data analyst. Your task is to analyze the following lab report text and identify all relevant biomarkers.
            For each biomarker you find, provide its name, its numerical value, and its unit.
            Provide the output ONLY in a valid JSON format, as an array of objects. Each object should have three keys: "labName", "value", and "unit".

            Example of the required output format:
            [
              { "labName": "Zonulin", "value": 0.5, "unit": "ng/mL" },
              { "labName": "Calprotectin", "value": 50, "unit": "mcg/g" }
            ]

            Here is the text:
            ---
            ${extractedText}
            ---
        `;
        functions.logger.log(`🧠 Calling Gemini to extract information...`);
        const response = await generativeModel.generateContent(prompt);
        let jsonTextResponse = (_d = (_c = (_b = (_a = response.response.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts[0]) === null || _d === void 0 ? void 0 : _d.text;
        if (!jsonTextResponse) {
            throw new Error("Gemini response did not contain any text.");
        }
        functions.logger.log("✨ Gemini responded. Cleaning and parsing JSON...");
        // Cleaning logic to remove Markdown wrappers
        const match = jsonTextResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
            jsonTextResponse = match[1];
        }
        const extractedDataArray = JSON.parse(jsonTextResponse);
        if (!Array.isArray(extractedDataArray)) {
            throw new Error("Gemini response was not a valid JSON array.");
        }
        functions.logger.log("✅ Successfully parsed JSON array from Gemini:", extractedDataArray);
        // --- 4. Transform and Write Structured Data for the App ---
        const firestore = admin.firestore();
        const batch = firestore.batch();
        const resultsCollectionRef = firestore.collection('users').doc(userId).collection('structured_lab_results');
        const reportDate = admin.firestore.FieldValue.serverTimestamp();
        for (const labResult of extractedDataArray) {
            // Check if the result from the AI has the fields we need
            if (labResult && labResult.labName && labResult.value !== null && labResult.unit) {
                const newLabDocRef = resultsCollectionRef.doc(); // Create a new doc with an auto-generated ID
                batch.set(newLabDocRef, {
                    labName: labResult.labName,
                    value: labResult.value,
                    unit: labResult.unit,
                    date: reportDate,
                    sourceFile: fileName
                });
            }
        }
        await batch.commit();
        functions.logger.log(`🎉 Successfully created ${extractedDataArray.length} individual lab documents for the app.`);
        // --- 5. Save the original raw extraction for archival purposes ---
        const rawReportRef = firestore.collection('users').doc(userId).collection('lab_reports').doc(fileName);
        await rawReportRef.set({
            extractedData: extractedDataArray,
            createdAt: reportDate,
            originalFile: {
                path: filePath,
                bucket: fileBucket
            }
        });
        functions.logger.log(`📚 Saved raw extracted data for archival to: ${rawReportRef.path}`);
    }
    catch (error) {
        functions.logger.error("Error in PDF processing pipeline:", error);
    }
});
//# sourceMappingURL=index.js.map