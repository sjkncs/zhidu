// parseStructuredBlocks 单元测试
// 覆盖：标准格式、legacy 格式、action-item 类型、混合内容

import { describe, it, expect } from 'vitest';
import { parseStructuredBlocks, type ParsedBlock } from '../CollapsibleBlock';

describe('parseStructuredBlocks — 标准格式', () => {
  it('纯文本返回单个 text 块', () => {
    const result = parseStructuredBlocks('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', content: 'Hello world' });
  });

  it('解析 thinking 块', () => {
    const input = '<!-- type:thinking -->分析过程<!-- /thinking -->';
    const result = parseStructuredBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('thinking');
    expect(result[0].content).toBe('分析过程');
  });

  it('解析 steps 块（带 count）', () => {
    const input = '<!-- type:steps count:3 -->1. 步骤一\n2. 步骤二\n3. 步骤三<!-- /steps -->';
    const result = parseStructuredBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('steps');
    expect(result[0].count).toBe(3);
  });

  it('解析 todo 块', () => {
    const input = '<!-- type:todo count:2 -->- [ ] 任务1\n- [ ] 任务2<!-- /todo -->';
    const result = parseStructuredBlocks(input);
    expect(result[0].type).toBe('todo');
    expect(result[0].count).toBe(2);
  });

  it('解析 tool-call 块', () => {
    const input = '<!-- type:tool-call -->调用 search_knowledge<!-- /tool-call -->';
    const result = parseStructuredBlocks(input);
    expect(result[0].type).toBe('tool-call');
  });

  it('解析 action-item 块', () => {
    const items = JSON.stringify([
      { label: '查看院校详情', actionType: 'navigate', payload: '/universities/123' },
      { label: '对比院校', actionType: 'compare', payload: '123,456' },
    ]);
    const input = `<!-- type:action-item -->${items}<!-- /action-item -->`;
    const result = parseStructuredBlocks(input);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('action-item');
    // content 应该是 JSON 字符串
    const parsed = JSON.parse(result[0].content);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].label).toBe('查看院校详情');
    expect(parsed[1].actionType).toBe('compare');
  });
});

describe('parseStructuredBlocks — legacy 格式', () => {
  it('解析 legacy thinking 格式', () => {
    const input = '<!-- thinking -->老格式思考<!-- /thinking -->';
    const result = parseStructuredBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('thinking');
    expect(result[0].content).toBe('老格式思考');
  });
});

describe('parseStructuredBlocks — 混合内容', () => {
  it('文本 + thinking + 文本', () => {
    const input = '前面文本<!-- type:thinking -->思考中<!-- /thinking -->后面文本';
    const result = parseStructuredBlocks(input);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', content: '前面文本' });
    expect(result[1].type).toBe('thinking');
    expect(result[2]).toEqual({ type: 'text', content: '后面文本' });
  });

  it('多个块交错', () => {
    const input = [
      '开头文字',
      '<!-- type:thinking -->分析<!-- /thinking -->',
      '中间文字',
      '<!-- type:steps count:2 -->1. A\n2. B<!-- /steps -->',
      '结尾文字',
    ].join('');
    const result = parseStructuredBlocks(input);

    expect(result).toHaveLength(5);
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('thinking');
    expect(result[2].type).toBe('text');
    expect(result[3].type).toBe('steps');
    expect(result[4].type).toBe('text');
  });

  it('action-item 与其他块共存', () => {
    const items = JSON.stringify([{ label: '操作', actionType: 'navigate', payload: '/test' }]);
    const input = [
      '根据分析，建议您：',
      `<!-- type:action-item -->${items}<!-- /action-item -->`,
      '<!-- type:todo count:1 -->- [ ] 完成志愿填报<!-- /todo -->',
    ].join('');
    const result = parseStructuredBlocks(input);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toContain('建议您');
    expect(result[1].type).toBe('action-item');
    expect(result[2].type).toBe('todo');
    expect(result[2].count).toBe(1);
  });
});

describe('parseStructuredBlocks — LLM 笔误容错', () => {
  it('<! -- type:thinking --> (感叹号后有空格) 能正确解析', () => {
    const input = '<! -- type:thinking -->用户想要记账<!-- /thinking -->';
    const result = parseStructuredBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('thinking');
    expect(result[0].content).toBe('用户想要记账');
  });

  it('</-- (错误的闭合标签) 能正确解析', () => {
    const input = '<!-- type:thinking -->分析内容</-- ';
    const result = parseStructuredBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('thinking');
    expect(result[0].content).toBe('分析内容');
  });

  it('<1-- type:thinking --> (数字1替代感叹号) 能正确解析', () => {
    const input = '<1-- type:thinking -->思考过程<!-- /thinking -->';
    const result = parseStructuredBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('thinking');
  });

  it('</thinking> (HTML风格闭合) 能正确解析', () => {
    const input = '<!-- type:thinking -->思考内容</thinking>';
    const result = parseStructuredBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('thinking');
    expect(result[0].content).toBe('思考内容');
  });

  it('混合多种笔误仍能解析', () => {
    const input = '<! -- type:thinking -->分析中</-- 然后根据分析<!-- type:steps count:2 -->1. 搜索\n2. 回答<!-- /steps -->';
    const result = parseStructuredBlocks(input);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].type).toBe('thinking');
  });
});
