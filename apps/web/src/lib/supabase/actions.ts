'use server';

import { createClient } from './server';
import { redirect } from 'next/navigation';

export async function signUp(formData: { email: string; password: string }) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(formData);
  if (error) throw error;
  redirect('/dashboard');
}

export async function signIn(formData: { email: string; password: string }) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(formData);
  if (error) throw error;
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
