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
// Import the AI Platform library and the specific type for our data
const aiplatform = __importStar(require("@google-cloud/aiplatform"));
// Initialize Firebase Admin SDK
admin.initializeApp();
// Initialize the Prediction Service Client
const client = new aiplatform.v1.PredictionServiceClient({
    apiEndpoint: 'us-central1-aiplatform.googleapis.com',
});
/**
 * Cloud Function to extract text, chunk it, and generate embeddings.
 */
exports.extractPdfText = (0, storage_1.onObjectFinalized)({
    cpu: 2,
    timeoutSeconds: 300,
    memory: "1GiB",
    region: 'us-central1',
}, async (event) => {
    var _a;
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;
    const project = process.env.GCLOUD_PROJECT;
    const bucket = admin.storage().bucket(fileBucket);
    if (!filePath || !contentType || !filePath.startsWith("lab_reports/") || contentType !== "application/pdf") {
        functions.logger.log(`File ${filePath} is not a valid PDF in 'lab_reports/'. Ignoring.`);
        return;
    }
    functions.logger.log(`Processing PDF file: ${filePath}`);
    const file = bucket.file(filePath);
    const [pdfBuffer] = await file.download();
    try {
        const pdfData = await (0, pdf_parse_1.default)(pdfBuffer);
        const extractedText = pdfData.text;
        functions.logger.log("✅ Successfully extracted text.");
        const chunks = extractedText.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 0);
        functions.logger.log(`📝 Text split into ${chunks.length} chunks.`);
        if (chunks.length === 0) {
            functions.logger.warn("No text chunks found after splitting.");
            return;
        }
        functions.logger.log(`🧠 Generating embeddings...`);
        // Manually construct the instance objects in the exact format the API requires.
        const instances = chunks.map(chunk => ({
            structValue: {
                fields: {
                    content: { stringValue: chunk },
                },
            },
        }));
        // Define the full model endpoint path
        const endpoint = `projects/${project}/locations/us-central1/publishers/google/models/text-embedding-004`;
        // The predict method returns a promise that resolves to an array.
        // This syntax correctly awaits the promise and gets the first element.
        const [response] = await client.predict({
            endpoint: endpoint,
            instances: instances,
        });
        if (!response.predictions) {
            throw new Error("API response did not contain predictions.");
        }
        // Manually parse the embedding vectors from the complex response structure.
        const embeddings = response.predictions.map(prediction => {
            var _a, _b, _c, _d, _e;
            const embeddingValue = (_d = (_c = (_b = (_a = prediction.structValue) === null || _a === void 0 ? void 0 : _a.fields) === null || _b === void 0 ? void 0 : _b.embedding) === null || _c === void 0 ? void 0 : _c.listValue) === null || _d === void 0 ? void 0 : _d.values;
            return (_e = embeddingValue === null || embeddingValue === void 0 ? void 0 : embeddingValue.map(value => { var _a; return (_a = value.numberValue) !== null && _a !== void 0 ? _a : 0; })) !== null && _e !== void 0 ? _e : [];
        });
        functions.logger.log(`✨ Successfully generated ${embeddings.length} embeddings.`);
        if (embeddings.length > 0) {
            functions.logger.log("Sample Embedding (first 10 values):", (_a = embeddings[0]) === null || _a === void 0 ? void 0 : _a.slice(0, 10));
        }
    }
    catch (error) {
        functions.logger.error("Error in PDF processing pipeline:", error);
    }
});
//# sourceMappingURL=index.js.map