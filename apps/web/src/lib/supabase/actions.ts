'use server';

import { createClient } from './server';
import { redirect } from 'next/navigation';

export async function signUp(formData: {
  email: string;
  password: string;
  province?: string;
  grade?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  });
  if (error) throw error;

  // Update profile with additional fields
  if (data.user && (formData.province || formData.grade)) {
    await supabase
      .from('profiles')
      .update({
        province: formData.province ?? null,
        grade: formData.grade ?? null,
      })
      .eq('id', data.user.id);
  }

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
