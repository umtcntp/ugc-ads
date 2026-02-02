import { Request, Response } from 'express';
import { prisma } from '../configs/prisma.js';

//Get user credits
export const getUserCredits = async (req: Request, res: Response) => {
    try {
        const { userId } = req.auth();
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
        })
        res.json({ credits: user?.credits })
    } catch (error: any) {
        res.status(500).json({ message: error.code || error.message })
    }
}


//Get all user projects
export const getAllProjects = async (req: Request, res: Response) => {
    try {
        const { userId } = req.auth();
        const projects = await prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ projects })
    } catch (error: any) {
        res.status(500).json({ message: error.code || error.message })
    }
}

//Get project by ID
export const getProjectById = async (req: Request<{ projectId: string }>, res: Response) => {
    try {
        const { userId } = req.auth();
        const { projectId } = req.params;
        const project = await prisma.project.findUnique({
            where: { id: projectId, userId }
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        }
        res.json({ project })
    } catch (error: any) {
        res.status(500).json({ message: error.code || error.message })
    }
}
//Publish or unpublish a project
export const toggleProjectPublish = async (req: Request<{ projectId: string }>, res: Response) => {
    try {
        const { userId } = req.auth();
        const { projectId } = req.params;
        const project = await prisma.project.findUnique({
            where: { id: projectId, userId }
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        }
        if (!project?.generatedImage && !project?.generatedVideo) {
            return res.status(404).json({ message: "Image or video not generated" })
        }

        await prisma.project.update({
            where: { id: projectId },
            data: { isPublished: !project.isPublished }
        });

        res.json({ isPublished: !project.isPublished })
    } catch (error: any) {
        res.status(500).json({ message: error.code || error.message })
    }
}