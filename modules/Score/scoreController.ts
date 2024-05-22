import ScoreModel from "./scoreModel";


const getScores = async (req, res) => {
  try {
    const roles = await ScoreModel.find({}).populate({path:"host_team",model:"Team"}).populate({path:"guest_team",model:"Team"});
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getScoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await ScoreModel.findById(id);
    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createScore = async (req, res) => {
    try {
      const role = await ScoreModel.create(req.body);
      res.status(200).json(role);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

const updateScore = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await ScoreModel.findByIdAndUpdate(id, req.body);

    if (!role) {
      return res.status(404).json({ message: "Score not found" });
    }

    const updatedScore = await ScoreModel.findById(id);
    res.status(200).json(updatedScore);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteScore = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await ScoreModel.findByIdAndDelete(id);

    if (!role) {
      return res.status(404).json({ message: "Score not found" });
    }

    res.status(200).json({ message: "Score deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getScores,
  getScoreById,
  createScore,
  updateScore,
  deleteScore,
};
