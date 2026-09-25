import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import env from "../config/env";
import connectDB from "../helper/dbconnect";
import { errorHandler, notFoundHandler } from "../helper/http";
import userRouter from "../modules/User/userRoute";
import authRouter from "../modules/Auth/authRoute";
import roleRouter from "../modules/Role/roleRoute";
import teamRouter from "../modules/Team/teamRoute";
import leagueRouter from "../modules/League/leagueRoute";
import scoreRouter from "../modules/Score/scoreRoute";
import fixtureRouter from "../modules/Fixture/fixtureRoute";
import rankRouter from "../modules/Rank/rankRoute";
import configRouter from "../modules/Config/configRoute";
import articleRouter from "../modules/Article/articleRoute";
import meRouter from "../modules/Me/meRoute";

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

// Ensure the DB is connected before any /api handler runs (serverless-safe).
app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await connectDB();
    next();
  } catch (error: any) {
    res.status(503).json({ message: "Database unavailable", detail: error.message });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/roles", roleRouter);
app.use("/api/teams", teamRouter);
app.use("/api/leagues", leagueRouter);
app.use("/api/scores", scoreRouter);
app.use("/api/fixtures", fixtureRouter);
app.use("/api/ranks", rankRouter);
app.use("/api/configs", configRouter);
app.use("/api/articles", articleRouter);
app.use("/api/me", meRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// Only bind a port when run directly (local dev). On Vercel, api/index.ts
// exports the app and the platform handles requests.
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(env.port, () => {
        console.log(`Express is listening at http://localhost:${env.port}`);
      });
    })
    .catch((err) => {
      console.error(err.stack);
      process.exit(1);
    });
}

export default app;
