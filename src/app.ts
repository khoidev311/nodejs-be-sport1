import express, { Request, Response } from 'express';
import dotenv from "dotenv";
import cors from 'cors';
import userRouter from "../modules/User/userRoute";
import authRouter from "../modules/Auth/authRoute";
import roleRouter from "../modules/Role/roleRoute";
import teamRouter from "../modules/Team/teamRoute";
import leagueRouter from "../modules/Team/teamRoute";
import scoreRouter from "../modules/Score/scoreRoute";
import mongoose from 'mongoose';

//Middleware
// import { authToken } from './middleware/authToken';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;



app.use(express.json());


app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

//auth
app.use("/api/auth", authRouter);

//users
app.use("/api/users",userRouter);

//roles
app.use("/api/roles",roleRouter);

//teams
app.use("/api/teams",teamRouter);

//leagues
app.use("/api/leagues",leagueRouter);

//scores
app.use("/api/scores",scoreRouter);

app.use(cors({
  origin: '*',
  methods: '*',
}));




mongoose.connect("mongodb+srv://khoidev311:8heCdSJRCFliwvfk@server1.a2yvgjo.mongodb.net/").then(()=> {
  console.log("Connected to database!");
  app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
  });
}).catch((err)=> {
  console.log(err.stack);
})

export default app;