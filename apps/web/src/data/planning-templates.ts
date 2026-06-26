export interface PlanningMilestone {
  title: string;
  description: string;
  category: 'ACADEMIC' | 'CAREER' | 'LIFESTYLE';
  priority: number;
  suggestedDeadline: string;
}

export interface PlanningTemplate {
  id: string;
  name: string;
  description: string;
  duration: string;
  icon: string;
  milestones: PlanningMilestone[];
}

export const planningTemplates: PlanningTemplate[] = [
  {
    id: 'postgraduate',
    name: '考研路线',
    description: '从大二开始系统准备，经历大三全面备考、大四冲刺初试和复试，最终顺利上岸的完整考研规划路线。',
    duration: '约2.5年',
    icon: 'GraduationCap',
    milestones: [
      {
        title: '确定目标院校与专业',
        description: '调研目标院校的报录比、参考书目、导师方向，确定1-2所目标院校和报考专业方向。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大二下学期末',
      },
      {
        title: '夯实专业基础课',
        description: '系统复习本科核心课程，整理专业课笔记，建立知识框架，为后续深入备考打好基础。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大三上学期末',
      },
      {
        title: '英语长期积累',
        description: '坚持每日英语阅读和词汇积累，开始接触考研英语真题，训练阅读理解和翻译能力。',
        category: 'ACADEMIC',
        priority: 4,
        suggestedDeadline: '大三上学期持续进行',
      },
      {
        title: '政治系统学习',
        description: '跟随主流政治辅导资料，系统学习马原、毛中特、史纲、思修等板块，配合刷题巩固。',
        category: 'ACADEMIC',
        priority: 3,
        suggestedDeadline: '大三暑假开始',
      },
      {
        title: '暑期强化集训',
        description: '利用大三暑假进行高强度集中复习，完成专业课第二轮梳理，英语真题精练，政治重点突破。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大三暑假（7-8月）',
      },
      {
        title: '秋季冲刺与模拟',
        description: '进入大四后全面冲刺，各科查漏补缺，定期进行全真模拟考试，调整做题节奏和时间分配。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大四上学期（9-11月）',
      },
      {
        title: '初试应考',
        description: '调整心态与作息，以最佳状态参加全国研究生统一考试，合理分配各科目答题时间。',
        category: 'LIFESTYLE',
        priority: 5,
        suggestedDeadline: '大四上学期末（12月）',
      },
      {
        title: '复试准备与调剂',
        description: '初试后准备复试内容（专业课笔试、面试、英语口语），同时关注调剂信息，做好两手准备。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大四下学期（2-4月）',
      },
    ],
  },
  {
    id: 'employment',
    name: '就业路线',
    description: '从技能储备到实习积累，经历秋招和春招的完整求职流程，最终拿到心仪offer并顺利入职的规划路线。',
    duration: '约2年',
    icon: 'Briefcase',
    milestones: [
      {
        title: '核心技能储备',
        description: '根据目标岗位要求，系统学习专业技能和通用技能（如编程、数据分析、设计工具等），积累项目作品。',
        category: 'CAREER',
        priority: 5,
        suggestedDeadline: '大二下学期',
      },
      {
        title: '简历与作品集打磨',
        description: '撰写针对目标岗位的简历，整理项目作品集，请学长或导师帮助修改优化，突出核心竞争力。',
        category: 'CAREER',
        priority: 4,
        suggestedDeadline: '大三上学期初',
      },
      {
        title: '第一份实习',
        description: '争取获得第一份与目标方向相关的实习机会，积累真实工作经验，了解行业运作方式。',
        category: 'CAREER',
        priority: 5,
        suggestedDeadline: '大三上学期或寒假',
      },
      {
        title: '暑期高含金量实习',
        description: '争取目标公司或头部企业的暑期实习机会，表现优异者可获得转正机会，提前锁定offer。',
        category: 'CAREER',
        priority: 5,
        suggestedDeadline: '大三暑假（7-8月）',
      },
      {
        title: '秋招集中投递',
        description: '进入大四秋招季，大批量投递目标公司，参加校园宣讲会、笔试和面试，争取在秋招中拿到满意offer。',
        category: 'CAREER',
        priority: 5,
        suggestedDeadline: '大四上学期（8-11月）',
      },
      {
        title: '面试技巧专项训练',
        description: '针对行为面试、技术面试、群面等常见形式进行专项训练，提升面试通过率和谈判能力。',
        category: 'CAREER',
        priority: 4,
        suggestedDeadline: '秋招期间持续',
      },
      {
        title: '春招补录与offer选择',
        description: '秋招未满意的岗位通过春招补录争取，综合对比已获得offer的薪资、发展、地点等因素做出选择。',
        category: 'CAREER',
        priority: 4,
        suggestedDeadline: '大四下学期（3-5月）',
      },
      {
        title: '入职准备与过渡',
        description: '签订三方协议，了解入职所需材料，提前学习公司技术栈和业务知识，顺利完成从学生到职场人的过渡。',
        category: 'LIFESTYLE',
        priority: 3,
        suggestedDeadline: '毕业前',
      },
    ],
  },
  {
    id: 'study-abroad',
    name: '留学路线',
    description: '从语言考试准备到选校定位，完成申请材料、标准化考试、签证办理等全流程的留学规划路线。',
    duration: '约2年',
    icon: 'Plane',
    milestones: [
      {
        title: '语言考试准备（雅思/托福）',
        description: '根据目标国家选择雅思或托福，制定备考计划，目标在首考或二考中达到目标院校的语言要求。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大二下学期至大三上学期',
      },
      {
        title: '标化考试准备（GRE/GMAT）',
        description: '根据目标专业要求准备GRE或GMAT考试，重点突破数学和写作部分，争取达到申请竞争力分数。',
        category: 'ACADEMIC',
        priority: 4,
        suggestedDeadline: '大三上学期',
      },
      {
        title: '选校定位与调研',
        description: '根据自身背景和成绩，调研目标国家和院校，确定冲刺、匹配和保底三档学校名单，了解各项目特色。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大三上学期末',
      },
      {
        title: '推荐信与背景提升',
        description: '联系推荐人（教授、实习主管），争取获得高质量推荐信；参加科研、竞赛或实习提升申请背景。',
        category: 'ACADEMIC',
        priority: 4,
        suggestedDeadline: '大三下学期',
      },
      {
        title: '文书撰写与打磨',
        description: '撰写个人陈述（PS）、目的陈述（SOP）和简历，反复修改打磨，突出个人特色和申请动机。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大三暑假至大四上学期初',
      },
      {
        title: '网申提交与材料跟进',
        description: '按各项目截止日期完成网申提交，确保成绩单、语言成绩、推荐信等材料完整送达，及时跟进状态。',
        category: 'ACADEMIC',
        priority: 5,
        suggestedDeadline: '大四上学期（10-12月）',
      },
      {
        title: '面试准备与offer选择',
        description: '部分项目需要面试，提前准备常见问题和模拟面试；收到offer后综合对比项目质量和奖学金情况。',
        category: 'ACADEMIC',
        priority: 4,
        suggestedDeadline: '大四下学期（1-4月）',
      },
      {
        title: '签证办理与行前准备',
        description: '获得录取后办理留学签证，准备资金证明、体检、保险等材料，安排住宿和机票，做好行前准备。',
        category: 'LIFESTYLE',
        priority: 5,
        suggestedDeadline: '毕业前（5-7月）',
      },
    ],
  },
];
