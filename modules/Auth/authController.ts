import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import UserModel from "../User/userModel";
import { Request, Response } from "express";
import RoleModel from "../Role/roleModel";

const authRegister = async (req: Request, res: Response) => {
    const { username , password } = req.body;
    const checkUsername = await UserModel.findOne({ username });
    const userRole = await RoleModel.findOne({slug:"user"});
    if (checkUsername) {
        return res.status(422).json({ msg: 'Username is exist' });
    }else{
      try {
        const hassedPasword = await bcrypt.hash(req.body.password,10);
        await UserModel.insertMany({
          ...req.body,
          role: userRole?._id,
          password: hassedPasword,
        });
        const accessToken = jwt.sign({username: username}, process.env.ACCESS_TOKEN_SECRET || "khoidev311",{
          expiresIn:"8h",
        });
        const refreshToken = jwt.sign({username: username , password: password }, process.env.ACCESS_TOKEN_SECRET || "khoidev311",{
          expiresIn:"12h",
        });
        return res.status(200).json({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
};

const authLogin = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Check for existing user
  const user = await UserModel.findOne({ username }).select("+password");
  if (!user) {
      return res.status(400).json({ msg: 'User does not exist' });
  }
  // Validate password
  const isAcceptPassword = await bcrypt.compare(password, user.password);
  if (isAcceptPassword) {
    const accessToken = jwt.sign({username: username}, process.env.ACCESS_TOKEN_SECRET || "khoidev311v",{
      expiresIn:"8h",
    });
    const refreshToken = jwt.sign({username: username , password: password }, process.env.ACCESS_TOKEN_SECRET || "khoidev311",{
      expiresIn:"12h",
    });
    return res.status(200).json({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } else {
     res.status(400).json({ msg: 'Invalid credentials' });
  }
};

const authGetMe = async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const accessToken = jwt.decode(token || "");
  const { username } = Object(accessToken);
  const user = await UserModel.findOne({ username }).populate({path:"role", model:"Role"});
  if (!user) {
      return res.status(400).json({ msg: 'User does not exist' });
  } else {
    res.status(200).json(user);
  }
};


 

export { authRegister, authLogin , authGetMe}