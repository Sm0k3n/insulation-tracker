import { bearer, DBUser, Env, err, hashPassword, json, loadCurrentUser, newId, Role, toPublicUser } from '../../_lib/auth';

interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role: Role;
  assignedPO?: string | null;
  phone?: string | null;
}

const ROLES: Role[] = ['Admin', 'Foreman', 'Delivery Driver', 'Employee'];

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await loadCurrentUser(env, bearer(request));
  if (!me) return err(401, 'Not signed in.');
  if (me.role !== 'Admin') return err(403, 'Admin only.');

  const result = await env.insultrac.prepare(`SELECT * FROM users ORDER BY created_at ASC`).all<DBUser>();
  return json({ users: (result.results || []).map(toPublicUser) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await loadCurrentUser(env, bearer(request));
  if (!me) return err(401, 'Not signed in.');
  if (me.role !== 'Admin') return err(403, 'Admin only.');

  const body = (await request.json().catch(() => null)) as CreateUserBody | null;
  if (!body?.name || !body.email || !body.password || !body.role) {
    return err(400, 'Name, email, password, and role are required.');
  }
  if (body.password.length < 8) {
    return err(400, 'Password must be at least 8 characters.');
  }
  if (!ROLES.includes(body.role)) {
    return err(400, 'Invalid role.');
  }

  const email = body.email.trim().toLowerCase();
  const existing = await env.insultrac
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(email)
    .first();
  if (existing) return err(409, 'A user with that email already exists.');

  const id = newId('u');
  const now = new Date().toISOString();
  const { hash, salt } = await hashPassword(body.password);

  await env.insultrac
    .prepare(
      `INSERT INTO users (id, name, email, password_hash, password_salt, role, assigned_po, phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      body.name.trim(),
      email,
      hash,
      salt,
      body.role,
      body.assignedPO?.trim() || null,
      body.phone?.trim() || null,
      now,
    )
    .run();

  return json({
    user: toPublicUser({
      id,
      name: body.name.trim(),
      email,
      password_hash: hash,
      password_salt: salt,
      role: body.role,
      assigned_po: body.assignedPO?.trim() || null,
      phone: body.phone?.trim() || null,
      created_at: now,
      updated_at: null,
    }),
  });
};
