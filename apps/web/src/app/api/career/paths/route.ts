// API: 职业路径列表 / 删除
// GET  /api/career/paths        — 获取用户所有职业路径
// DELETE /api/career/paths       — 删除指定路径 (Body: { id: string })

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserCareerPaths, deleteCareerPath } from '@zhidu/db/repository';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const paths = await getUserCareerPaths(user.id);

    return NextResponse.json({
      success: true,
      data: paths,
      count: paths.length,
    });
  } catch (err) {
    console.error('[career/paths GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: id' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const ok = await deleteCareerPath(id);

    if (!ok) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[career/paths DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
