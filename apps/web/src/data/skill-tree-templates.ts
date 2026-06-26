export interface SkillTemplateResource {
  type: 'course' | 'book' | 'tutorial' | 'project' | 'practice';
  title: string;
  url?: string;
}

export interface SkillTemplateNode {
  title: string;
  description: string;
  difficulty: number; // 1-5
  estimatedHours: number;
  prerequisites: string[];
  resources: SkillTemplateResource[];
  children: SkillTemplateNode[];
}

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  category: 'TECH' | 'SOFT' | 'LANGUAGE' | 'CERTIFICATE';
  icon: string; // lucide-react component name
  nodes: SkillTemplateNode[];
}

export const skillTreeTemplates: SkillTemplate[] = [
  /* ------------------------------------------------------------------ */
  /*  1. 前端开发                                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 'frontend-dev',
    name: '前端开发',
    description: '从零开始系统学习前端开发，涵盖 HTML/CSS、JavaScript、React 框架和工程化工具，打造完整的前端技术栈。',
    category: 'TECH',
    icon: 'Code',
    nodes: [
      {
        title: 'HTML/CSS基础',
        description: '掌握网页开发的基石：语义化 HTML 标签与现代 CSS 布局技术，能够独立构建结构清晰、样式美观的页面。',
        difficulty: 1,
        estimatedHours: 30,
        prerequisites: [],
        resources: [
          { type: 'course', title: 'MDN Web Docs - HTML 入门', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/HTML' },
          { type: 'tutorial', title: 'CSS-Tricks 完全指南', url: 'https://css-tricks.com/snippets/css/' },
        ],
        children: [
          {
            title: 'HTML语义化标签',
            description: '学习 header、nav、main、article、section、footer 等语义化标签的正确使用场景与 SEO 价值。',
            difficulty: 1,
            estimatedHours: 8,
            prerequisites: [],
            resources: [
              { type: 'tutorial', title: 'HTML5 语义化标签详解', url: 'https://developer.mozilla.org/zh-CN/docs/Glossary/Semantics' },
            ],
            children: [],
          },
          {
            title: 'CSS布局与Flexbox',
            description: '深入理解盒模型、Flexbox 弹性布局与 Grid 网格布局，能够灵活实现各种复杂页面排版。',
            difficulty: 2,
            estimatedHours: 12,
            prerequisites: ['HTML语义化标签'],
            resources: [
              { type: 'course', title: 'Flexbox Froggy 互动教程', url: 'https://flexboxfroggy.com/' },
              { type: 'tutorial', title: 'CSS Grid 完全指南', url: 'https://css-tricks.com/snippets/css/complete-guide-grid/' },
            ],
            children: [],
          },
          {
            title: '响应式设计',
            description: '学习媒体查询、弹性图片、移动优先设计原则，让页面在不同设备上均有良好体验。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: ['CSS布局与Flexbox'],
            resources: [
              { type: 'book', title: '《响应式 Web 设计》', url: 'https://book.douban.com/subject/26710043/' },
            ],
            children: [],
          },
        ],
      },
      {
        title: 'JavaScript核心',
        description: '系统学习 JavaScript 语言核心特性，包括 ES6+ 语法、异步编程模型和 DOM 操作，为框架学习打下坚实基础。',
        difficulty: 2,
        estimatedHours: 37,
        prerequisites: ['HTML/CSS基础'],
        resources: [
          { type: 'book', title: '《JavaScript 高级程序设计（第4版）》', url: 'https://book.douban.com/subject/35175321/' },
          { type: 'course', title: '现代 JavaScript 教程', url: 'https://zh.javascript.info/' },
        ],
        children: [
          {
            title: 'ES6+语法特性',
            description: '掌握 let/const、箭头函数、解构赋值、模板字符串、展开运算符、模块化 import/export 等现代 JS 语法。',
            difficulty: 2,
            estimatedHours: 15,
            prerequisites: [],
            resources: [
              { type: 'tutorial', title: 'ES6 入门教程 - 阮一峰', url: 'https://es6.ruanyifeng.com/' },
            ],
            children: [],
          },
          {
            title: '异步编程与Promise',
            description: '理解事件循环、回调函数、Promise 链式调用、async/await 语法糖，能够优雅处理异步逻辑。',
            difficulty: 3,
            estimatedHours: 12,
            prerequisites: ['ES6+语法特性'],
            resources: [
              { type: 'tutorial', title: '理解 JavaScript 的 Event Loop', url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/EventLoop' },
              { type: 'practice', title: 'Promise 练习题', url: 'https://bigfrontend.dev/problem/tag/Promise' },
            ],
            children: [],
          },
          {
            title: 'DOM操作与事件',
            description: '学习 DOM 节点查询、创建、修改，事件监听与冒泡机制，掌握原生 JS 操作页面的核心能力。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: ['ES6+语法特性'],
            resources: [
              { type: 'tutorial', title: 'MDN DOM 操作指南', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Client-side_web_APIs/Manipulating_documents' },
            ],
            children: [],
          },
        ],
      },
      {
        title: 'React框架',
        description: '深入学习 React 生态，掌握组件化开发思想、Hooks 状态管理和前端路由，具备开发中大型 SPA 的能力。',
        difficulty: 3,
        estimatedHours: 33,
        prerequisites: ['JavaScript核心'],
        resources: [
          { type: 'course', title: 'React 官方文档', url: 'https://zh-hans.react.dev/' },
        ],
        children: [
          {
            title: '组件与JSX',
            description: '理解 React 组件化思想，掌握函数组件、Props 传递、JSX 语法和条件渲染、列表渲染等基础用法。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: [],
            resources: [
              { type: 'course', title: 'React 官方教程 - 井字棋游戏', url: 'https://zh-hans.react.dev/learn/tutorial-tic-tac-toe' },
            ],
            children: [],
          },
          {
            title: 'Hooks与状态管理',
            description: '熟练使用 useState、useEffect、useContext、useReducer 等内置 Hooks，理解状态提升与全局状态方案。',
            difficulty: 3,
            estimatedHours: 15,
            prerequisites: ['组件与JSX'],
            resources: [
              { type: 'tutorial', title: 'React Hooks 深度解析', url: 'https://zh-hans.react.dev/reference/react/hooks' },
              { type: 'project', title: '使用 Zustand 构建状态管理', url: 'https://github.com/pmndrs/zustand' },
            ],
            children: [],
          },
          {
            title: 'React Router',
            description: '掌握前端路由原理与实践，学习嵌套路由、动态参数、路由守卫和懒加载等进阶用法。',
            difficulty: 2,
            estimatedHours: 8,
            prerequisites: ['组件与JSX'],
            resources: [
              { type: 'course', title: 'React Router v6 官方文档', url: 'https://reactrouter.com/en/main' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '工程化工具',
        description: '掌握前端工程化必备工具链，包括构建工具、类型系统和版本控制，提升开发效率与代码质量。',
        difficulty: 3,
        estimatedHours: 35,
        prerequisites: ['React框架'],
        resources: [
          { type: 'tutorial', title: '前端工程化入门', url: 'https://juejin.cn/post/7066328085121548296' },
        ],
        children: [
          {
            title: 'Webpack/Vite构建',
            description: '理解模块打包原理，掌握 Webpack 核心配置与 Vite 快速开发方案，能够独立搭建前端项目构建流程。',
            difficulty: 3,
            estimatedHours: 12,
            prerequisites: [],
            resources: [
              { type: 'course', title: 'Vite 官方文档', url: 'https://cn.vitejs.dev/' },
              { type: 'tutorial', title: 'Webpack 5 核心概念', url: 'https://webpack.docschina.org/concepts/' },
            ],
            children: [],
          },
          {
            title: 'TypeScript入门',
            description: '学习 TypeScript 类型系统基础，包括基本类型、接口、泛型和类型推断，编写类型安全的 JavaScript 代码。',
            difficulty: 2,
            estimatedHours: 15,
            prerequisites: ['ES6+语法特性'],
            resources: [
              { type: 'book', title: '《TypeScript 编程》', url: 'https://book.douban.com/subject/35121710/' },
              { type: 'course', title: 'TypeScript 官方手册', url: 'https://www.typescriptlang.org/docs/handbook/' },
            ],
            children: [],
          },
          {
            title: 'Git版本控制',
            description: '掌握 Git 基本操作、分支策略、合并冲突解决和团队协作工作流（Git Flow / Trunk-Based）。',
            difficulty: 2,
            estimatedHours: 8,
            prerequisites: [],
            resources: [
              { type: 'tutorial', title: 'Git 简明教程', url: 'https://git-scm.com/book/zh/v2' },
            ],
            children: [],
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  2. 数据分析                                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 'data-analysis',
    name: '数据分析',
    description: '系统学习数据分析全流程，从统计学基础到 Python 编程，再到数据可视化与机器学习入门，构建完整的数据分析能力体系。',
    category: 'TECH',
    icon: 'BarChart3',
    nodes: [
      {
        title: '统计学基础',
        description: '建立扎实的统计学思维，掌握描述统计、概率论和假设检验的核心概念，为数据分析奠定理论基础。',
        difficulty: 2,
        estimatedHours: 37,
        prerequisites: [],
        resources: [
          { type: 'book', title: '《统计学》贾俊平', url: 'https://book.douban.com/subject/26657726/' },
          { type: 'course', title: '可汗学院统计学', url: 'https://www.khanacademy.org/math/statistics-probability' },
        ],
        children: [
          {
            title: '描述统计',
            description: '学习均值、中位数、众数、标准差、方差、分位数等集中趋势和离散程度指标，掌握数据分布的直观描述方法。',
            difficulty: 1,
            estimatedHours: 10,
            prerequisites: [],
            resources: [
              { type: 'tutorial', title: '描述统计入门 - 知乎专栏', url: 'https://zhuanlan.zhihu.com/p/35743216' },
            ],
            children: [],
          },
          {
            title: '概率论基础',
            description: '理解随机事件、条件概率、贝叶斯定理、常见分布（正态、二项、泊松）等概率论核心概念。',
            difficulty: 2,
            estimatedHours: 15,
            prerequisites: ['描述统计'],
            resources: [
              { type: 'course', title: '概率论与数理统计 - B站宋浩', url: 'https://www.bilibili.com/video/BV1nt411z7gN' },
            ],
            children: [],
          },
          {
            title: '假设检验',
            description: '掌握假设检验的基本思想、t检验、卡方检验、ANOVA方差分析等常用方法，理解p值和置信区间的含义。',
            difficulty: 3,
            estimatedHours: 12,
            prerequisites: ['概率论基础'],
            resources: [
              { type: 'tutorial', title: '假设检验详解 - StatQuest', url: 'https://www.youtube.com/watch?v=0oc49DyA3hQ' },
              { type: 'practice', title: '假设检验练习题集', url: 'https://www.kaggle.com/learn/intro-to-statistics' },
            ],
            children: [],
          },
        ],
      },
      {
        title: 'Python编程',
        description: '掌握 Python 编程语言及其数据分析生态，能够使用 Python 高效完成数据清洗、处理和分析任务。',
        difficulty: 2,
        estimatedHours: 37,
        prerequisites: [],
        resources: [
          { type: 'course', title: 'Python 官方教程', url: 'https://docs.python.org/zh-cn/3/tutorial/' },
        ],
        children: [
          {
            title: 'Python基础语法',
            description: '学习变量、数据类型、控制流、函数、面向对象编程等 Python 基础语法，建立编程思维。',
            difficulty: 1,
            estimatedHours: 12,
            prerequisites: [],
            resources: [
              { type: 'course', title: '菜鸟教程 Python3', url: 'https://www.runoob.com/python3/python3-tutorial.html' },
              { type: 'practice', title: 'LeetCode 简单题精选', url: 'https://leetcode.cn/problemset/' },
            ],
            children: [],
          },
          {
            title: 'Pandas数据处理',
            description: '熟练使用 Pandas 进行数据读取、清洗、筛选、聚合、透视表操作，掌握 DataFrame 核心 API。',
            difficulty: 2,
            estimatedHours: 15,
            prerequisites: ['Python基础语法'],
            resources: [
              { type: 'course', title: 'Pandas 官方10分钟入门', url: 'https://pandas.pydata.org/docs/user_guide/10min.html' },
              { type: 'project', title: 'Kaggle Titanic 数据清洗实战', url: 'https://www.kaggle.com/c/titanic' },
            ],
            children: [],
          },
          {
            title: 'NumPy数值计算',
            description: '掌握 NumPy 数组操作、广播机制、线性代数运算和随机数生成，提升数值计算效率。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: ['Python基础语法'],
            resources: [
              { type: 'tutorial', title: 'NumPy 中文文档', url: 'https://www.numpy.org.cn/' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '数据可视化',
        description: '学会用图表讲故事，掌握静态和交互式可视化工具，能够将数据分析结果以直观、专业的方式呈现。',
        difficulty: 2,
        estimatedHours: 28,
        prerequisites: ['Python编程'],
        resources: [
          { type: 'book', title: '《数据可视化之美》', url: 'https://book.douban.com/subject/35179730/' },
        ],
        children: [
          {
            title: 'Matplotlib绑图',
            description: '掌握 Matplotlib 基础绘图能力，包括折线图、柱状图、散点图、饼图、箱线图和子图布局。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: [],
            resources: [
              { type: 'course', title: 'Matplotlib 官方画廊', url: 'https://matplotlib.org/stable/gallery/index.html' },
            ],
            children: [],
          },
          {
            title: 'Seaborn高级可视化',
            description: '使用 Seaborn 创建统计图表，包括热力图、小提琴图、配对图和回归图，提升图表美观度和信息密度。',
            difficulty: 2,
            estimatedHours: 8,
            prerequisites: ['Matplotlib绑图'],
            resources: [
              { type: 'tutorial', title: 'Seaborn 官方教程', url: 'https://seaborn.pydata.org/tutorial.html' },
              { type: 'project', title: '用 Seaborn 分析电影数据集', url: 'https://www.kaggle.com/code' },
            ],
            children: [],
          },
          {
            title: '交互式图表Plotly',
            description: '学习 Plotly 创建可交互的动态图表，支持缩放、悬停提示和动画效果，适合 Web 端数据展示。',
            difficulty: 3,
            estimatedHours: 10,
            prerequisites: ['Matplotlib绑图'],
            resources: [
              { type: 'course', title: 'Plotly Express 快速入门', url: 'https://plotly.com/python/plotly-express/' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '机器学习',
        description: '入门机器学习核心算法与实战技能，能够运用监督学习方法解决分类与回归问题。',
        difficulty: 4,
        estimatedHours: 47,
        prerequisites: ['统计学基础', 'Python编程'],
        resources: [
          { type: 'course', title: '吴恩达机器学习课程', url: 'https://www.coursera.org/learn/machine-learning' },
          { type: 'book', title: '《统计学习方法》李航', url: 'https://book.douban.com/subject/33437381/' },
        ],
        children: [
          {
            title: '监督学习算法',
            description: '系统学习线性回归、逻辑回归、决策树、随机森林、SVM、KNN 等经典监督学习算法的原理与适用场景。',
            difficulty: 3,
            estimatedHours: 20,
            prerequisites: [],
            resources: [
              { type: 'course', title: 'Scikit-learn 监督学习指南', url: 'https://scikit-learn.org/stable/supervised_learning.html' },
            ],
            children: [],
          },
          {
            title: '模型评估与调优',
            description: '掌握交叉验证、混淆矩阵、ROC/AUC、网格搜索等模型评估和超参数调优方法，避免过拟合与欠拟合。',
            difficulty: 4,
            estimatedHours: 15,
            prerequisites: ['监督学习算法'],
            resources: [
              { type: 'tutorial', title: '模型评估指标详解', url: 'https://scikit-learn.org/stable/modules/model_evaluation.html' },
              { type: 'practice', title: 'Kaggle 竞赛实战 - 模型调优', url: 'https://www.kaggle.com/competitions' },
            ],
            children: [],
          },
          {
            title: 'Scikit-learn实战',
            description: '通过完整项目实践，掌握 Scikit-learn 的全流程使用：数据预处理、特征工程、模型训练、预测和评估。',
            difficulty: 3,
            estimatedHours: 12,
            prerequisites: ['监督学习算法'],
            resources: [
              { type: 'project', title: '房价预测项目实战', url: 'https://www.kaggle.com/c/house-prices-advanced-regression-techniques' },
            ],
            children: [],
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  3. 产品设计                                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 'product-design',
    name: '产品设计',
    description: '培养全方位的产品设计能力，从用户研究到交互设计，再到视觉呈现和产品思维，打造优秀的用户体验。',
    category: 'SOFT',
    icon: 'Palette',
    nodes: [
      {
        title: '用户研究',
        description: '掌握用户研究的核心方法论，能够深入了解目标用户需求、行为和痛点，为设计决策提供数据支撑。',
        difficulty: 2,
        estimatedHours: 26,
        prerequisites: [],
        resources: [
          { type: 'book', title: '《用户故事地图》', url: 'https://book.douban.com/subject/26839494/' },
          { type: 'course', title: 'Google UX 设计证书 - 用户研究', url: 'https://www.coursera.org/professional-certificates/google-ux-design' },
        ],
        children: [
          {
            title: '用户访谈技巧',
            description: '学习半结构化访谈的设计与执行，包括问题设计、引导追问、记录整理和洞察提炼的完整流程。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: [],
            resources: [
              { type: 'book', title: '《访谈的艺术》', url: 'https://book.douban.com/subject/26606429/' },
            ],
            children: [],
          },
          {
            title: '问卷设计与分析',
            description: '掌握问卷结构设计、题型设计原则、样本量确定和数据统计分析方法，获取高质量的定量数据。',
            difficulty: 2,
            estimatedHours: 8,
            prerequisites: [],
            resources: [
              { type: 'tutorial', title: '问卷设计最佳实践', url: 'https://www.nngroup.com/articles/survey-design/' },
            ],
            children: [],
          },
          {
            title: '用户画像构建',
            description: '学习如何从研究数据中提炼典型用户画像（Persona），包括人口统计、行为模式、目标动机和痛点描述。',
            difficulty: 2,
            estimatedHours: 8,
            prerequisites: ['用户访谈技巧', '问卷设计与分析'],
            resources: [
              { type: 'tutorial', title: '用户画像制作指南', url: 'https://www.nngroup.com/articles/persona/' },
              { type: 'practice', title: '为一个真实产品创建用户画像' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '交互设计',
        description: '掌握交互设计的核心原则和方法，能够设计直觉、高效、愉悦的用户操作流程和界面交互。',
        difficulty: 3,
        estimatedHours: 37,
        prerequisites: ['用户研究'],
        resources: [
          { type: 'book', title: '《交互设计精髓（第4版）》', url: 'https://book.douban.com/subject/26642502/' },
        ],
        children: [
          {
            title: '信息架构',
            description: '学习如何组织和结构化产品信息，包括导航设计、分类体系、标签系统和搜索策略，帮助用户高效找到内容。',
            difficulty: 2,
            estimatedHours: 12,
            prerequisites: [],
            resources: [
              { type: 'book', title: '《Web 信息架构》', url: 'https://book.douban.com/subject/25845735/' },
              { type: 'tutorial', title: '信息架构图绘制方法', url: 'https://www.nngroup.com/articles/information-architecture/' },
            ],
            children: [],
          },
          {
            title: '原型设计与测试',
            description: '使用 Figma / Axure 创建低保真到高保真原型，掌握可用性测试的设计、执行和结果分析方法。',
            difficulty: 3,
            estimatedHours: 15,
            prerequisites: ['信息架构'],
            resources: [
              { type: 'course', title: 'Figma 官方教程', url: 'https://help.figma.com/hc/en-us/categories/360002051613' },
              { type: 'practice', title: '为校园App设计完整原型并进行用户测试' },
            ],
            children: [],
          },
          {
            title: '可用性原则',
            description: '深入理解尼尔森十大可用性原则、格式塔原则、菲茨定律等经典设计法则，培养设计判断力。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: [],
            resources: [
              { type: 'tutorial', title: '尼尔森十大可用性原则', url: 'https://www.nngroup.com/articles/ten-usability-heuristics/' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '视觉设计',
        description: '建立视觉设计审美与技能，掌握色彩、排版和设计系统，能够输出专业品质的界面视觉方案。',
        difficulty: 3,
        estimatedHours: 38,
        prerequisites: ['交互设计'],
        resources: [
          { type: 'book', title: '《写给大家看的设计书》', url: 'https://book.douban.com/subject/30347639/' },
        ],
        children: [
          {
            title: '色彩理论',
            description: '学习色彩心理学、色彩搭配方法（互补色、类比色、三角色）、可访问性色彩标准（WCAG），建立产品色彩方案。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: [],
            resources: [
              { type: 'tutorial', title: '色彩理论基础', url: 'https://www.canva.com/colors/color-wheel/' },
              { type: 'practice', title: 'Coolors 配色方案练习', url: 'https://coolors.co/' },
            ],
            children: [],
          },
          {
            title: '排版与字体',
            description: '掌握字体选择、字号层级、行高、字间距和排版网格系统，让文字内容清晰易读且具有视觉美感。',
            difficulty: 2,
            estimatedHours: 8,
            prerequisites: [],
            resources: [
              { type: 'book', title: '《字体故事》', url: 'https://book.douban.com/subject/26417362/' },
            ],
            children: [],
          },
          {
            title: '设计系统搭建',
            description: '学习构建可复用的组件库和设计规范，包括设计令牌（Token）、组件规范、文档编写和团队协作流程。',
            difficulty: 4,
            estimatedHours: 20,
            prerequisites: ['色彩理论', '排版与字体'],
            resources: [
              { type: 'course', title: '设计系统入门 - Figma', url: 'https://www.figma.com/best-practices/creating-and-organizing-variants/' },
              { type: 'project', title: '为团队搭建一套小型设计系统' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '产品思维',
        description: '培养产品经理视角的全局思维，掌握需求分析、产品规划和数据驱动决策的方法论。',
        difficulty: 3,
        estimatedHours: 32,
        prerequisites: ['用户研究', '交互设计'],
        resources: [
          { type: 'book', title: '《启示录：打造用户喜爱的产品》', url: 'https://book.douban.com/subject/35178234/' },
        ],
        children: [
          {
            title: '需求分析方法',
            description: '学习 KANO 模型、MoSCoW 优先级法、用户故事拆分等需求分析与管理方法，做出科学的功能取舍。',
            difficulty: 2,
            estimatedHours: 10,
            prerequisites: [],
            resources: [
              { type: 'tutorial', title: '需求优先级评估框架', url: 'https://www.productplan.com/glossary/kano-model/' },
            ],
            children: [],
          },
          {
            title: '产品路线图',
            description: '掌握产品路线图的制定方法，包括愿景对齐、阶段目标设定、里程碑规划和利益相关方沟通。',
            difficulty: 3,
            estimatedHours: 12,
            prerequisites: ['需求分析方法'],
            resources: [
              { type: 'tutorial', title: '产品路线图最佳实践', url: 'https://www.productplan.com/learn/what-is-a-product-roadmap/' },
              { type: 'practice', title: '为校园社交产品设计6个月路线图' },
            ],
            children: [],
          },
          {
            title: '数据驱动决策',
            description: '学习核心产品指标（DAU/MAU、留存率、转化漏斗、LTV）的定义和分析方法，用数据验证产品假设。',
            difficulty: 3,
            estimatedHours: 10,
            prerequisites: [],
            resources: [
              { type: 'course', title: 'Google Analytics 入门', url: 'https://skillshop.withgoogle.com/' },
              { type: 'book', title: '《精益数据分析》', url: 'https://book.douban.com/subject/26280832/' },
            ],
            children: [],
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  4. 英语能力                                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 'english-skills',
    name: '英语能力',
    description: '全面提升英语听说读写能力，涵盖日常交流、学术应用和考试备考，帮助你在学业和职业中自信使用英语。',
    category: 'LANGUAGE',
    icon: 'Languages',
    nodes: [
      {
        title: '听力训练',
        description: '循序渐进提升英语听力水平，从日常对话到新闻广播再到学术讲座，建立敏锐的英语听觉感知。',
        difficulty: 2,
        estimatedHours: 60,
        prerequisites: [],
        resources: [
          { type: 'course', title: 'BBC Learning English', url: 'https://www.bbc.co.uk/learningenglish' },
        ],
        children: [
          {
            title: '日常对话听力',
            description: '通过美剧、播客和日常场景对话训练基础听力，掌握常见口语表达、缩略形式和语调变化。',
            difficulty: 1,
            estimatedHours: 15,
            prerequisites: [],
            resources: [
              { type: 'course', title: 'ESL Pod 慢速英语', url: 'https://www.eslpod.com/' },
              { type: 'practice', title: '每日跟读TED-Ed短视频' },
            ],
            children: [],
          },
          {
            title: '新闻听力训练',
            description: '收听 BBC News、CNN、NPR 等新闻节目，训练快速抓取关键信息和理解新闻语境的能力。',
            difficulty: 3,
            estimatedHours: 20,
            prerequisites: ['日常对话听力'],
            resources: [
              { type: 'course', title: 'VOA 慢速英语', url: 'https://learningenglish.voanews.com/' },
              { type: 'practice', title: '每日精听一篇BBC新闻并做笔记' },
            ],
            children: [],
          },
          {
            title: '学术听力',
            description: '训练听懂英文学术讲座和课堂讨论的能力，包括笔记技巧、学术词汇识别和逻辑信号词捕捉。',
            difficulty: 4,
            estimatedHours: 25,
            prerequisites: ['新闻听力训练'],
            resources: [
              { type: 'course', title: 'Coursera 学术英语听力', url: 'https://www.coursera.org/learn/academic-english-listening' },
              { type: 'practice', title: '每周精听一场TED演讲并总结要点' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '口语表达',
        description: '从发音到流利表达，系统训练英语口语能力，能够在日常、学术和职业场景中自信开口说英语。',
        difficulty: 3,
        estimatedHours: 50,
        prerequisites: [],
        resources: [
          { type: 'course', title: 'Rachel\'s English 发音教程', url: 'https://rachelsenglish.com/' },
        ],
        children: [
          {
            title: '发音纠正练习',
            description: '系统学习英语音标（IPA），纠正元音、辅音、连读、重音和语调等发音难点，建立清晰的发音基础。',
            difficulty: 2,
            estimatedHours: 15,
            prerequisites: [],
            resources: [
              { type: 'course', title: 'BBC 发音工作坊', url: 'https://www.bbc.co.uk/learningenglish/english/features/pronunciation' },
              { type: 'practice', title: '使用 ELSA Speak App 每日练习' },
            ],
            children: [],
          },
          {
            title: '场景口语训练',
            description: '模拟自我介绍、面试、会议发言、学术讨论等真实场景，积累功能性表达和应对策略。',
            difficulty: 3,
            estimatedHours: 20,
            prerequisites: ['发音纠正练习'],
            resources: [
              { type: 'practice', title: '每周参加英语角或线上语言交换', url: 'https://www.tandem.net/' },
              { type: 'tutorial', title: '雅思口语高分话题素材' },
            ],
            children: [],
          },
          {
            title: '演讲技巧',
            description: '学习英文演讲的结构设计、肢体语言、声音控制和Q&A应对，能够在学术和职业场合做专业演讲。',
            difficulty: 4,
            estimatedHours: 15,
            prerequisites: ['场景口语训练'],
            resources: [
              { type: 'course', title: 'TED 演讲分析 - 优秀演讲的共同特征' },
              { type: 'book', title: '《演讲的力量》Chris Anderson', url: 'https://book.douban.com/subject/26760734/' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '阅读写作',
        description: '提升英文阅读速度与理解深度，培养学术写作和商务写作能力，实现高质量的英文书面表达。',
        difficulty: 3,
        estimatedHours: 50,
        prerequisites: [],
        resources: [
          { type: 'book', title: '《英语写作手册》丁往道', url: 'https://book.douban.com/subject/1043537/' },
        ],
        children: [
          {
            title: '英文阅读技巧',
            description: '掌握略读、扫读、精读等阅读策略，训练推断词义和理解长难句的能力，提升学术和新闻阅读效率。',
            difficulty: 2,
            estimatedHours: 15,
            prerequisites: [],
            resources: [
              { type: 'practice', title: '每日精读一篇经济学人文章', url: 'https://www.economist.com/' },
              { type: 'tutorial', title: '长难句分析方法 - 杨鹏教程' },
            ],
            children: [],
          },
          {
            title: '学术写作基础',
            description: '学习学术论文结构（IMRaD）、引用规范（APA/MLA）、论证逻辑和学术词汇，具备撰写英文研究报告的能力。',
            difficulty: 3,
            estimatedHours: 20,
            prerequisites: ['英文阅读技巧'],
            resources: [
              { type: 'course', title: 'Coursera 学术写作专项课', url: 'https://www.coursera.org/specializations/academic-english' },
              { type: 'book', title: '《Academic Writing for Graduate Students》', url: 'https://book.douban.com/subject/4269260/' },
            ],
            children: [],
          },
          {
            title: '商务英语写作',
            description: '掌握邮件、报告、提案等商务文体写作规范，学习简洁、专业、有说服力的商务表达。',
            difficulty: 3,
            estimatedHours: 15,
            prerequisites: ['英文阅读技巧'],
            resources: [
              { type: 'tutorial', title: '商务邮件写作模板与范例', url: 'https://www.businessenglish.com/' },
            ],
            children: [],
          },
        ],
      },
      {
        title: '考试备考',
        description: '针对四六级、雅思、托福等主流英语考试，系统备考词汇、语法和题型技巧，高效提分。',
        difficulty: 3,
        estimatedHours: 75,
        prerequisites: [],
        resources: [
          { type: 'book', title: '《剑桥雅思真题集》', url: 'https://book.douban.com/subject/30415955/' },
        ],
        children: [
          {
            title: '词汇系统记忆',
            description: '运用词根词缀法、语境记忆法和间隔重复（Anki）等方法，高效突破考试词汇关。',
            difficulty: 2,
            estimatedHours: 30,
            prerequisites: [],
            resources: [
              { type: 'practice', title: 'Anki 词汇卡片每日复习', url: 'https://apps.ankiweb.net/' },
              { type: 'book', title: '《Word Power Made Easy》', url: 'https://book.douban.com/subject/4152480/' },
            ],
            children: [],
          },
          {
            title: '语法系统复习',
            description: '系统梳理英语语法体系：时态、语态、从句、非谓语动词、虚拟语气等重点难点，消除语法盲区。',
            difficulty: 2,
            estimatedHours: 20,
            prerequisites: [],
            resources: [
              { type: 'book', title: '《英语语法新思维》张满胜', url: 'https://book.douban.com/subject/3048044/' },
            ],
            children: [],
          },
          {
            title: '真题精练与解析',
            description: '通过限时模拟考试和真题解析，掌握各题型解题技巧、时间分配策略和易错点规避方法。',
            difficulty: 3,
            estimatedHours: 25,
            prerequisites: ['词汇系统记忆', '语法系统复习'],
            resources: [
              { type: 'practice', title: '每周完成一套完整模拟考并分析错因' },
              { type: 'tutorial', title: '雅思/托福写作评分标准解读', url: 'https://www.ielts.org/for-test-takers/how-ielts-is-scored' },
            ],
            children: [],
          },
        ],
      },
    ],
  },
];
