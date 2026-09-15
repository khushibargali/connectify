import * as authService from '../services/auth.service.js';

export async function register(req, res) {
  const { user, token } = await authService.register(req.body);
  res.status(201).json({ user, token });
}

export async function login(req, res) {
  const { user, token } = await authService.login(req.body);
  res.json({ user, token });
}

export async function me(req, res) {
  res.json({ user: req.user });
}

/** Tokens are stateless; the client discards it. Kept for API symmetry and future revocation. */
export async function logout(_req, res) {
  res.json({ ok: true });
}
