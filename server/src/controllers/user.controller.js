import * as userService from '../services/user.service.js';
import { searchUsersQuerySchema } from '../validation/schemas.js';

export async function search(req, res) {
  const query = searchUsersQuerySchema.parse(req.query);
  const users = await userService.search(req.user._id, query);
  res.json({ users });
}

export async function getOne(req, res) {
  const user = await userService.getById(req.params.id);
  res.json({ user });
}

export async function updateMe(req, res) {
  const user = await userService.updateProfile(req.user._id, req.body);
  res.json({ user });
}
