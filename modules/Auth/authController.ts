import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import UserModel from "../User/userModel";

const authRegister = async (req, res) => {
    const { username } = req.body;
    const checkUsername = await UserModel.findOne({ username });
    if (checkUsername) {
        return res.status(422).json({ msg: 'Username is exist' });
    }else{
      try {
        const hassedPasword = await bcrypt.hash(req.body.password,10);
        const users = await UserModel.insertMany({
          ...req.body,
          password: hassedPasword,
        });
        res.status(200).json(users);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
};

const authLogin = async (req, res) => {
  const { username, password } = req.body;

  // Check for existing user
  const user = await UserModel.findOne({ username }).select("+password");
  if (!user) {
      return res.status(400).json({ msg: 'User does not exist' });
  }
  // Validate password
  const isAcceptPassword = bcrypt.compare(password, user.password);
  if (isAcceptPassword) {
    const accessToken = jwt.sign({username: username}, process.env.ACCESS_TOKEN_SECRET,{
      expiresIn:"1000s",
    });
    return res.status(200).json({
      access_token: accessToken,
      refresh_token: accessToken,
    });
  } else {
     res.status(400).json({ msg: 'Invalid credentials' });
  }
};
 

export { authRegister, authLogin }