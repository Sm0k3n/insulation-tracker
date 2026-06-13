import { bearer, DBUser, Env, err, hashPassword, json, loadCurrentUser, Role, toPublicUser } from '../../_lib/auth';

interface UpdateBody {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  assignedPO?: string | null;
  phone?: string | null;
}

const ROLES: Role[] = ['Admin', 'Foreman', 'Delivery Driver', 'Employee'];

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const me = await loadCurrentUser(env, bearer(request));
  if (!me) return err(401, 'Not signed in.');
  if (me.role !== 'Admin' && me.id !== params.id) return err(403, 'Forbidden.');

  const id = String(params.id);
  const body = (await request.json().catch(() => null)) as UpdateBody | null;
  if (!body) return err(400, 'Body required.');

  const current = await env.insultrac
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(id)
    .first<DBUser>();
  if (!current) return err(404, 'User not found.');

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name.trim()); }
  if (body.email !== undefined) { fields.push('email = ?'); values.push(body.email.trim().toLowerCase()); }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return err(400, 'Invalid role.');
    if (me.id !== 'admin-bootstrap' && me.role !== 'Admin' && body.role !== current.role) {
      return err(403, 'Only an Admin can change roles.');
    }
    fields.push('role = ?'); values.push(body.role);
  }
  if (body.assignedPO !== undefined) { fields.push('assigned_po = ?'); values.push(body.assignedPO?.trim() || null); }
  if (body.phone !== undefined) { fields.push('phone = ?'); values.push(body.phone?.trim() || null); }
  if (body.password !== undefined) {
    if (body.password.length < 8) return err(400, 'Password must be at least 8 characters.');
    const { hash, salt } = await hashPassword(body.password);
    fields.push('password_hash = ?', 'password_salt = ?');
    values.push(hash, salt);
  }

  if (fields.length === 0) return json({ user: toPublicUser(current) });

  fields.push('updated_at = ?'); values.push(new Date().toISOString());
  values.push(id);

  await env.insultrac
    .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.insultrac
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(id)
    .first<DBUser>();
  return json({ user: toPublicUser(updated!) });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const me = await loadCurrentUser(env, bearer(request));
  if (!me) return err(401, 'Not signed in.');
  if (me.role !== 'Admin') return err(403, 'Admin only.');
  if (me.id === params.id) return err(400, "You can't delete your own account.");

  await env.insultrac.prepare(`DELETE FROM users WHERE id = ?`).bind(String(params.id)).run();
  return json({ ok: true });
};
