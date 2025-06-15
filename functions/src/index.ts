import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import pdfParse from "pdf-parse";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { VertexAI } from '@google-cloud/vertexai';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize the Vertex AI client
const vertexAI = new VertexAI({
    project: process.env.GCLOUD_PROJECT!,
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
export const extractPdfText = onObjectFinalized({
    cpu: 2,
    timeoutSeconds: 300,
    memory: "1GiB",
    region: 'us-central1',
}, async (event) => {
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
        const pdfData = await pdfParse(pdfBuffer);
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
        let jsonTextResponse = response.response.candidates?.[0]?.content?.parts[0]?.text;

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


    } catch (error) {
        functions.logger.error("Error in PDF processing pipeline:", error);
    }
});