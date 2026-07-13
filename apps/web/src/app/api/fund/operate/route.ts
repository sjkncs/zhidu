// API: 资金操作（入金/出金/转账）
// POST /api/fund/operate — 执行资金操作

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

type OperateType = 'deposit' | 'withdraw' | 'transfer' | 'invest' | 'divest';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const body = await request.json();

    const {
      type,
      accountId,
      toAccountId,
      amount,
      title,
      description,
      channel,
      refType,
      refId,
      refNo,
    } = body as {
      type: OperateType;
      accountId: string;
      toAccountId?: string;
      amount: number; // 单位: 分
      title?: string;
      description?: string;
      channel?: string;
      refType?: string;
      refId?: string;
      refNo?: string;
    };

    // 验证参数
    if (!type || !accountId || !amount) {
      return NextResponse.json(
        { error: '缺少必填参数: type, accountId, amount' },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: '金额必须为正数' },
        { status: 400 },
      );
    }

    if (type === 'transfer' && !toAccountId) {
      return NextResponse.json(
        { error: '转账需要指定目标账户 toAccountId' },
        { status: 400 },
      );
    }

    let rpcName: string;
    let rpcParams: Record<string, unknown>;

    switch (type) {
      case 'deposit':
        rpcName = 'fund_deposit';
        rpcParams = {
          p_user_id: auth.user.id,
          p_account_id: accountId,
          p_amount: amount,
          p_title: title ?? '入金',
          p_description: description ?? null,
          p_channel: channel ?? null,
          p_ref_type: refType ?? 'manual',
          p_ref_id: refId ?? null,
          p_ref_no: refNo ?? null,
        };
        break;

      case 'withdraw':
        rpcName = 'fund_withdraw';
        rpcParams = {
          p_user_id: auth.user.id,
          p_account_id: accountId,
          p_amount: amount,
          p_title: title ?? '出金',
          p_description: description ?? null,
          p_channel: channel ?? null,
          p_ref_type: refType ?? 'manual',
          p_ref_id: refId ?? null,
          p_ref_no: refNo ?? null,
        };
        break;

      case 'transfer':
        rpcName = 'fund_transfer';
        rpcParams = {
          p_user_id: auth.user.id,
          p_from_account_id: accountId,
          p_to_account_id: toAccountId!,
          p_amount: amount,
          p_title: title ?? '转账',
          p_description: description ?? null,
        };
        break;

      case 'invest':
        rpcName = 'fund_invest';
        rpcParams = {
          p_user_id: auth.user.id,
          p_account_id: accountId,
          p_amount: amount,
          p_title: title ?? '投资买入',
          p_ref_id: refId ?? null,
          p_ref_no: refNo ?? null,
        };
        break;

      case 'divest':
        rpcName = 'fund_divest';
        rpcParams = {
          p_user_id: auth.user.id,
          p_account_id: accountId,
          p_amount: amount,
          p_title: title ?? '投资卖出回款',
          p_ref_id: refId ?? null,
          p_ref_no: refNo ?? null,
        };
        break;

      default:
        return NextResponse.json(
          { error: `不支持的操作类型: ${type}` },
          { status: 400 },
        );
    }

    const { data, error } = await supabase.rpc(rpcName, rpcParams);

    if (error) {
      // 提取用户友好的错误信息
      const errMsg = error.message || '';
      if (errMsg.includes('Insufficient balance')) {
        return NextResponse.json(
          { error: '余额不足' },
          { status: 400 },
        );
      }
      if (errMsg.includes('not found')) {
        return NextResponse.json(
          { error: '账户不存在或已冻结' },
          { status: 404 },
        );
      }
      throw error;
    }

    // 获取操作后的账户余额
    const { data: account } = await supabase
      .from('fund_accounts')
      .select('id, name, balance, total_deposited, total_withdrawn')
      .eq('id', accountId)
      .single();

    const typeLabels: Record<OperateType, string> = {
      deposit: '入金',
      withdraw: '出金',
      transfer: '转账',
      invest: '投资买入',
      divest: '投资卖出',
    };

    return NextResponse.json({
      success: true,
      ledgerId: data,
      type: typeLabels[type],
      amount,
      account,
    });
  } catch (err) {
    console.error('[fund/operate POST]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '资金操作失败' }, { status: 500 });
  }
}
