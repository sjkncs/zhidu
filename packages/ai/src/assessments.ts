// 智渡测评系统 — MBTI性格测评 + 霍兰德职业兴趣测评
// 提供完整的题目、计分算法和结果描述

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

export interface MBTIQuestion {
  id: number;
  dimension: 'EI' | 'SN' | 'TF' | 'JP';
  text: string;
  optionA: { text: string; pole: string };
  optionB: { text: string; pole: string };
}

export interface HollandQuestion {
  id: number;
  dimension: 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
  text: string;
}

export interface MBTIResult {
  type: string;
  dimensions: { EI: number; SN: number; TF: number; JP: number };
  description: string;
  strengths: string[];
  suggestedMajors: string[];
  suggestedCareers: string[];
}

export interface HollandResult {
  code: string;
  scores: { R: number; I: number; A: number; S: number; E: number; C: number };
  description: string;
  suggestedMajors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MBTI 题目（28题，每维度7题）
// ─────────────────────────────────────────────────────────────────────────────

const mbtiQuestions: MBTIQuestion[] = [
  // ── E/I 维度（外向/内向）──
  {
    id: 1,
    dimension: 'EI',
    text: '在社交聚会中，你通常会：',
    optionA: { text: '与很多人交流，享受热闹的氛围', pole: 'E' },
    optionB: { text: '只和少数熟悉的人深入交谈', pole: 'I' },
  },
  {
    id: 2,
    dimension: 'EI',
    text: '周末休息时，你更倾向于：',
    optionA: { text: '和朋友一起外出活动', pole: 'E' },
    optionB: { text: '独自在家看书、看电影或独处', pole: 'I' },
  },
  {
    id: 3,
    dimension: 'EI',
    text: '当你需要充电恢复精力时，你会选择：',
    optionA: { text: '和朋友们聚在一起聊天', pole: 'E' },
    optionB: { text: '找一个安静的地方独处', pole: 'I' },
  },
  {
    id: 4,
    dimension: 'EI',
    text: '在团队讨论中，你通常：',
    optionA: { text: '积极发言，边想边说', pole: 'E' },
    optionB: { text: '先仔细思考，再表达观点', pole: 'I' },
  },
  {
    id: 5,
    dimension: 'EI',
    text: '面对新环境时，你会：',
    optionA: { text: '很快融入并结交新朋友', pole: 'E' },
    optionB: { text: '需要一段时间观察后才慢慢适应', pole: 'I' },
  },
  {
    id: 6,
    dimension: 'EI',
    text: '你更喜欢的沟通方式是：',
    optionA: { text: '面对面交流或打电话', pole: 'E' },
    optionB: { text: '通过文字消息或邮件', pole: 'I' },
  },
  {
    id: 7,
    dimension: 'EI',
    text: '在学习或工作时，你倾向于：',
    optionA: { text: '在开放的环境中与他人协作', pole: 'E' },
    optionB: { text: '在安静的环境中独立思考', pole: 'I' },
  },

  // ── S/N 维度（感觉/直觉）──
  {
    id: 8,
    dimension: 'SN',
    text: '你更关注：',
    optionA: { text: '眼前的事实和具体细节', pole: 'S' },
    optionB: { text: '未来的可能性和整体趋势', pole: 'N' },
  },
  {
    id: 9,
    dimension: 'SN',
    text: '阅读一篇文章时，你更注意：',
    optionA: { text: '具体的数据和事实描述', pole: 'S' },
    optionB: { text: '文章背后的含义和启发', pole: 'N' },
  },
  {
    id: 10,
    dimension: 'SN',
    text: '解决问题时，你更偏好：',
    optionA: { text: '按照已有的经验和方法去做', pole: 'S' },
    optionB: { text: '尝试新的思路和创新的方案', pole: 'N' },
  },
  {
    id: 11,
    dimension: 'SN',
    text: '描述一件事情时，你倾向于：',
    optionA: { text: '按照时间顺序，详细地讲述经过', pole: 'S' },
    optionB: { text: '跳跃性地讲述，注重关联和意义', pole: 'N' },
  },
  {
    id: 12,
    dimension: 'SN',
    text: '你更信赖：',
    optionA: { text: '亲身经验和实际验证', pole: 'S' },
    optionB: { text: '直觉和内心的预感', pole: 'N' },
  },
  {
    id: 13,
    dimension: 'SN',
    text: '选择专业或职业时，你更看重：',
    optionA: { text: '实用性强、就业前景明确', pole: 'S' },
    optionB: { text: '符合个人理想、有发展空间', pole: 'N' },
  },
  {
    id: 14,
    dimension: 'SN',
    text: '你更喜欢哪种学习方式：',
    optionA: { text: '按照教材和大纲一步步学习', pole: 'S' },
    optionB: { text: '自由探索感兴趣的主题', pole: 'N' },
  },

  // ── T/F 维度（思考/情感）──
  {
    id: 15,
    dimension: 'TF',
    text: '做决定时，你更看重：',
    optionA: { text: '逻辑分析和客观事实', pole: 'T' },
    optionB: { text: '个人价值观和对他人的影响', pole: 'F' },
  },
  {
    id: 16,
    dimension: 'TF',
    text: '当朋友向你倾诉烦恼时，你通常会：',
    optionA: { text: '帮他分析问题，提供解决方案', pole: 'T' },
    optionB: { text: '先倾听和安慰，表达理解和共情', pole: 'F' },
  },
  {
    id: 17,
    dimension: 'TF',
    text: '在评价别人的工作时，你倾向于：',
    optionA: { text: '直接指出优缺点，注重公正客观', pole: 'T' },
    optionB: { text: '注意措辞和方式，照顾对方感受', pole: 'F' },
  },
  {
    id: 18,
    dimension: 'TF',
    text: '你认为更重要的是：',
    optionA: { text: '坚持原则和真理', pole: 'T' },
    optionB: { text: '维护和谐的人际关系', pole: 'F' },
  },
  {
    id: 19,
    dimension: 'TF',
    text: '面对冲突时，你会：',
    optionA: { text: '就事论事，用理性来解决问题', pole: 'T' },
    optionB: { text: '考虑各方的感受，寻求折中方案', pole: 'F' },
  },
  {
    id: 20,
    dimension: 'TF',
    text: '你更欣赏哪种老师：',
    optionA: { text: '知识渊博、逻辑清晰、要求严格', pole: 'T' },
    optionB: { text: '亲切耐心、关心学生、鼓励为主', pole: 'F' },
  },
  {
    id: 21,
    dimension: 'TF',
    text: '对于规则和制度，你认为：',
    optionA: { text: '应该严格执行，保证公平', pole: 'T' },
    optionB: { text: '应该有弹性，考虑特殊情况', pole: 'F' },
  },

  // ── J/P 维度（判断/知觉）──
  {
    id: 22,
    dimension: 'JP',
    text: '对于日程安排，你更喜欢：',
    optionA: { text: '提前计划好，按部就班执行', pole: 'J' },
    optionB: { text: '保持灵活，随机应变', pole: 'P' },
  },
  {
    id: 23,
    dimension: 'JP',
    text: '面对deadline，你通常：',
    optionA: { text: '早早完成，不喜欢拖延的感觉', pole: 'J' },
    optionB: { text: '到最后阶段才集中精力完成', pole: 'P' },
  },
  {
    id: 24,
    dimension: 'JP',
    text: '你的书桌或房间通常是：',
    optionA: { text: '整洁有序，东西各有固定位置', pole: 'J' },
    optionB: { text: '看起来有些乱，但自己知道东西在哪', pole: 'P' },
  },
  {
    id: 25,
    dimension: 'JP',
    text: '出门旅行时，你更偏好：',
    optionA: { text: '提前做好详细的行程安排', pole: 'J' },
    optionB: { text: '只定大方向，到了再随意安排', pole: 'P' },
  },
  {
    id: 26,
    dimension: 'JP',
    text: '做选择时（如买东西），你通常：',
    optionA: { text: '快速决定，不喜欢犹豫不决', pole: 'J' },
    optionB: { text: '多方比较，保留更多选择余地', pole: 'P' },
  },
  {
    id: 27,
    dimension: 'JP',
    text: '你更享受：',
    optionA: { text: '完成任务后的成就感', pole: 'J' },
    optionB: { text: '探索过程中的新发现', pole: 'P' },
  },
  {
    id: 28,
    dimension: 'JP',
    text: '当计划突然改变时，你会：',
    optionA: { text: '感到不安，希望尽快重新规划', pole: 'J' },
    optionB: { text: '觉得还好，享受意外带来的新鲜感', pole: 'P' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 霍兰德题目（36题，每维度6题）
// ─────────────────────────────────────────────────────────────────────────────

const hollandQuestions: HollandQuestion[] = [
  // ── R 实际型（Realistic）──
  { id: 1, dimension: 'R', text: '使用工具或器械进行动手操作' },
  { id: 2, dimension: 'R', text: '修理或组装电子设备' },
  { id: 3, dimension: 'R', text: '在户外进行体力劳动或运动' },
  { id: 4, dimension: 'R', text: '制作手工艺品或模型' },
  { id: 5, dimension: 'R', text: '操作机械设备或驾驶交通工具' },
  { id: 6, dimension: 'R', text: '种植花草或照顾动物' },

  // ── I 研究型（Investigative）──
  { id: 7, dimension: 'I', text: '研究科学问题并进行实验' },
  { id: 8, dimension: 'I', text: '分析数据和寻找事物之间的规律' },
  { id: 9, dimension: 'I', text: '阅读学术论文或科普书籍' },
  { id: 10, dimension: 'I', text: '解决复杂的数学或逻辑问题' },
  { id: 11, dimension: 'I', text: '探索未知的领域和新知识' },
  { id: 12, dimension: 'I', text: '对事物进行深入调查和研究' },

  // ── A 艺术型（Artistic）──
  { id: 13, dimension: 'A', text: '绘画、摄影或进行视觉艺术创作' },
  { id: 14, dimension: 'A', text: '演奏乐器或唱歌' },
  { id: 15, dimension: 'A', text: '写作诗歌、小说或散文' },
  { id: 16, dimension: 'A', text: '设计服装、室内装饰或海报' },
  { id: 17, dimension: 'A', text: '参加戏剧表演或舞蹈' },
  { id: 18, dimension: 'A', text: '欣赏艺术作品并发表自己的看法' },

  // ── S 社会型（Social）──
  { id: 19, dimension: 'S', text: '帮助他人解决困难或烦恼' },
  { id: 20, dimension: 'S', text: '教别人学习新知识或新技能' },
  { id: 21, dimension: 'S', text: '参与志愿者服务或公益活动' },
  { id: 22, dimension: 'S', text: '倾听他人的想法并给予建议' },
  { id: 23, dimension: 'S', text: '组织团队活动并协调人际关系' },
  { id: 24, dimension: 'S', text: '关心社区发展和公共事务' },

  // ── E 企业型（Enterprising）──
  { id: 25, dimension: 'E', text: '领导一个团队或组织完成目标' },
  { id: 26, dimension: 'E', text: '说服别人接受你的观点或方案' },
  { id: 27, dimension: 'E', text: '策划和推广大型活动或项目' },
  { id: 28, dimension: 'E', text: '创业或经营自己的生意' },
  { id: 29, dimension: 'E', text: '参加辩论或公开演讲' },
  { id: 30, dimension: 'E', text: '制定策略并做出重要决策' },

  // ── C 常规型（Conventional）──
  { id: 31, dimension: 'C', text: '整理和归档文件资料' },
  { id: 32, dimension: 'C', text: '编制表格和处理财务数据' },
  { id: 33, dimension: 'C', text: '按照规范和流程完成工作任务' },
  { id: 34, dimension: 'C', text: '核对和校对文档中的错误' },
  { id: 35, dimension: 'C', text: '制定详细的计划和时间表' },
  { id: 36, dimension: 'C', text: '使用办公软件进行数据录入和统计' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MBTI 16型描述
// ─────────────────────────────────────────────────────────────────────────────

interface MBTITypeInfo {
  description: string;
  strengths: string[];
  suggestedMajors: string[];
  suggestedCareers: string[];
}

const mbtiTypeInfo: Record<string, MBTITypeInfo> = {
  ISTJ: {
    description: '安静、严肃，通过全面性和可靠性来达到目标。实际、有序、注重事实、有逻辑、现实主义者。在决定了要做什么之后，会坚定地一步步完成，不受外界干扰。喜欢把事情安排得井井有条，重视传统和忠诚。',
    strengths: ['责任心强', '做事有条理', '注重细节', '踏实可靠', '意志坚定'],
    suggestedMajors: ['会计学', '审计学', '土木工程', '计算机科学', '法律', '行政管理', '财务管理', '质量管理'],
    suggestedCareers: ['会计师', '审计师', '项目经理', '系统管理员', '军官', '法官', '银行经理', '质量检测员'],
  },
  ISFJ: {
    description: '安静、友好、有责任心。注重履行义务，稳定、务实、体贴他人。善于关注他人的感受和需求，并愿意为他人提供具体的帮助。做事认真负责，重视安全和稳定的环境。',
    strengths: ['热心助人', '耐心细致', '忠诚可靠', '观察力敏锐', '务实稳重'],
    suggestedMajors: ['护理学', '教育学', '社会工作', '学前教育', '临床医学', '营养学', '图书馆学', '人力资源'],
    suggestedCareers: ['护士', '小学教师', '社工', '行政助理', '图书馆管理员', '幼儿教育工作者', '医疗技术人员', '客户服务专员'],
  },
  INFJ: {
    description: '寻求思想、关系和物质世界之间的意义和联系。希望了解什么能够激励人，对人有很强的洞察力。有责任心，坚持自己的价值观。希望自己的工作能够有意义地服务他人。',
    strengths: ['富有远见', '有同理心', '意志坚定', '有创造力', '善于洞察'],
    suggestedMajors: ['心理学', '社会学', '哲学', '中文', '教育学', '新闻传播学', '艺术治疗', '人力资源开发'],
    suggestedCareers: ['心理咨询师', '作家', '大学教授', '人力资源顾问', '社会工作者', '教育工作者', '职业规划师', 'UX设计师'],
  },
  INTJ: {
    description: '在实现自己的想法和达成目标方面有创新的想法和非凡的动力。能很快洞察到外界事物间的规律，并形成系统的规划。有长远眼光，注重独立思考，对自己和他人要求较高。',
    strengths: ['战略思维', '独立自主', '意志坚强', '追求卓越', '善于规划'],
    suggestedMajors: ['计算机科学', '电子工程', '建筑学', '经济学', '物理学', '数学', '法学', '工商管理(MBA方向)'],
    suggestedCareers: ['科学家', '系统架构师', '战略顾问', '投资分析师', '大学教授', '工程师', '律师', '企业高管'],
  },
  ISTP: {
    description: '容忍且灵活，是安静的观察者，直到问题出现，然后迅速行动找到可行的解决方案。善于分析事物运作的原理，对因果关系非常敏感，能以客观的态度处理问题。',
    strengths: ['动手能力强', '冷静客观', '适应力强', '善于解决问题', '高效务实'],
    suggestedMajors: ['机械工程', '计算机科学', '电子信息工程', '体育教育', '航空航天工程', '法医学', '数据科学', '工业设计'],
    suggestedCareers: ['工程师', '数据分析师', '法医', '飞行员', '消防员', '运动员', '系统管理员', '技术专家'],
  },
  ISFP: {
    description: '安静、友好、敏感且善良。享受当前，喜欢拥有自己的空间，按自己的方式来安排生活。喜欢通过行动而非言语来表达自己，重视实际和具体。对艺术和美学有天然的感悟力。',
    strengths: ['温和善良', '审美能力强', '灵活适应', '忠于自己', '感性细腻'],
    suggestedMajors: ['艺术设计', '音乐学', '舞蹈学', '摄影', '园林设计', '服装设计', '动物科学', '康复治疗学'],
    suggestedCareers: ['平面设计师', '音乐教师', '摄影师', '花艺师', '室内设计师', '舞蹈演员', '兽医', '时装设计师'],
  },
  INFP: {
    description: '理想主义者，忠于自己的价值观和对自己重要的人。希望外部生活与内在价值观保持一致。适应力强，灵活变通，除非违背自己的价值观。善于发现并发展他人的潜能。',
    strengths: ['理想主义', '富有同理心', '适应力强', '有创造力', '忠于价值观'],
    suggestedMajors: ['中文', '英语', '心理学', '社会学', '哲学', '社会工作', '编辑出版', '戏剧影视文学'],
    suggestedCareers: ['作家', '心理咨询师', '社会工作者', '编辑', '翻译', '非营利组织工作者', '艺术治疗师', '大学教授'],
  },
  INTP: {
    description: '对任何感兴趣的事物寻求找到合理的解释。喜欢进行理论性和抽象性的探讨，热衷于运用逻辑分析问题。安静、内向、灵活，但对自己的学术领域充满热情。',
    strengths: ['逻辑分析强', '富有想象力', '客观理性', '求知欲旺盛', '独立思考'],
    suggestedMajors: ['数学', '物理学', '哲学', '计算机科学', '统计学', '经济学', '化学', '天文学'],
    suggestedCareers: ['数学家', '软件工程师', '大学教授', '哲学家', '数据科学家', '系统分析师', '经济学家', '科研人员'],
  },
  ESTP: {
    description: '灵活、容忍，采用实用的方法来获得即时的结果。注重此时此地，自发地享受每一刻。善于快速解决日常问题，对数字和机械有天生的敏感性。',
    strengths: ['行动力强', '善于交际', '务实灵活', '大胆冒险', '观察敏锐'],
    suggestedMajors: ['市场营销', '体育教育', '公安学', '旅游管理', '国际商务', '新闻传播', '表演', '运动训练'],
    suggestedCareers: ['企业家', '销售经理', '运动员', '消防员', '警察', '旅游向导', '股票交易员', '急诊医生'],
  },
  ESFP: {
    description: '外向、友好、接受力强。热爱生活、热爱人、热爱物质享受。享受与他人一起做事的乐趣。善于在工作中运用常识使事情变得有趣。在人群中很受欢迎。',
    strengths: ['热情开朗', '善于沟通', '观察力强', '适应力好', '乐于助人'],
    suggestedMajors: ['旅游管理', '表演', '播音主持', '市场营销', '学前教育', '护理学', '运动训练', '酒店管理'],
    suggestedCareers: ['演员', '活动策划', '导游', '销售代表', '公关专员', '健身教练', '幼儿教师', '护士'],
  },
  ENFP: {
    description: '热情洋溢、富有想象力。认为生活充满了可能性。能迅速将事件和信息联系起来做出判断。需要很多他人的肯定，也乐于给予赞赏和支持。善于激励他人。',
    strengths: ['富有热情', '有创造力', '善于沟通', '灵活变通', '善于激励他人'],
    suggestedMajors: ['新闻传播学', '广告学', '心理学', '英语', '市场营销', '戏剧影视', '公共关系', '教育学'],
    suggestedCareers: ['记者', '广告创意', '公关经理', '培训师', '创业者', '编剧', '市场营销', '咨询师'],
  },
  ENTP: {
    description: '敏捷、聪明，在很多方面直言不讳。在解决新的、具有挑战性的问题时机智灵活，善于产生概念性可能性并分析。善于理解他人，厌倦常规和重复。',
    strengths: ['思维敏捷', '善于辩论', '创新能力强', '善于分析', '适应力强'],
    suggestedMajors: ['法学', '工商管理', '计算机科学', '经济学', '新闻学', '政治学', '创业管理', '国际关系'],
    suggestedCareers: ['律师', '企业家', '战略顾问', '投资银行家', '记者', '政治家', '创意总监', '大学教授'],
  },
  ESTJ: {
    description: '实际、现实主义、事实的。果断，一旦决定就迅速采取行动。善于组织项目和人力来完成任务。关注细节和日常事务，重视逻辑和传统。',
    strengths: ['组织能力出色', '果断坚定', '责任心强', '注重效率', '务实可靠'],
    suggestedMajors: ['工商管理', '会计学', '法学', '行政管理', '物流管理', '工程管理', '金融学', '人力资源管理'],
    suggestedCareers: ['项目经理', '企业管理者', '银行经理', '军官', '学校校长', '法官', '供应链管理', '财务经理'],
  },
  ESFJ: {
    description: '热心肠、有责任心、合作性强。希望环境和睦，并为此坚定努力。喜欢被欣赏和认可。通常记忆力好，对别人的需求很敏感，善于照顾他人。',
    strengths: ['热心周到', '善于合作', '忠诚可靠', '组织能力强', '善于照顾他人'],
    suggestedMajors: ['护理学', '教育学', '社会工作', '人力资源管理', '公共管理', '旅游管理', '学前教育', '市场营销'],
    suggestedCareers: ['教师', '护士', '人力资源经理', '社会工作者', '客户服务经理', '活动策划', '行政管理人员', '社区工作者'],
  },
  ENFJ: {
    description: '热情、有同理心、响应性强、负责任。高度关注他人的情感、需求和动机。善于发现他人的潜能并希望帮助他们发挥。通常具有鼓舞人心的领导力。',
    strengths: ['领导能力强', '有同理心', '善于激励', '有组织力', '善解人意'],
    suggestedMajors: ['教育学', '心理学', '人力资源管理', '公共关系', '新闻传播', '社会学', '政治学', '培训与发展'],
    suggestedCareers: ['教师', '培训师', '人力资源总监', '非营利组织领导', '公关经理', '政治顾问', '大学教授', '企业文化专员'],
  },
  ENTJ: {
    description: '坦率果断，能够担当领导角色。善于快速发现不合理和低效率的程序和政策，并加以纠正。喜欢做长远规划和设定目标。通常见多识广、博览群书。',
    strengths: ['领导力卓越', '战略眼光', '果断高效', '善于规划', '勇于挑战'],
    suggestedMajors: ['工商管理', '法学', '经济学', '金融学', '计算机科学', '政治学', '工程管理', '国际商务'],
    suggestedCareers: ['CEO', '企业管理者', '律师', '投资银行家', '管理顾问', '企业家', '政治家', '大学校长'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 霍兰德各维度描述与专业推荐
// ─────────────────────────────────────────────────────────────────────────────

interface HollandDimensionInfo {
  name: string;
  description: string;
  suggestedMajors: string[];
}

const hollandDimensionInfo: Record<string, HollandDimensionInfo> = {
  R: {
    name: '实际型（R）',
    description: '喜欢使用工具、机器或进行体力活动。偏好与物体、植物或动物打交道的工作环境，注重实际操作和动手能力。性格特点为务实、稳重、坚毅。',
    suggestedMajors: ['机械工程', '土木工程', '电气工程', '建筑学', '农业科学', '体育教育', '计算机硬件', '测绘工程', '动物医学', '工业设计'],
  },
  I: {
    name: '研究型（I）',
    description: '喜欢观察、学习、研究、分析和解决问题。偏好需要智力和创造力的工作环境，善于独立思考和探索未知。性格特点为好奇、理性、严谨。',
    suggestedMajors: ['数学', '物理学', '化学', '生物学', '计算机科学', '心理学', '经济学', '统计学', '天文学', '哲学'],
  },
  A: {
    name: '艺术型（A）',
    description: '喜欢通过艺术、创作、设计和表演来表达自己。偏好开放、自由、能够发挥创造力的工作环境。性格特点为有想象力、感情丰富、追求独特。',
    suggestedMajors: ['视觉传达设计', '音乐学', '舞蹈学', '戏剧影视', '中文', '建筑学', '广告学', '数字媒体艺术', '摄影', '动画'],
  },
  S: {
    name: '社会型（S）',
    description: '喜欢与人合作，帮助、教导、治疗或启发他人。偏好能够服务社会、与人交流的工作环境。性格特点为友善、有耐心、善解人意。',
    suggestedMajors: ['教育学', '心理学', '社会工作', '护理学', '人力资源管理', '公共管理', '社会学', '学前教育', '康复治疗', '特殊教育'],
  },
  E: {
    name: '企业型（E）',
    description: '喜欢领导和影响他人，追求组织目标或经济收益。偏好竞争性、需要领导力的工作环境。性格特点为自信、果断、善于交际、有野心。',
    suggestedMajors: ['工商管理', '市场营销', '国际商务', '法学', '政治学', '金融学', '保险学', '新闻传播', '公共关系', '创业管理'],
  },
  C: {
    name: '常规型（C）',
    description: '喜欢有序、系统化的工作，注重细节和准确性。偏好有明确规则、需要精确的工作环境。性格特点为谨慎、有条理、可靠、注重效率。',
    suggestedMajors: ['会计学', '审计学', '财务管理', '图书情报', '行政管理', '统计学', '信息管理', '税务学', '保险精算', '数据科学'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 霍兰德组合码描述生成
// ─────────────────────────────────────────────────────────────────────────────

function getHollandCodeDescription(code: string): string {
  const parts = code.split('');
  const names = parts.map(p => hollandDimensionInfo[p]?.name ?? p).join(' + ');
  const descriptions = parts.map(p => hollandDimensionInfo[p]?.description ?? '');

  return `你的霍兰德职业兴趣代码为"${code}"（${names}）。\n\n` +
    descriptions.join('\n\n') +
    '\n\n这三个维度的组合反映了你多元化的职业兴趣倾向。建议在选择专业时，优先考虑与这些特质相匹配的领域，以获得更大的职业满足感和成就感。';
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开 API
// ─────────────────────────────────────────────────────────────────────────────

/** 获取 MBTI 全部题目 */
export function getMBTIQuestions(): MBTIQuestion[] {
  return mbtiQuestions;
}

/** 获取霍兰德全部题目 */
export function getHollandQuestions(): HollandQuestion[] {
  return hollandQuestions;
}

/**
 * 计算 MBTI 测评结果
 * @param answers 用户答案数组，每个元素包含 questionId 和 choice ('A' | 'B')
 */
export function calculateMBTI(
  answers: Array<{ questionId: number; choice: 'A' | 'B' }>,
): MBTIResult {
  // 各维度计数：统计选择每个极的次数
  const counts: Record<string, number> = {
    E: 0, I: 0,
    S: 0, N: 0,
    T: 0, F: 0,
    J: 0, P: 0,
  };

  for (const answer of answers) {
    const question = mbtiQuestions.find(q => q.id === answer.questionId);
    if (!question) continue;

    const option = answer.choice === 'A' ? question.optionA : question.optionB;
    counts[option.pole]++;
  }

  // 计算各维度百分比（偏向第一个字母的程度）
  const eiTotal = counts.E + counts.I;
  const snTotal = counts.S + counts.N;
  const tfTotal = counts.T + counts.F;
  const jpTotal = counts.J + counts.P;

  const dimensions = {
    EI: eiTotal > 0 ? Math.round((counts.E / eiTotal) * 100) : 50,
    SN: snTotal > 0 ? Math.round((counts.S / snTotal) * 100) : 50,
    TF: tfTotal > 0 ? Math.round((counts.T / tfTotal) * 100) : 50,
    JP: jpTotal > 0 ? Math.round((counts.J / jpTotal) * 100) : 50,
  };

  // 组合4字母类型
  const type = [
    counts.E >= counts.I ? 'E' : 'I',
    counts.S >= counts.N ? 'S' : 'N',
    counts.T >= counts.F ? 'T' : 'F',
    counts.J >= counts.P ? 'J' : 'P',
  ].join('');

  // 获取类型描述
  const info = mbtiTypeInfo[type] ?? mbtiTypeInfo['INTJ'];

  return {
    type,
    dimensions,
    description: `你的MBTI性格类型为 ${type}。\n\n${info.description}`,
    strengths: info.strengths,
    suggestedMajors: info.suggestedMajors,
    suggestedCareers: info.suggestedCareers,
  };
}

/**
 * 计算霍兰德测评结果
 * @param answers 用户答案数组，每个元素包含 questionId 和 rating (1-5)
 */
export function calculateHolland(
  answers: Array<{ questionId: number; rating: number }>,
): HollandResult {
  // 初始化各维度得分
  const scores: { R: number; I: number; A: number; S: number; E: number; C: number } = {
    R: 0, I: 0, A: 0, S: 0, E: 0, C: 0,
  };

  for (const answer of answers) {
    const question = hollandQuestions.find(q => q.id === answer.questionId);
    if (!question) continue;

    // 将评分限制在 1-5 范围内
    const rating = Math.max(1, Math.min(5, answer.rating));
    scores[question.dimension] += rating;
  }

  // 按得分降序排列，取前3个维度生成 RIASEC 代码
  const sorted = (Object.entries(scores) as Array<[keyof typeof scores, number]>)
    .sort((a, b) => b[1] - a[1]);

  const code = sorted.slice(0, 3).map(([key]) => key).join('');

  // 生成描述
  const description = getHollandCodeDescription(code);

  // 合并前3个维度的推荐专业（去重）
  const suggestedMajorsSet = new Set<string>();
  for (const [key] of sorted.slice(0, 3)) {
    const info = hollandDimensionInfo[key];
    if (info) {
      for (const major of info.suggestedMajors) {
        suggestedMajorsSet.add(major);
      }
    }
  }

  return {
    code,
    scores,
    description,
    suggestedMajors: Array.from(suggestedMajorsSet),
  };
}
