import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protect /api/* routes — each route also has its own auth check
  if (
    !user &&
    pathname.startsWith('/api/')
  ) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // Redirect unauthenticated users from /dashboard to /login
  if (!user && pathname.startsWith('/dashboard')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users from /login or /register to /dashboard
  if (
    user &&
    (pathname === '/login' || pathname === '/register')
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
