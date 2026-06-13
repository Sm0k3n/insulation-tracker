import { bearer, Env, err, json, loadCurrentUser, toPublicUser } from '../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await loadCurrentUser(env, bearer(request));
  if (!user) return err(401, 'Not signed in.');
  return json({ user: toPublicUser(user) });
};
