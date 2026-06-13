import { bearer, Env, json } from '../../_lib/auth';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = bearer(request);
  if (token) {
    await env.insultrac.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
  }
  return json({ ok: true });
};
