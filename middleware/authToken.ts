import  jwt  from 'jsonwebtoken';
import { NextFunction, Request, Response } from "express";
import UserModel from '../modules/User/userModel';
import RoleModel from '../modules/Role/roleModel';

const authAdminToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const accessToken = jwt.decode(token || "");
  const { username } = Object(accessToken);
  const user = await UserModel.findOne({ username }).populate({path:"role", model:"Role"});
  if(!user){
    return res.status(404).json({ msg: 'User is invailid' });
  }
  if(Object(user)?.role?.slug === "admin"){
     next();
  }else{
    return res.status(401).json({ msg: 'User does not accept to api' });
  }

}

export {authAdminToken}