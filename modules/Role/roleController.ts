import RoleModel from "./roleModel";


const getRoles = async (req, res) => {
  try {
    const roles = await RoleModel.find({});
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await RoleModel.findById(id);
    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createRole = async (req, res) => {
    try {
      const role = await RoleModel.create(req.body);
      res.status(200).json(role);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await RoleModel.findByIdAndUpdate(id, req.body);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const updatedRole = await RoleModel.findById(id);
    res.status(200).json(updatedRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await RoleModel.findByIdAndDelete(id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};
