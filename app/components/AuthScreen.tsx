'use client';

import React, { useState } from 'react';
import type { User } from '@/lib/types';
import { api, setToken } from '@/lib/api';

interface AuthScreenProps {
  mode: 'login' | 'setup';
  onAuthed: (user: User) => void;
}

export default function AuthScreen({ mode, onAuthed }: AuthScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'setup' && !name) {
      setError('Name is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setPending(true);
    try {
      const r = mode === 'setup'
        ? await api.setup({ name, email, password })
        : await api.login({ email, password });
      setToken(r.token);
      onAuthed(r.user);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  const isSetup = mode === 'setup';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/insultrac-logo.png"
            alt="InsulTrac"
            className="w-full max-w-sm h-auto mx-auto invert"
          />
          <p className="text-zinc-500 mt-3 text-sm">Mechanical Insulation Field Operations</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <div className="text-center mb-4">
            <div className="text-lg font-semibold">
              {isSetup ? 'Create owner account' : 'Sign in'}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {isSetup
                ? 'First user becomes the Admin. After this, only Admins can add accounts.'
                : 'Enter your email and password.'}
            </div>
          </div>

          <form
            onSubmit={e => { e.preventDefault(); submit(); }}
            className="space-y-3"
          >
            {isSetup && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500">Full name</label>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 mt-1 text-sm focus:outline-none focus:border-emerald-600"
                  placeholder="Brent Barkman"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 mt-1 text-sm focus:outline-none focus:border-emerald-600"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Password</label>
              <input
                type="password"
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 mt-1 text-sm focus:outline-none focus:border-emerald-600"
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-3 rounded-2xl text-sm font-medium"
            >
              {pending ? (isSetup ? 'Creating…' : 'Signing in…') : (isSetup ? 'Create Owner Account' : 'Sign in')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
