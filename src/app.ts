import express from 'express';
import dotenv from "dotenv";
import userRouter from "../modules/User/userRoute";
import authRouter from "../modules/Auth/authRoute";
import roleRouter from "../modules/Role/roleRoute";
import teamRouter from "../modules/Team/teamRoute";
import leagueRouter from "../modules/Team/teamRoute";
import scoreRouter from "../modules/Score/scoreRoute";
import connectDB from "../helper/dbconnect"

//Middleware
// import { authToken } from './middleware/authToken';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());


app.get('/', (req, res) => {
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


try{
  connectDB();
  app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
  });
}
catch (err){
  console.log(err.stack);
}