import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { clerkMiddleware } from '@clerk/express'
import cors from "cors";
import clerkWebhooks from "./controllers/clerk.js";
import userRouter from "./routes/userRoutes.js";
import projectRouter from "./routes/projectRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5050;

//Middleware
app.use(cors());
app.post('/api/clerk', express.raw({ type: 'application/json' }), clerkWebhooks); // for webhook verification
app.use(express.json());
app.use(clerkMiddleware());

app.get("/", (req: Request, res: Response) => {
    res.send("Server is Live!")
});

app.use('/api/user', userRouter);
app.use('/api/project', projectRouter);

app.listen(PORT, () => {
    console.log(`Server is running at  http://localhost:${PORT}`)
})