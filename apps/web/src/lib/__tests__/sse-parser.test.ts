// SSE 解析器扩展测试 — choice_prompt + task_update 事件
// 覆盖：新增事件类型解析、边界情况、向后兼容

import { describe, it, expect } from 'vitest';
import { parseSSEStream, type SSEEvent, type ChoicePromptEvent, type TaskUpdateEvent } from '../../lib/sse-parser';

/** 将字符串转为 ReadableStream<Uint8Array> 供解析器消费 */
function toStream(data: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

/** 收集所有 SSE 事件 */
async function collectEvents(data: string): Promise<SSEEvent[]> {
  const reader = toStream(data).getReader();
  const events: SSEEvent[] = [];
  for await (const event of parseSSEStream(reader)) {
    events.push(event);
  }
  return events;
}

// ─── 向后兼容测试 ──────────────────────────────────────────────────────────

describe('SSE parser — 向后兼容', () => {
  it('解析 session 事件', async () => {
    const events = await collectEvents('data: {"type":"session","sessionId":"abc-123"}\n\ndata: [DONE]\n\n');
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'session', sessionId: 'abc-123' });
    expect(events[1]).toEqual({ type: 'done' });
  });

  it('解析 sources 事件', async () => {
    const events = await collectEvents(
      'data: {"type":"sources","sources":[{"title":"Test","snippet":"...","score":0.8}]}\n\ndata: [DONE]\n\n',
    );
    expect(events[0].type).toBe('sources');
    if (events[0].type === 'sources') {
      expect(events[0].sources).toHaveLength(1);
      expect(events[0].sources[0].title).toBe('Test');
    }
  });

  it('解析 content 事件', async () => {
    const events = await collectEvents('data: {"type":"content","delta":"Hello"}\n\ndata: [DONE]\n\n');
    expect(events[0]).toEqual({ type: 'content', delta: 'Hello' });
  });

  it('解析 error 事件', async () => {
    const events = await collectEvents('data: {"type":"error","error":"timeout"}\n\ndata: [DONE]\n\n');
    expect(events[0]).toEqual({ type: 'error', error: 'timeout' });
  });

  it('无 [DONE] 时自动合成 done 事件', async () => {
    const events = await collectEvents('data: {"type":"content","delta":"hi"}\n\n');
    expect(events[events.length - 1]).toEqual({ type: 'done' });
  });
});

// ─── P1: choice_prompt 事件测试 ─────────────────────────────────────────────

describe('SSE parser — choice_prompt 事件', () => {
  it('正确解析 choice_prompt 事件', async () => {
    const payload = JSON.stringify({
      type: 'choice_prompt',
      prompt: {
        question: '需要了解更多信息',
        header: '志愿咨询',
        options: [
          { label: '已有目标院校', description: '我知道想报哪些学校' },
          { label: '从分数开始分析', description: '我有高考分数' },
        ],
        multiSelect: false,
      },
    });
    const events = await collectEvents(`data: ${payload}\n\ndata: [DONE]\n\n`);

    expect(events[0].type).toBe('choice_prompt');
    const choiceEvent = events[0] as ChoicePromptEvent;
    expect(choiceEvent.prompt.question).toBe('需要了解更多信息');
    expect(choiceEvent.prompt.header).toBe('志愿咨询');
    expect(choiceEvent.prompt.options).toHaveLength(2);
    expect(choiceEvent.prompt.options[0].label).toBe('已有目标院校');
    expect(choiceEvent.prompt.multiSelect).toBe(false);
  });

  it('缺少 question 字段时跳过', async () => {
    const payload = JSON.stringify({
      type: 'choice_prompt',
      prompt: { options: [{ label: 'A' }] },
    });
    const events = await collectEvents(`data: ${payload}\n\ndata: [DONE]\n\n`);
    // 应该只有 done 事件，choice_prompt 被跳过
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('done');
  });

  it('缺少 options 数组时跳过', async () => {
    const payload = JSON.stringify({
      type: 'choice_prompt',
      prompt: { question: '选择' },
    });
    const events = await collectEvents(`data: ${payload}\n\ndata: [DONE]\n\n`);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('done');
  });
});

// ─── P3: task_update 事件测试 ───────────────────────────────────────────────

describe('SSE parser — task_update 事件', () => {
  it('正确解析 task_update 事件', async () => {
    const payload = JSON.stringify({
      type: 'task_update',
      task: {
        taskId: 'task-001',
        description: '查询院校数据',
        status: 'in_progress',
      },
    });
    const events = await collectEvents(`data: ${payload}\n\ndata: [DONE]\n\n`);

    expect(events[0].type).toBe('task_update');
    const taskEvent = events[0] as TaskUpdateEvent;
    expect(taskEvent.task.taskId).toBe('task-001');
    expect(taskEvent.task.status).toBe('in_progress');
  });

  it('缺少 taskId 时跳过', async () => {
    const payload = JSON.stringify({
      type: 'task_update',
      task: { status: 'completed' },
    });
    const events = await collectEvents(`data: ${payload}\n\ndata: [DONE]\n\n`);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('done');
  });

  it('缺少 status 时跳过', async () => {
    const payload = JSON.stringify({
      type: 'task_update',
      task: { taskId: 'task-002' },
    });
    const events = await collectEvents(`data: ${payload}\n\ndata: [DONE]\n\n`);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('done');
  });
});

// ─── 混合事件流测试 ─────────────────────────────────────────────────────────

describe('SSE parser — 混合事件流', () => {
  it('按顺序解析多种事件类型', async () => {
    const stream = [
      'data: {"type":"session","sessionId":"s1"}\n\n',
      'data: {"type":"choice_prompt","prompt":{"question":"选择","options":[{"label":"A"},{"label":"B"}]}}\n\n',
      'data: {"type":"content","delta":"根据您的选择..."}\n\n',
      'data: {"type":"task_update","task":{"taskId":"t1","description":"分析中","status":"completed"}}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const events = await collectEvents(stream);

    expect(events).toHaveLength(5);
    expect(events[0].type).toBe('session');
    expect(events[1].type).toBe('choice_prompt');
    expect(events[2].type).toBe('content');
    expect(events[3].type).toBe('task_update');
    expect(events[4].type).toBe('done');
  });
});
