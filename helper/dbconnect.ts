import mongoose from 'mongoose';


const connectDB = async () => {
  await  mongoose.connect("mongodb+srv://khoidev311:8heCdSJRCFliwvfk@server1.a2yvgjo.mongodb.net/").then(()=> {
    console.log("Connected to database!");
  
  })
}

export default connectDB;