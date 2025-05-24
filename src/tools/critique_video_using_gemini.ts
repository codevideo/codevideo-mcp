import { IAction } from "@fullstackcraftllc/codevideo-types"
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import { getCurrentActionsOrThrow } from "./get_current_actions";

export const critiqueVideoUsingGemini = async (videoPath: string, actions?: Array<IAction>) => {
    // Use provided actions or retrieve from storage
    const actionsToUse = actions || getCurrentActionsOrThrow();
    
    // Check if GEMINI_API_KEY is set in the environment
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set')
    }

    // Initialize the Gemini API client
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    const prompt = `You are an expert senior software engineer and educator, and skilled in describing software concepts in a way that is easy for students to understand. You are going to critique a procedurally generated software video lesson for clarity, accuracy, and correctness. The video and the lesson actions are attached. Your tasks:
    
    1. Watch the video and read the lesson actions.
    2. Critique the video for clarity, accuracy, and correctness. Of particular note is any audio artifacts or strange wordings. Do not suggest any new material, only critique the existing material.
    3. Provide a summary of your critique, including any errors or inaccuracies you found, and at what action they occur at.`

    try {
        // Read the video file as a binary blob for the API
        const videoBuffer = fs.readFileSync(videoPath)
        const videoBase64 = videoBuffer.toString('base64')

        // Convert actions array to JSON string
        const actionsJson = JSON.stringify(actionsToUse, null, 2)

        // Prepare the request with content parts including text and file data
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro-preview-05-06',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            fileData: {
                                mimeType: 'video/mp4',
                                fileUri: `data:video/mp4;base64,${videoBase64}`
                            }
                        },
                        {
                            text: `Here are the lesson actions in JSON format:\n\n${actionsJson}`
                        }
                    ]
                }
            ]
        })

        // Get the response text
        const result = response.text
        return result || "No critique was generated"
    } catch (error: unknown) {
        console.error('Error during Gemini API call:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to critique video using Gemini: ${errorMessage}`)
    }
}