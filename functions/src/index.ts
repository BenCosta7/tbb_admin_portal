import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import pdfParse from "pdf-parse";
import { onObjectFinalized } from "firebase-functions/v2/storage";

// Import the AI Platform library and the specific type for our data
import * as aiplatform from '@google-cloud/aiplatform';
import { protos } from '@google-cloud/aiplatform';

// A type alias for the prediction client for cleaner code
type PredictionServiceClient = aiplatform.v1.PredictionServiceClient;

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize the Prediction Service Client
const client: PredictionServiceClient = new aiplatform.v1.PredictionServiceClient({
    apiEndpoint: 'us-central1-aiplatform.googleapis.com',
});

/**
 * Cloud Function to extract text, chunk it, and generate embeddings.
 */
export const extractPdfText = onObjectFinalized({
    cpu: 2,
    timeoutSeconds: 300,
    memory: "1GiB",
    region: 'us-central1',
}, async (event) => {
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;
    const project = process.env.GCLOUD_PROJECT!;
    
    const bucket = admin.storage().bucket(fileBucket);

    if (!filePath || !contentType || !filePath.startsWith("lab_reports/") || contentType !== "application/pdf") {
        functions.logger.log(`File ${filePath} is not a valid PDF in 'lab_reports/'. Ignoring.`);
        return;
    }

    functions.logger.log(`Processing PDF file: ${filePath}`);
    const file = bucket.file(filePath);
    const [pdfBuffer] = await file.download();

    try {
        const pdfData = await pdfParse(pdfBuffer);
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
        const instances: protos.google.protobuf.IValue[] = chunks.map(chunk => ({
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
            const embeddingValue = prediction.structValue?.fields?.embedding?.listValue?.values;
            return embeddingValue?.map(value => value.numberValue ?? 0) ?? [];
        });

        functions.logger.log(`✨ Successfully generated ${embeddings.length} embeddings.`);
        
        if (embeddings.length > 0) {
            functions.logger.log("Sample Embedding (first 10 values):", embeddings[0]?.slice(0, 10));
        }

    } catch (error) {
        functions.logger.error("Error in PDF processing pipeline:", error);
    }
});