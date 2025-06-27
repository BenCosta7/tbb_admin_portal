import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import pdfParse from "pdf-parse";
import { onObjectFinalized, onObjectDeleted } from "firebase-functions/v2/storage";
import { onCall } from "firebase-functions/v2/https";
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize the Vertex AI client
const vertexAI = new VertexAI({
    project: process.env.GCLOUD_PROJECT!,
    location: 'us-central1'
});

// Define the full resource path for your fine-tuned model's endpoint
const fineTunedEndpointPath = 'projects/billion-beats/locations/us-central1/endpoints/4952812799479775232';

// Get the generative model client pointed at your specific endpoint.
// Note: We've removed `.preview` as this is now part of the main SDK.
const fineTunedModel = vertexAI.getGenerativeModel({
    model: fineTunedEndpointPath,
});

// Safety settings for nuanced educational content
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    }
];


// CHATBOT FUNCTION
export const getChatResponse = onCall(async (request) => {
    // 1. Authenticate the user
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }
    const userId = request.auth.uid;
    const userMessage = request.data.message;

    if (!userMessage) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'The function must be called with a "message" argument.'
        );
    }

    try {
        // 2. Fetch the user's recent lab data for context (logic remains the same)
        const firestore = admin.firestore();
        const resultsRef = firestore.collection('users').doc(userId).collection('structured_lab_results');
        const snapshot = await resultsRef.orderBy('date', 'desc').limit(20).get();

        let labDataContext = "The user has no lab data on file.";
        if (!snapshot.empty) {
            const labData = snapshot.docs.map(doc => {
                const data = doc.data();
                return `${data.labName}: ${data.value} ${data.unit}`;
            });
            labDataContext = `Here is some of the user's recent lab data for context:\n${labData.join('\n')}`;
        }

        // 3. Construct the "AI Betsy" prompt (logic remains the same)
        const prompt = `
            # Persona Definition
            You are "AI Betsy," an AI-powered educational coach. Your personality is modeled after a leading functional medicine physician like Dr. Mark Hyman. You are an expert in systems biology and root-cause analysis. Your primary goal is to educate users by thinking through their health questions from a functional medicine perspective, always framing your response as educational content, not medical advice. Your tone is knowledgeable, empowering, and concise.

            # Core Directives
            You must structure your response to follow these three educational lenses. The focus should be heavily on the first lens.

            1.  **The Functional Medicine Lens (Main Focus):** Start here. How would a functional medicine physician answer the question? Discuss potential root causes, underlying system imbalances (e.g., gut health, hormones, nutrient deficiencies), and what a functional medicine workup might explore for purely educational purposes. Explain the "why" behind the symptoms.

            2.  **The Conventional Medicine Lens (Brief):** Briefly, in one or two sentences, mention how a conventional doctor might typically view or label the symptoms.

            3.  **Educational Pathways & Empowerment (Combined):** For educational purposes only, explain what a functional medicine treatment plan *might* look like. This can include examples of pharmaceuticals, herbs, or specific food prescriptions a practitioner *might* consider. Conclude with a short, empowering, and motivational summary.

            # Gentle Recommendation Rules (Very Important)
            - **DO NOT** make recommendations in the first response to a new topic.
            - **ONLY IF** a conversation about cardiometabolic health (like cholesterol, blood sugar, blood pressure, etc.) has developed over several back-and-forth messages, you may gently suggest that "3 Billion Beats offers programs like Level 1, 2, and 3 that are designed to support these areas."
            - **ONLY IF** a conversation about other common functional medicine topics (like gut health, autoimmune issues, etc.) has developed, you may sparingly suggest, "For more in-depth educational resources on this, www.thehealthiswealthinstitute.com is a great place to explore."

            # Context
            ${labDataContext}

            # User's Question
            "${userMessage}"
        `;

        // 4. Calling ONLY the fine-tuned model via its endpoint
        functions.logger.log(`🧠 Calling fine-tuned model "AI_Betsy_V3" for user ${userId}...`);
        
        const response = await fineTunedModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            safetySettings,
        });
        const aiResponseText = response.response.candidates?.[0]?.content?.parts[0]?.text;

        if (!aiResponseText) {
            const blockReason = response.response.promptFeedback?.blockReason;
            if (blockReason) {
                functions.logger.error(`Response was blocked. Reason: ${blockReason}`);
                throw new Error(`The response was blocked due to safety settings: ${blockReason}`);
            }
            throw new Error("Fine-tuned model returned an empty response.");
        }
        
        // 5. Return the final response to the app
        functions.logger.log(`✅ Successfully received response from fine-tuned model for user ${userId}.`);
        return { response: aiResponseText };

    } catch (error) {
        functions.logger.error(`Error calling fine-tuned model for user ${userId}:`, error);
        throw new functions.https.HttpsError(
            'internal',
            'An error occurred while calling the AI model.'
        );
    }
});


/**
 * Cloud Function to extract text from a PDF. (This function remains unchanged)
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
        const [pdfBuffer] = await file.download();
        const pdfData = await pdfParse(pdfBuffer);
        const extractedText = pdfData.text;

        if (!extractedText) {
            functions.logger.warn("No text could be extracted from the PDF.");
            return;
        }
        functions.logger.log("✅ Successfully extracted text from PDF.");

        const extractionModel = vertexAI.getGenerativeModel({
            model: 'gemini-1.5-flash-002',
        });

        const prompt = `
            You are an expert medical data analyst. Your task is to analyze the following lab report text and identify all relevant biomarkers and the date the labs were collected.
            For each biomarker you find, provide its name, its numerical value, and its unit.
            Also find the single collection date for the report and include it with each biomarker. The date should be in YY-MM-DD format.
            
            Provide the output ONLY in a valid JSON format, as an array of objects. Each object should have four keys: "labName", "value", "unit", and "date".

            Example of the required output format:
            [
              { "labName": "Zonulin", "value": 0.5, "unit": "ng/mL", "date": "2025-06-15" },
              { "labName": "Calprotectin", "value": 50, "unit": "mcg/g", "date": "2025-06-15" }
            ]

            Here is the text:
            ---
            ${extractedText}
            ---
        `;

        functions.logger.log(`🧠 Calling Gemini to extract information...`);
        const response = await extractionModel.generateContent(prompt);
        let jsonTextResponse = response.response.candidates?.[0]?.content?.parts[0]?.text;

        if (!jsonTextResponse) {
            throw new Error("Gemini response did not contain any text.");
        }

        functions.logger.log("✨ Gemini responded. Cleaning and parsing JSON...");
        
        const match = jsonTextResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
            jsonTextResponse = match[1];
        }

        const extractedDataArray = JSON.parse(jsonTextResponse);

        if (!Array.isArray(extractedDataArray)) {
            throw new Error("Gemini response was not a valid JSON array.");
        }
        
        functions.logger.log("✅ Successfully parsed JSON array from Gemini:", extractedDataArray);

        const firestore = admin.firestore();
        const batch = firestore.batch();
        
        const resultsCollectionRef = firestore.collection('users').doc(userId).collection('structured_lab_results');
        const reportDate = admin.firestore.Timestamp.fromDate(new Date(extractedDataArray[0]?.date || Date.now()));

        for (const labResult of extractedDataArray) {
            if (labResult && labResult.labName && labResult.value !== null && labResult.unit && labResult.date) {
                const newLabDocRef = resultsCollectionRef.doc();
                batch.set(newLabDocRef, {
                    labName: labResult.labName,
                    value: labResult.value,
                    unit: labResult.unit,
                    date: admin.firestore.Timestamp.fromDate(new Date(labResult.date)),
                    sourceFile: fileName
                });
            }
        }

        await batch.commit();
        functions.logger.log(`🎉 Successfully created ${extractedDataArray.length} individual lab documents for the app.`);

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


/**
 * Cloud Function to delete Firestore data when a PDF is deleted from Storage.
 */
export const deleteLabData = onObjectDeleted({
    region: 'us-central1',
}, async (event) => {
    const filePath = event.data.name;

    if (!filePath || !filePath.startsWith("lab_reports/")) {
        functions.logger.log(`File ${filePath} was deleted outside 'lab_reports/'. Ignoring.`);
        return;
    }

    const pathParts = filePath.split('/');
    if (pathParts.length < 3) {
        functions.logger.error(`Invalid deleted file path: ${filePath}. Cannot determine user/file.`);
        return;
    }
    const userId = pathParts[1];
    const fileName = pathParts[2];
    
    functions.logger.log(`Deletion detected for file: ${fileName} for user: ${userId}. Cleaning up Firestore data.`);

    const firestore = admin.firestore();
    const batch = firestore.batch();
    
    try {
        const resultsCollectionRef = firestore.collection('users').doc(userId).collection('structured_lab_results');
        const snapshot = await resultsCollectionRef.where('sourceFile', '==', fileName).get();

        if (snapshot.empty) {
            functions.logger.log("No matching lab documents found to delete.");
        } else {
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            functions.logger.log(`Found and deleting ${snapshot.size} structured lab documents.`);
        }

        const rawReportRef = firestore.collection('users').doc(userId).collection('lab_reports').doc(fileName);
        batch.delete(rawReportRef);
        functions.logger.log(`Deleting raw archival document.`);

        await batch.commit();
        functions.logger.log(`✅ Cleanup complete for ${fileName}.`);

    } catch (error) {
        functions.logger.error("Error during data cleanup:", error);
    }
});