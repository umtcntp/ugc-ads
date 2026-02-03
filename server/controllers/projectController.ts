import { Request, Response } from "express";
import { prisma } from "../configs/prisma.js";
import { v2 as cloudinary } from 'cloudinary';
import { GenerateContentConfig, HarmBlockThreshold, HarmCategory } from "@google/genai";
import fs from 'fs';
import path from "path";
import ai from "../configs/ai.js";
import axios from "axios";

const loadImage = (path: string, mimeType: string) => {
    return {
        inlineData: {
            data: fs.readFileSync(path).toString('base64'),
            mimeType
        }
    }
}

export const createProject = async (req: Request, res: Response) => {
    let tempProjectId: string;
    const { userId } = req.auth();
    let isCreditDeducted = false;

    const { name = "New Project", aspectRatio, userPrompt, productName, productDescription, targetLength = 5 } = req.body;
    const images: any = req.files;

    if (images.length < 2 || !productName) {
        return res.status(400).json({ message: "At least two images and a product name are required." });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user || user.credits < 5) {
        return res.status(401).json({ message: "Insufficient credits to create a project." });
    } else {
        // Deduct credits
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: 5 } }
        }).then(() => isCreditDeducted = true)

    }
    try {
        let uploadedImages = await Promise.all(
            images.map(async (item: any) => {
                let result = await cloudinary.uploader.upload(item.path, { resource_type: "image" });
                return result.secure_url;
            })
        )

        const newProject = await prisma.project.create({
            data: {
                name,
                userId,
                productName,
                productDescription,
                userPrompt,
                aspectRatio,
                targetLength: parseInt(targetLength),
                uploadedImages,
                isGenerating: true
            }
        });
        tempProjectId = newProject.id;

        //gemini-3-pro-image-preview
        const model = process.env.GEMINI_IMAGE_MODEL;
        console.log("GEMINI_IMAGE_MODEL:", model);
        if (!model) {
            throw new Error("GEMINI_IMAGE_MODEL is not set in environment variables.");
        }
        const generationConfig: GenerateContentConfig = {
            maxOutputTokens: 8192,
            temperature: 1,
            topP: 0.95,
            responseModalities: ['IMAGE'],
            imageConfig: {
                aspectRatio: aspectRatio || '9:16',
                imageSize: '1K',
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.OFF,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.OFF,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.OFF,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.OFF,
                }
            ]
        }

        //Images to base64 structure for ai model
        const img1base64 = loadImage((images[0].path), images[0].mimetype);
        const img2base64 = loadImage((images[1].path), images[1].mimetype);

        const basePrompt = `Combine the person and product into a realistic photo.
                            Make the person naturally hold or use the product.
                            Match lighting, shadows, scale and perspective.
                            Make the person stand in professional studio lighting.
                            Output ecommerce-quality photo realistic imagery.`;

        const prompt = {
            text: [basePrompt, userPrompt].filter(Boolean).join("\n\n").trim()
        };

        //Generate the image using the ai model
        const aiResponse = await ai.models.generateContent({
            model,
            contents: [img1base64, img2base64, prompt],
            config: generationConfig
        })

        //Check if the response is valid
        if (!aiResponse?.candidates?.[0]?.content?.parts) {
            
	    console.log("AI RESPONSE keys:", {
  		hasCandidates: !!aiResponse?.candidates?.length,
  		finishReason: aiResponse?.candidates?.[0]?.finishReason,
  		promptFeedback: aiResponse?.promptFeedback,
	    });
	throw new Error("AI generation failed. No content returned.");
        }

        const parts = aiResponse.candidates[0].content.parts;

        let finalBuffer: Buffer | null = null;

        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                finalBuffer = Buffer.from(part.inlineData.data, 'base64');
            }
        }

        if (!finalBuffer) {
            throw new Error("Failed to generate image.");
        }

        const base64Image = `data:image/png;base64,${finalBuffer.toString('base64')}`;

        const uploadResult = await cloudinary.uploader.upload(base64Image, { resource_type: "image" });

        //Update the project with generated image URL
        await prisma.project.update({
            where: { id: newProject.id },
            data: {
                generatedImage: uploadResult.secure_url,
                isGenerating: false
            }
        });

        res.json({ projectId: newProject.id });

    } catch (error: any) {
        console.log("GENAI ERROR RAW:", error);
        if (tempProjectId!) {
            // update project status and error message
            await prisma.project.update({
                where: { id: tempProjectId },
                data: { isGenerating: false, error: error.message },
            });
        }
        if (isCreditDeducted) {
            // add credits back
            await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: 5 } },
            });
        }
        res.status(500).json({ message: error.code || error.message })
    }
}

export const createVideo = async (req: Request, res: Response) => {
    const { userId } = req.auth();
    const { projectId } = req.body;
    let isCreditDeducted = false;

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user || user.credits < 10) {
        return res.status(401).json({ message: "Insufficient credits to create a video." });
    }

    //Deteuct credits for video generation
    await prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: 10 } }
    })
    isCreditDeducted = true;

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId, userId },
            include: { user: true }
        });

        if (!project || project.isGenerating) {
            return res.status(404).json({ message: "Generation in progress" });
        };

        if (project.generatedVideo) {
            return res.status(404).json({ message: "Video already generated" });
        };

        await prisma.project.update({
            where: { id: projectId },
            data: { isGenerating: true }
        });

        const prompt = `make the person showcase the product which is ${project.productName} 
                        ${project.productDescription && `and Product Description: ${project.productDescription}`}`;

        const model = process.env.VEO_MODEL;
        if (!model) {
            throw new Error("VEO_MODEL is not set in environment variables.");
        }

        if (!project.generatedImage) {
            throw new Error('Generated image not found');
        }

        const imageRes = await axios.get(project.generatedImage, { responseType: 'arraybuffer' });
	const mimeType = (imageRes.headers?.["content-type"] as string) || "image/jpeg";
        const imageBytes: any = Buffer.from(imageRes.data);
        let operation: any = await ai.models.generateVideos({
            model,
            prompt,
            image: {
                imageBytes: imageBytes.toString('base64'),
                mimeType,
            },
            config: {
                aspectRatio: project?.aspectRatio || '9:16',
                numberOfVideos: 1,
                resolution: '720p',

            }
        });

        while (!operation.done) {
            console.log("Waiting for video generation to complete...")
            //Wait for some time before checking again
            await new Promise((resolve) => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        };

        const filename = `${userId}-${Date.now()}.mp4`;
        const filePath = path.join('videos', filename);

        //Create the images directory if it doesn't exist
        fs.mkdirSync('videos', { recursive: true });
        if (!operation?.response?.generatedVideos?.length) {
    		console.log("VEO RESPONSE (no videos):", JSON.stringify(operation?.response, null, 2));
    		throw new Error(operation?.response?.raiMediaFilterReasons?.[0] || "Video generation returned no video.");
	};

        //download the video
        await ai.files.download({
            file: operation.response.generatedVideos[0].video,
            downloadPath: filePath
        });

        const uploadResult = await cloudinary.uploader.upload(filePath, { resource_type: "video" });

        await prisma.project.update({
            where: { id: projectId },
            data: {
                generatedVideo: uploadResult.secure_url,
                isGenerating: false
            }
        });

        //Delete the local file after upload
        fs.unlinkSync(filePath);
        ""
        res.json({ message: "Video generated successfully", videoUrl: uploadResult.secure_url });

    } catch (error: any) {
        // update project status and error message
        await prisma.project.update({
            where: { id: projectId, userId },
            data: { isGenerating: false, error: error.message },
        });

        if (isCreditDeducted) {
            // add credits back
            await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: 10 } },
            });
        }
        res.status(500).json({ message: error.code || error.message })
    }
}

export const getAllPublishedProjects = async (req: Request, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: { isPublished: true },
        });
        res.json({ projects })
    } catch (error: any) {
        res.status(500).json({ message: error.code || error.message })
    }
}

export const deleteProject = async (req: Request<{ projectId: string }>, res: Response) => {
    try {
        const { userId } = req.auth();
        const { projectId } = req.params;
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        };

        await prisma.project.delete({
            where: { id: projectId, userId }
        });

        res.json({ message: "Project deleted successfully" });

    } catch (error: any) {
        res.status(500).json({ message: error.code || error.message })
    }
}
