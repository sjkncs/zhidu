// @zhidu/db — 种子数据脚本（智渡教育平台）
// 为志愿推荐引擎插入院校、专业、录取分数线等参考数据
// 运行方式: npx tsx src/seed.ts

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  UniversityRow,
  Database,
} from './index';

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

interface SeedUniversity {
  name: string;
  province: string;
  city: string;
  tier: UniversityRow['tier'];
  isPublic: boolean;
  website: string;
  tags: string[];
}

interface SeedMajor {
  name: string;
  category: string;
  duration: number;
  degree: string;
  subjectRequirements: string[];
  description: string;
}

interface TierScoreRange {
  minScoreLow: number;
  minScoreHigh: number;
  rankLow: number;
  rankHigh: number;
  batch: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 简单伪随机数生成器（可重现结果）
// ─────────────────────────────────────────────────────────────────────────────

class SeededRandom {
  private seed: number;
  constructor(seed: number = 42) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return (this.seed >>> 0) / 0xffffffff;
  }
  intBetween(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

const rng = new SeededRandom(2024);

// ─────────────────────────────────────────────────────────────────────────────
// 院校数据（约80所）
// ─────────────────────────────────────────────────────────────────────────────

const universities: SeedUniversity[] = [
  // ===== 985 院校（25所）=====
  { name: '清华大学', province: '北京', city: '北京', tier: '985', isPublic: true, website: 'https://www.tsinghua.edu.cn', tags: ['综合类', '理工强校', 'C9联盟'] },
  { name: '北京大学', province: '北京', city: '北京', tier: '985', isPublic: true, website: 'https://www.pku.edu.cn', tags: ['综合类', '文理兼修', 'C9联盟'] },
  { name: '复旦大学', province: '上海', city: '上海', tier: '985', isPublic: true, website: 'https://www.fudan.edu.cn', tags: ['综合类', '文理强校', 'C9联盟'] },
  { name: '上海交通大学', province: '上海', city: '上海', tier: '985', isPublic: true, website: 'https://www.sjtu.edu.cn', tags: ['综合类', '工科强校', 'C9联盟'] },
  { name: '浙江大学', province: '浙江', city: '杭州', tier: '985', isPublic: true, website: 'https://www.zju.edu.cn', tags: ['综合类', '工科强校', 'C9联盟'] },
  { name: '中国科学技术大学', province: '安徽', city: '合肥', tier: '985', isPublic: true, website: 'https://www.ustc.edu.cn', tags: ['理工类', '科研强校', 'C9联盟'] },
  { name: '南京大学', province: '江苏', city: '南京', tier: '985', isPublic: true, website: 'https://www.nju.edu.cn', tags: ['综合类', '文理兼修', 'C9联盟'] },
  { name: '武汉大学', province: '湖北', city: '武汉', tier: '985', isPublic: true, website: 'https://www.whu.edu.cn', tags: ['综合类', '历史悠久', '双一流A类'] },
  { name: '华中科技大学', province: '湖北', city: '武汉', tier: '985', isPublic: true, website: 'https://www.hust.edu.cn', tags: ['理工类', '医工结合', '双一流A类'] },
  { name: '中山大学', province: '广东', city: '广州', tier: '985', isPublic: true, website: 'https://www.sysu.edu.cn', tags: ['综合类', '医学强校', '双一流A类'] },
  { name: '哈尔滨工业大学', province: '黑龙江', city: '哈尔滨', tier: '985', isPublic: true, website: 'https://www.hit.edu.cn', tags: ['理工类', '航天强校', 'C9联盟'] },
  { name: '西安交通大学', province: '陕西', city: '西安', tier: '985', isPublic: true, website: 'https://www.xjtu.edu.cn', tags: ['综合类', '工科强校', 'C9联盟'] },
  { name: '同济大学', province: '上海', city: '上海', tier: '985', isPublic: true, website: 'https://www.tongji.edu.cn', tags: ['理工类', '建筑强校', '双一流A类'] },
  { name: '北京航空航天大学', province: '北京', city: '北京', tier: '985', isPublic: true, website: 'https://www.buaa.edu.cn', tags: ['理工类', '航空航天', '双一流A类'] },
  { name: '北京理工大学', province: '北京', city: '北京', tier: '985', isPublic: true, website: 'https://www.bit.edu.cn', tags: ['理工类', '兵器科学', '双一流A类'] },
  { name: '天津大学', province: '天津', city: '天津', tier: '985', isPublic: true, website: 'https://www.tju.edu.cn', tags: ['理工类', '化工强校', '双一流A类'] },
  { name: '南开大学', province: '天津', city: '天津', tier: '985', isPublic: true, website: 'https://www.nankai.edu.cn', tags: ['综合类', '文理兼修', '双一流A类'] },
  { name: '厦门大学', province: '福建', city: '厦门', tier: '985', isPublic: true, website: 'https://www.xmu.edu.cn', tags: ['综合类', '经济强校', '双一流A类'] },
  { name: '东南大学', province: '江苏', city: '南京', tier: '985', isPublic: true, website: 'https://www.seu.edu.cn', tags: ['理工类', '建筑强校', '双一流A类'] },
  { name: '电子科技大学', province: '四川', city: '成都', tier: '985', isPublic: true, website: 'https://www.uestc.edu.cn', tags: ['理工类', '电子信息', '双一流A类'] },
  { name: '四川大学', province: '四川', city: '成都', tier: '985', isPublic: true, website: 'https://www.scu.edu.cn', tags: ['综合类', '医学强校', '双一流A类'] },
  { name: '中南大学', province: '湖南', city: '长沙', tier: '985', isPublic: true, website: 'https://www.csu.edu.cn', tags: ['理工类', '冶金矿业', '双一流A类'] },
  { name: '湖南大学', province: '湖南', city: '长沙', tier: '985', isPublic: true, website: 'https://www.hnu.edu.cn', tags: ['综合类', '历史悠久', '双一流B类'] },
  { name: '国防科技大学', province: '湖南', city: '长沙', tier: '985', isPublic: true, website: 'https://www.nudt.edu.cn', tags: ['理工类', '军事院校', '双一流A类'] },
  { name: '北京师范大学', province: '北京', city: '北京', tier: '985', isPublic: true, website: 'https://www.bnu.edu.cn', tags: ['师范类', '教育强校', '双一流A类'] },

  // ===== 211 院校（20所）=====
  { name: '北京交通大学', province: '北京', city: '北京', tier: '211', isPublic: true, website: 'https://www.bjtu.edu.cn', tags: ['理工类', '交通运输', '双一流'] },
  { name: '北京邮电大学', province: '北京', city: '北京', tier: '211', isPublic: true, website: 'https://www.bupt.edu.cn', tags: ['理工类', '信息通信', '双一流'] },
  { name: '华东理工大学', province: '上海', city: '上海', tier: '211', isPublic: true, website: 'https://www.ecust.edu.cn', tags: ['理工类', '化工强校', '双一流'] },
  { name: '南京航空航天大学', province: '江苏', city: '南京', tier: '211', isPublic: true, website: 'https://www.nuaa.edu.cn', tags: ['理工类', '航空航天', '双一流'] },
  { name: '南京理工大学', province: '江苏', city: '南京', tier: '211', isPublic: true, website: 'https://www.njust.edu.cn', tags: ['理工类', '兵器科学', '双一流'] },
  { name: '河海大学', province: '江苏', city: '南京', tier: '211', isPublic: true, website: 'https://www.hhu.edu.cn', tags: ['理工类', '水利工程', '双一流'] },
  { name: '西南交通大学', province: '四川', city: '成都', tier: '211', isPublic: true, website: 'https://www.swjtu.edu.cn', tags: ['理工类', '交通运输', '双一流'] },
  { name: '华中师范大学', province: '湖北', city: '武汉', tier: '211', isPublic: true, website: 'https://www.ccnu.edu.cn', tags: ['师范类', '教育强校', '双一流'] },
  { name: '华南师范大学', province: '广东', city: '广州', tier: '211', isPublic: true, website: 'https://www.scnu.edu.cn', tags: ['师范类', '教育强校', '双一流'] },
  { name: '东北师范大学', province: '吉林', city: '长春', tier: '211', isPublic: true, website: 'https://www.nenu.edu.cn', tags: ['师范类', '教育强校', '双一流'] },
  { name: '陕西师范大学', province: '陕西', city: '西安', tier: '211', isPublic: true, website: 'https://www.snnu.edu.cn', tags: ['师范类', '教育强校', '双一流'] },
  { name: '西北大学', province: '陕西', city: '西安', tier: '211', isPublic: true, website: 'https://www.nwu.edu.cn', tags: ['综合类', '历史悠久', '双一流'] },
  { name: '郑州大学', province: '河南', city: '郑州', tier: '211', isPublic: true, website: 'https://www.zzu.edu.cn', tags: ['综合类', '双一流B类', '省内龙头'] },
  { name: '合肥工业大学', province: '安徽', city: '合肥', tier: '211', isPublic: true, website: 'https://www.hfut.edu.cn', tags: ['理工类', '机械汽车', '双一流'] },
  { name: '福州大学', province: '福建', city: '福州', tier: '211', isPublic: true, website: 'https://www.fzu.edu.cn', tags: ['理工类', '化学化工', '双一流'] },
  { name: '南昌大学', province: '江西', city: '南昌', tier: '211', isPublic: true, website: 'https://www.ncu.edu.cn', tags: ['综合类', '双一流', '省内龙头'] },
  { name: '太原理工大学', province: '山西', city: '太原', tier: '211', isPublic: true, website: 'https://www.tyut.edu.cn', tags: ['理工类', '矿业工程', '双一流'] },
  { name: '贵州大学', province: '贵州', city: '贵阳', tier: '211', isPublic: true, website: 'https://www.gzu.edu.cn', tags: ['综合类', '双一流', '省内龙头'] },
  { name: '云南大学', province: '云南', city: '昆明', tier: '211', isPublic: true, website: 'https://www.ynu.edu.cn', tags: ['综合类', '双一流B类', '民族特色'] },
  { name: '海南大学', province: '海南', city: '海口', tier: '211', isPublic: true, website: 'https://www.hainu.edu.cn', tags: ['综合类', '双一流', '热带农业'] },

  // ===== 双一流 院校（15所）=====
  { name: '南京邮电大学', province: '江苏', city: '南京', tier: '双一流', isPublic: true, website: 'https://www.njupt.edu.cn', tags: ['理工类', '信息通信', '双一流'] },
  { name: '首都师范大学', province: '北京', city: '北京', tier: '双一流', isPublic: true, website: 'https://www.cnu.edu.cn', tags: ['师范类', '教育强校', '双一流'] },
  { name: '外交学院', province: '北京', city: '北京', tier: '双一流', isPublic: true, website: 'https://www.cfau.edu.cn', tags: ['语言类', '外交外事', '双一流'] },
  { name: '中国科学院大学', province: '北京', city: '北京', tier: '双一流', isPublic: true, website: 'https://www.ucas.ac.cn', tags: ['理工类', '科研强校', '双一流'] },
  { name: '上海科技大学', province: '上海', city: '上海', tier: '双一流', isPublic: true, website: 'https://www.shanghaitech.edu.cn', tags: ['理工类', '科研创新', '双一流'] },
  { name: '南方科技大学', province: '广东', city: '深圳', tier: '双一流', isPublic: true, website: 'https://www.sustech.edu.cn', tags: ['理工类', '科研创新', '双一流'] },
  { name: '华南农业大学', province: '广东', city: '广州', tier: '双一流', isPublic: true, website: 'https://www.scau.edu.cn', tags: ['农林类', '农业科学', '双一流'] },
  { name: '广州医科大学', province: '广东', city: '广州', tier: '双一流', isPublic: true, website: 'https://www.gzhmu.edu.cn', tags: ['医药类', '临床医学', '双一流'] },
  { name: '南京医科大学', province: '江苏', city: '南京', tier: '双一流', isPublic: true, website: 'https://www.njmu.edu.cn', tags: ['医药类', '公共卫生', '双一流'] },
  { name: '湘潭大学', province: '湖南', city: '湘潭', tier: '双一流', isPublic: true, website: 'https://www.xtu.edu.cn', tags: ['综合类', '数学强校', '双一流'] },
  { name: '河南大学', province: '河南', city: '开封', tier: '双一流', isPublic: true, website: 'https://www.henu.edu.cn', tags: ['综合类', '历史悠久', '双一流'] },
  { name: '山西大学', province: '山西', city: '太原', tier: '双一流', isPublic: true, website: 'https://www.sxu.edu.cn', tags: ['综合类', '物理学', '双一流'] },
  { name: '石河子大学', province: '新疆', city: '石河子', tier: '双一流', isPublic: true, website: 'https://www.shzu.edu.cn', tags: ['综合类', '农学医学', '双一流'] },
  { name: '新疆大学', province: '新疆', city: '乌鲁木齐', tier: '双一流', isPublic: true, website: 'https://www.xju.edu.cn', tags: ['综合类', '双一流B类', '民族特色'] },
  { name: '成都理工大学', province: '四川', city: '成都', tier: '双一流', isPublic: true, website: 'https://www.cdut.edu.cn', tags: ['理工类', '地质工程', '双一流'] },

  // ===== 普通本科 院校（15所）=====
  { name: '深圳大学', province: '广东', city: '深圳', tier: '普通本科', isPublic: true, website: 'https://www.szu.edu.cn', tags: ['综合类', '创新活力', '特区高校'] },
  { name: '杭州电子科技大学', province: '浙江', city: '杭州', tier: '普通本科', isPublic: true, website: 'https://www.hdu.edu.cn', tags: ['理工类', '电子信息', 'IT就业强'] },
  { name: '重庆邮电大学', province: '重庆', city: '重庆', tier: '普通本科', isPublic: true, website: 'https://www.cqupt.edu.cn', tags: ['理工类', '信息通信', 'IT就业强'] },
  { name: '南京审计大学', province: '江苏', city: '南京', tier: '普通本科', isPublic: true, website: 'https://www.nau.edu.cn', tags: ['财经类', '审计特色', '行业强校'] },
  { name: '浙江工商大学', province: '浙江', city: '杭州', tier: '普通本科', isPublic: true, website: 'https://www.zjgsu.edu.cn', tags: ['财经类', '工商管理', '省内名校'] },
  { name: '天津财经大学', province: '天津', city: '天津', tier: '普通本科', isPublic: true, website: 'https://www.tjufe.edu.cn', tags: ['财经类', '经济管理', '行业强校'] },
  { name: '东北财经大学', province: '辽宁', city: '大连', tier: '普通本科', isPublic: true, website: 'https://www.dufe.edu.cn', tags: ['财经类', '经济管理', '行业强校'] },
  { name: '江西财经大学', province: '江西', city: '南昌', tier: '普通本科', isPublic: true, website: 'https://www.jxufe.edu.cn', tags: ['财经类', '经济管理', '行业强校'] },
  { name: '安徽大学', province: '安徽', city: '合肥', tier: '普通本科', isPublic: true, website: 'https://www.ahu.edu.cn', tags: ['综合类', '省内重点', '文理兼修'] },
  { name: '江苏大学', province: '江苏', city: '镇江', tier: '普通本科', isPublic: true, website: 'https://www.ujs.edu.cn', tags: ['理工类', '农业工程', '综合实力强'] },
  { name: '扬州大学', province: '江苏', city: '扬州', tier: '普通本科', isPublic: true, website: 'https://www.yzu.edu.cn', tags: ['综合类', '农学兽医', '省内重点'] },
  { name: '青岛大学', province: '山东', city: '青岛', tier: '普通本科', isPublic: true, website: 'https://www.qdu.edu.cn', tags: ['综合类', '医学纺织', '省内重点'] },
  { name: '济南大学', province: '山东', city: '济南', tier: '普通本科', isPublic: true, website: 'https://www.ujn.edu.cn', tags: ['综合类', '材料化工', '省内重点'] },
  { name: '宁波大学', province: '浙江', city: '宁波', tier: '普通本科', isPublic: true, website: 'https://www.nbu.edu.cn', tags: ['综合类', '海洋水产', '双一流建设'] },
  { name: '汕头大学', province: '广东', city: '汕头', tier: '普通本科', isPublic: false, website: 'https://www.stu.edu.cn', tags: ['综合类', '李嘉诚基金会', '国际化'] },

  // ===== 专科 院校（10所）=====
  { name: '深圳职业技术大学', province: '广东', city: '深圳', tier: '专科', isPublic: true, website: 'https://www.szpt.edu.cn', tags: ['理工类', '职业技术', '国家示范高职'] },
  { name: '北京电子科技职业学院', province: '北京', city: '北京', tier: '专科', isPublic: true, website: 'https://www.bgy.org.cn', tags: ['理工类', '电子信息', '国家示范高职'] },
  { name: '天津市职业大学', province: '天津', city: '天津', tier: '专科', isPublic: true, website: 'https://www.tjtc.edu.cn', tags: ['综合类', '职业技术', '国家示范高职'] },
  { name: '南京工业职业技术大学', province: '江苏', city: '南京', tier: '专科', isPublic: true, website: 'https://www.niit.edu.cn', tags: ['理工类', '工业技术', '国家示范高职'] },
  { name: '无锡职业技术学院', province: '江苏', city: '无锡', tier: '专科', isPublic: true, website: 'https://www.wxit.edu.cn', tags: ['理工类', '智能制造', '国家示范高职'] },
  { name: '金华职业技术大学', province: '浙江', city: '金华', tier: '专科', isPublic: true, website: 'https://www.jhc.cn', tags: ['综合类', '职业技术', '国家示范高职'] },
  { name: '重庆电子工程职业学院', province: '重庆', city: '重庆', tier: '专科', isPublic: true, website: 'https://www.cqcet.edu.cn', tags: ['理工类', '电子工程', '国家示范高职'] },
  { name: '武汉职业技术学院', province: '湖北', city: '武汉', tier: '专科', isPublic: true, website: 'https://www.wtc.edu.cn', tags: ['综合类', '职业技术', '国家示范高职'] },
  { name: '成都航空职业技术学院', province: '四川', city: '成都', tier: '专科', isPublic: true, website: 'https://www.cap.edu.cn', tags: ['理工类', '航空制造', '国家示范高职'] },
  { name: '长沙民政职业技术学院', province: '湖南', city: '长沙', tier: '专科', isPublic: true, website: 'https://www.csmzxy.edu.cn', tags: ['综合类', '社会工作', '国家示范高职'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// 专业数据（约60个，覆盖12个学科门类）
// ─────────────────────────────────────────────────────────────────────────────

const majors: SeedMajor[] = [
  // ===== 工学（10个）=====
  { name: '计算机科学与技术', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养具备计算机软硬件系统设计、开发与应用能力的高级工程技术人才' },
  { name: '软件工程', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养从事软件开发、测试、维护和管理的高素质应用型工程技术人才' },
  { name: '电子信息工程', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养具备电子技术和信息系统设计、开发能力的宽口径工程技术人才' },
  { name: '人工智能', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养掌握人工智能基础理论、核心技术和应用能力的前沿科技人才' },
  { name: '机械工程', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养从事机械设计制造、自动化及机电一体化的工程技术人才' },
  { name: '土木工程', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养从事土木工程设计、施工、管理的高级工程技术人才' },
  { name: '自动化', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养掌握自动控制、计算机技术和信息处理的复合型工程技术人才' },
  { name: '材料科学与工程', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理', '化学'], description: '培养从事材料研究、开发与应用的高级科学技术人才' },
  { name: '通信工程', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养具备通信系统和通信网络设计、开发能力的工程技术人才' },
  { name: '数据科学与大数据技术', category: '工学', duration: 4, degree: '工学学士', subjectRequirements: ['物理'], description: '培养掌握大数据采集、存储、分析和应用的数据科学人才' },

  // ===== 理学（6个）=====
  { name: '数学与应用数学', category: '理学', duration: 4, degree: '理学学士', subjectRequirements: ['物理'], description: '培养具有扎实数学基础和较强科研能力的高级数学人才' },
  { name: '物理学', category: '理学', duration: 4, degree: '理学学士', subjectRequirements: ['物理'], description: '培养掌握物理学基本理论和实验方法的科学研究与教育人才' },
  { name: '化学', category: '理学', duration: 4, degree: '理学学士', subjectRequirements: ['物理', '化学'], description: '培养具备化学基础理论和实验技能的科研与应用人才' },
  { name: '生物科学', category: '理学', duration: 4, degree: '理学学士', subjectRequirements: ['物理', '化学'], description: '培养具有生物科学基本理论和实验技能的科学研究人才' },
  { name: '统计学', category: '理学', duration: 4, degree: '理学学士', subjectRequirements: ['物理'], description: '培养具备统计学理论方法和数据分析能力的复合型人才' },
  { name: '信息与计算科学', category: '理学', duration: 4, degree: '理学学士', subjectRequirements: ['物理'], description: '培养掌握信息科学与计算数学基本理论和技术的复合型人才' },

  // ===== 医学（5个）=====
  { name: '临床医学', category: '医学', duration: 5, degree: '医学学士', subjectRequirements: ['物理', '化学'], description: '培养具有扎实医学基础理论和临床诊疗技能的医学人才' },
  { name: '口腔医学', category: '医学', duration: 5, degree: '医学学士', subjectRequirements: ['物理', '化学'], description: '培养从事口腔疾病预防和诊治的高级医学专门人才' },
  { name: '药学', category: '医学', duration: 4, degree: '理学学士', subjectRequirements: ['物理', '化学'], description: '培养具备药学基础理论和实验技能的医药科技人才' },
  { name: '护理学', category: '医学', duration: 4, degree: '理学学士', subjectRequirements: ['化学'], description: '培养具有护理学基本理论和临床护理技能的专业护理人才' },
  { name: '中医学', category: '医学', duration: 5, degree: '医学学士', subjectRequirements: ['物理', '化学'], description: '培养系统掌握中医理论和诊疗技能的中医药人才' },

  // ===== 经济学（5个）=====
  { name: '经济学', category: '经济学', duration: 4, degree: '经济学学士', subjectRequirements: ['物理'], description: '培养具备经济学理论基础和经济分析能力的专门人才' },
  { name: '金融学', category: '经济学', duration: 4, degree: '经济学学士', subjectRequirements: ['物理'], description: '培养掌握金融学理论和实务的高级金融人才' },
  { name: '国际经济与贸易', category: '经济学', duration: 4, degree: '经济学学士', subjectRequirements: [], description: '培养具有国际视野和经贸实务能力的复合型人才' },
  { name: '财政学', category: '经济学', duration: 4, degree: '经济学学士', subjectRequirements: [], description: '培养具备财政税收理论知识和实务能力的专业人才' },
  { name: '保险学', category: '经济学', duration: 4, degree: '经济学学士', subjectRequirements: [], description: '培养掌握保险理论与实务的高级保险专业人才' },

  // ===== 管理学（5个）=====
  { name: '工商管理', category: '管理学', duration: 4, degree: '管理学学士', subjectRequirements: [], description: '培养具有管理、经济、法律知识的企业管理人才' },
  { name: '会计学', category: '管理学', duration: 4, degree: '管理学学士', subjectRequirements: [], description: '培养具备会计、审计和财务管理能力的高级会计人才' },
  { name: '市场营销', category: '管理学', duration: 4, degree: '管理学学士', subjectRequirements: [], description: '培养具有市场分析和营销策划能力的管理人才' },
  { name: '信息管理', category: '管理学', duration: 4, degree: '管理学学士', subjectRequirements: ['物理'], description: '培养掌握信息系统分析、设计和管理的高级专门人才' },
  { name: '公共事业管理', category: '管理学', duration: 4, degree: '管理学学士', subjectRequirements: [], description: '培养具有公共管理理论和技能的公共服务人才' },

  // ===== 法学（4个）=====
  { name: '法学', category: '法学', duration: 4, degree: '法学学士', subjectRequirements: [], description: '培养具有法律专业知识和法律实务能力的法律人才' },
  { name: '知识产权', category: '法学', duration: 4, degree: '法学学士', subjectRequirements: [], description: '培养掌握知识产权法律制度和实务能力的专门人才' },
  { name: '社会学', category: '法学', duration: 4, degree: '法学学士', subjectRequirements: [], description: '培养具有社会学理论素养和社会调查能力的专门人才' },
  { name: '政治学与行政学', category: '法学', duration: 4, degree: '法学学士', subjectRequirements: [], description: '培养具有政治学理论素养和公共管理能力的复合型人才' },

  // ===== 文学（5个）=====
  { name: '汉语言文学', category: '文学', duration: 4, degree: '文学学士', subjectRequirements: [], description: '培养具有扎实中文功底和文学素养的语言文化人才' },
  { name: '英语', category: '文学', duration: 4, degree: '文学学士', subjectRequirements: [], description: '培养具有英语语言能力和跨文化交际能力的外语人才' },
  { name: '日语', category: '文学', duration: 4, degree: '文学学士', subjectRequirements: [], description: '培养具有日语语言能力和日本文化理解的外语专门人才' },
  { name: '新闻学', category: '文学', duration: 4, degree: '文学学士', subjectRequirements: [], description: '培养具备新闻采访、写作和编辑能力的新闻传播人才' },
  { name: '翻译', category: '文学', duration: 4, degree: '文学学士', subjectRequirements: [], description: '培养具有扎实双语能力和翻译技能的专业翻译人才' },

  // ===== 教育学（4个）=====
  { name: '教育学', category: '教育学', duration: 4, degree: '教育学学士', subjectRequirements: [], description: '培养具有教育理论素养和教育实践能力的教育工作者' },
  { name: '学前教育', category: '教育学', duration: 4, degree: '教育学学士', subjectRequirements: [], description: '培养具有学前教育专业知识和实践能力的幼教人才' },
  { name: '教育技术学', category: '教育学', duration: 4, degree: '教育学学士', subjectRequirements: ['物理'], description: '培养掌握教育技术理论与实践的信息化教育人才' },
  { name: '体育教育', category: '教育学', duration: 4, degree: '教育学学士', subjectRequirements: [], description: '培养具有体育教学与训练能力的体育教育人才' },

  // ===== 艺术学（5个）=====
  { name: '视觉传达设计', category: '艺术学', duration: 4, degree: '艺术学学士', subjectRequirements: [], description: '培养具有视觉设计创意和实践能力的艺术设计人才' },
  { name: '环境设计', category: '艺术学', duration: 4, degree: '艺术学学士', subjectRequirements: [], description: '培养具有室内和室外环境设计能力的专业设计人才' },
  { name: '数字媒体艺术', category: '艺术学', duration: 4, degree: '艺术学学士', subjectRequirements: [], description: '培养掌握数字媒体技术与艺术的复合型创意人才' },
  { name: '动画', category: '艺术学', duration: 4, degree: '艺术学学士', subjectRequirements: [], description: '培养具有动画创作和数字影视制作能力的艺术人才' },
  { name: '音乐学', category: '艺术学', duration: 4, degree: '艺术学学士', subjectRequirements: [], description: '培养具有音乐理论素养和表演能力的音乐专业人才' },

  // ===== 农学（4个）=====
  { name: '农学', category: '农学', duration: 4, degree: '农学学士', subjectRequirements: ['物理', '化学'], description: '培养具有农业科学基本理论和技能的农业科技人才' },
  { name: '园艺', category: '农学', duration: 4, degree: '农学学士', subjectRequirements: ['化学'], description: '培养具备园艺植物栽培和育种技术的专门人才' },
  { name: '动物医学', category: '农学', duration: 5, degree: '农学学士', subjectRequirements: ['物理', '化学'], description: '培养具有动物疾病防治能力的兽医专业人才' },
  { name: '食品科学与工程', category: '农学', duration: 4, degree: '工学学士', subjectRequirements: ['物理', '化学'], description: '培养具备食品加工和安全管理能力的食品科技人才' },

  // ===== 历史学（3个）=====
  { name: '历史学', category: '历史学', duration: 4, degree: '历史学学士', subjectRequirements: [], description: '培养具有历史研究能力和人文素养的历史学人才' },
  { name: '考古学', category: '历史学', duration: 4, degree: '历史学学士', subjectRequirements: [], description: '培养具有考古发掘和文物研究能力的专业人才' },
  { name: '世界史', category: '历史学', duration: 4, degree: '历史学学士', subjectRequirements: [], description: '培养具有世界历史知识和国际视野的研究人才' },

  // ===== 哲学（4个）=====
  { name: '哲学', category: '哲学', duration: 4, degree: '哲学学士', subjectRequirements: [], description: '培养具有哲学思维能力和理论素养的研究与教育人才' },
  { name: '逻辑学', category: '哲学', duration: 4, degree: '哲学学士', subjectRequirements: [], description: '培养具有逻辑分析能力和思维训练技能的专业人才' },
  { name: '宗教学', category: '哲学', duration: 4, degree: '哲学学士', subjectRequirements: [], description: '培养具有宗教文化研究能力的学术人才' },
  { name: '伦理学', category: '哲学', duration: 4, degree: '哲学学士', subjectRequirements: [], description: '培养具有道德哲学理论研究和实践应用能力的专业人才' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 分数线生成配置
// ─────────────────────────────────────────────────────────────────────────────

const SCORE_PROVINCES = ['广东', '浙江', '山东', '河南', '四川', '湖北', '江苏', '湖南', '安徽', '河北'] as const;
const SCORE_YEARS = [2023, 2024, 2025] as const;

// 各层次基础分数线范围
const TIER_SCORE_RANGES: Record<UniversityRow['tier'], TierScoreRange> = {
  '985':      { minScoreLow: 620, minScoreHigh: 690, rankLow: 100,   rankHigh: 5000,   batch: '本科一批' },
  '211':      { minScoreLow: 560, minScoreHigh: 630, rankLow: 5000,  rankHigh: 25000,  batch: '本科一批' },
  '双一流':   { minScoreLow: 530, minScoreHigh: 590, rankLow: 15000, rankHigh: 50000,  batch: '本科一批' },
  '普通本科': { minScoreLow: 450, minScoreHigh: 560, rankLow: 30000, rankHigh: 120000, batch: '本科二批' },
  '专科':     { minScoreLow: 200, minScoreHigh: 400, rankLow: 150000,rankHigh: 400000, batch: '专科批' },
};

// 省份难度系数（高考大省竞争更激烈，同校录取分更高）
const PROVINCE_DIFFICULTY: Record<string, number> = {
  '河南': 1.08,  // 高考大省，竞争最激烈
  '山东': 1.06,
  '河北': 1.05,
  '广东': 1.02,
  '四川': 1.03,
  '江苏': 1.01,
  '湖北': 1.00,
  '湖南': 1.00,
  '安徽': 1.02,
  '浙江': 1.01,
};

// 年份微调（每年分数线略有浮动）
const YEAR_OFFSET: Record<number, number> = {
  2023: 0,
  2024: -2,
  2025: 1,
};

// 985 院校内部排名（用于生成院校个体差异）
const UNIVERSITY_RANK_985: Record<string, number> = {
  '清华大学': 1, '北京大学': 2, '复旦大学': 3, '上海交通大学': 4,
  '浙江大学': 5, '中国科学技术大学': 6, '南京大学': 7, '武汉大学': 10,
  '华中科技大学': 11, '中山大学': 12, '哈尔滨工业大学': 13, '西安交通大学': 14,
  '同济大学': 15, '北京航空航天大学': 16, '北京理工大学': 17, '天津大学': 18,
  '南开大学': 19, '厦门大学': 20, '东南大学': 21, '电子科技大学': 22,
  '四川大学': 23, '中南大学': 24, '湖南大学': 25, '国防科技大学': 9,
  '北京师范大学': 8,
};

/**
 * 根据院校层次、排名、省份、年份生成分数线数据
 */
function generateScore(
  university: SeedUniversity,
  province: string,
  year: number,
): { minScore: number; avgScore: number; minRank: number; batch: string } {
  const range = TIER_SCORE_RANGES[university.tier];
  const difficulty = PROVINCE_DIFFICULTY[province] ?? 1.0;
  const yearOffset = YEAR_OFFSET[year] ?? 0;

  // 计算院校在层次内的相对位置（0-1，越小越好）
  let uniPosition = 0.5;
  if (university.tier === '985' && UNIVERSITY_RANK_985[university.name]) {
    uniPosition = (UNIVERSITY_RANK_985[university.name] - 1) / 25;
  } else {
    // 对非985院校，用名称hash作为稳定的伪随机位置
    let hash = 0;
    for (const ch of university.name) {
      hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    }
    uniPosition = Math.abs(hash % 100) / 100;
  }

  // 基础分数 = 层次高端 - 位置 * 分数区间跨度（排名越靠前分越高）
  const scoreRange = range.minScoreHigh - range.minScoreLow;
  const baseScore = range.minScoreHigh - uniPosition * scoreRange;

  // 加入省份难度和年份偏移
  const adjustedScore = baseScore * difficulty + yearOffset;

  // 加入小幅随机波动（±5分）
  const randomDelta = rng.intBetween(-5, 5);
  const minScore = Math.round(adjustedScore + randomDelta);

  // 确保分数在合理范围内
  const clampedMinScore = Math.max(range.minScoreLow, Math.min(range.minScoreHigh + 20, minScore));

  // 平均分比最低分高 3-15 分
  const avgDelta = rng.intBetween(3, 15);
  const avgScore = clampedMinScore + avgDelta;

  // 位次计算：分数越高位次越小
  const rankRange = range.rankHigh - range.rankLow;
  const baseRank = range.rankLow + uniPosition * rankRange;
  const rankDifficulty = 1 / difficulty; // 难度高的省份位次更紧
  const minRank = Math.round(baseRank * rankDifficulty + rng.intBetween(-200, 200));
  const clampedMinRank = Math.max(range.rankLow, Math.min(range.rankHigh, minRank));

  return {
    minScore: clampedMinScore,
    avgScore,
    minRank: clampedMinRank,
    batch: range.batch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 数据库操作
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 200; // 每批插入/更新数量

/**
 * 批量 upsert，自动分批处理
 */
async function batchUpsert(
  db: SupabaseClient<Database>,
  table: string,
  rows: Record<string, unknown>[],
  conflictKey: string,
  label: string,
): Promise<number> {
  let inserted = 0;
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { error } = await (db.from(table as any) as any)
      .upsert(batch, { onConflict: conflictKey });

    if (error) {
      console.error(`  [错误] ${label} 第${batchNum}/${totalBatches}批: ${error.message}`);
      continue;
    }

    inserted += batch.length;
    console.log(`  ${label}: 第${batchNum}/${totalBatches}批已写入 (${batch.length}条)`);
  }

  return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  智渡教育平台 — 数据库种子数据填充');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── 1. 初始化 Supabase 客户端 ──
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('[错误] 缺少环境变量 SUPABASE_URL 和 SUPABASE_SERVICE_KEY (或 SUPABASE_ANON_KEY)');
    console.error('  请设置后重试:');
    console.error('    export SUPABASE_URL="https://xxxxx.supabase.co"');
    console.error('    export SUPABASE_SERVICE_KEY="eyJhbG..."');
    process.exit(1);
  }

  const db = createClient(url, key) as unknown as SupabaseClient<Database>;
  console.log('[连接] Supabase 客户端已初始化');
  console.log(`[地址] ${url}`);
  console.log('');

  // ── 2. 写入院校数据 ──
  console.log('───────────────────────────────────────────────────────');
  console.log('  步骤 1/3: 写入院校数据');
  console.log('───────────────────────────────────────────────────────');

  const universityRows: Record<string, unknown>[] = universities.map((u) => ({
    name: u.name,
    province: u.province,
    city: u.city,
    tier: u.tier,
    is_public: u.isPublic,
    website: u.website,
    logo: null,
    tags: u.tags,
  }));

  const uniInserted = await batchUpsert(db, 'universities', universityRows, 'name', '院校');
  console.log(`[完成] 院校: 共写入 ${uniInserted} 条`);
  console.log('');

  // ── 3. 查询院校 ID 映射（用于关联录取分数线）──
  console.log('[查询] 获取院校 ID 映射...');
  const { data: uniData, error: uniQueryErr } = await db
    .from('universities')
    .select('id, name');

  if (uniQueryErr || !uniData) {
    console.error(`[错误] 查询院校失败: ${uniQueryErr?.message}`);
    process.exit(1);
  }

  const uniMap = new Map<string, string>();
  for (const row of uniData as Array<{ id: string; name: string }>) {
    uniMap.set(row.name, row.id);
  }
  console.log(`[查询] 已获取 ${uniMap.size} 所院校 ID`);
  console.log('');

  // ── 4. 写入专业数据 ──
  console.log('───────────────────────────────────────────────────────');
  console.log('  步骤 2/3: 写入专业数据');
  console.log('───────────────────────────────────────────────────────');

  const majorRows: Record<string, unknown>[] = majors.map((m) => ({
    name: m.name,
    category: m.category,
    duration: m.duration,
    degree: m.degree,
    subject_requirements: m.subjectRequirements,
    description: m.description,
  }));

  const majorInserted = await batchUpsert(db, 'majors', majorRows, 'name', '专业');
  console.log(`[完成] 专业: 共写入 ${majorInserted} 条`);
  console.log('');

  // ── 5. 查询专业 ID 映射 ──
  console.log('[查询] 获取专业 ID 映射...');
  const { data: majorData, error: majorQueryErr } = await db
    .from('majors')
    .select('id, name');

  if (majorQueryErr || !majorData) {
    console.error(`[错误] 查询专业失败: ${majorQueryErr?.message}`);
    process.exit(1);
  }

  const majorMap = new Map<string, string>();
  for (const row of majorData as Array<{ id: string; name: string }>) {
    majorMap.set(row.name, row.id);
  }
  console.log(`[查询] 已获取 ${majorMap.size} 个专业 ID`);
  console.log('');

  // ── 6. 生成并写入录取分数线 ──
  console.log('───────────────────────────────────────────────────────');
  console.log('  步骤 3/3: 生成并写入录取分数线');
  console.log('───────────────────────────────────────────────────────');

  // 重置随机种子以保证可重现
  const scoreRng = new SeededRandom(2024);

  const scoreRows: Record<string, unknown>[] = [];
  let comboCount = 0;

  for (const uni of universities) {
    const uniId = uniMap.get(uni.name);
    if (!uniId) {
      console.warn(`  [跳过] 未找到院校ID: ${uni.name}`);
      continue;
    }

    // 每所院校选择若干代表性专业生成录取线
    // 985: 3个, 211/双一流: 2个, 普通本科/专科: 1个（预计总计约5000条录取线）
    let majorsPerUni: number;
    switch (uni.tier) {
      case '985': majorsPerUni = 3; break;
      case '211': majorsPerUni = 2; break;
      case '双一流': majorsPerUni = 2; break;
      case '普通本科': majorsPerUni = 1; break;
      case '专科': majorsPerUni = 1; break;
      default: majorsPerUni = 1;
    }

    // 根据院校特色选择对应专业
    const selectedMajors = selectMajorsForUniversity(uni, majors.length, majorsPerUni);

    for (const major of selectedMajors) {
      const majorId = majorMap.get(major.name);
      if (!majorId) continue;

      for (const province of SCORE_PROVINCES) {
        for (const year of SCORE_YEARS) {
          const score = generateScoreForCombo(uni, major, province, year, scoreRng);
          scoreRows.push({
            university_id: uniId,
            major_id: majorId,
            province,
            year,
            min_score: score.minScore,
            avg_score: score.avgScore,
            min_rank: score.minRank,
            batch: score.batch,
          });
          comboCount++;
        }
      }
    }
  }

  console.log(`[生成] 共生成 ${scoreRows.length} 条录取分数线记录`);
  console.log(`[生成] 覆盖 ${comboCount} 个 (院校 x 专业 x 省份 x 年份) 组合`);
  console.log('');

  // 录取分数线使用 (university_id, major_id, province, year) 作为唯一约束
  const scoreInserted = await batchUpsert(
    db,
    'admission_scores',
    scoreRows,
    'university_id,major_id,province,year',
    '录取分数线',
  );
  console.log(`[完成] 录取分数线: 共写入 ${scoreInserted} 条`);
  console.log('');

  // ── 7. 汇总报告 ──
  console.log('═══════════════════════════════════════════════════════');
  console.log('  种子数据填充完成！');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('  数据汇总:');
  console.log(`    院校:       ${universities.length} 所`);
  console.log(`      985:      ${universities.filter((u) => u.tier === '985').length} 所`);
  console.log(`      211:      ${universities.filter((u) => u.tier === '211').length} 所`);
  console.log(`      双一流:   ${universities.filter((u) => u.tier === '双一流').length} 所`);
  console.log(`      普通本科: ${universities.filter((u) => u.tier === '普通本科').length} 所`);
  console.log(`      专科:     ${universities.filter((u) => u.tier === '专科').length} 所`);
  console.log(`    专业:       ${majors.length} 个`);
  console.log(`      覆盖 12 个学科门类`);
  console.log(`    录取分数线: ${scoreRows.length} 条`);
  console.log(`      年份: ${SCORE_YEARS.join(', ')}`);
  console.log(`      省份: ${SCORE_PROVINCES.join(', ')}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
}

/**
 * 为特定 (院校, 专业, 省份, 年份) 组合生成分数线
 * 相比 generateScore 增加了专业维度的微调
 */
function generateScoreForCombo(
  university: SeedUniversity,
  major: SeedMajor,
  province: string,
  year: number,
  localRng: SeededRandom,
): { minScore: number; avgScore: number; minRank: number; batch: string } {
  const range = TIER_SCORE_RANGES[university.tier];
  const difficulty = PROVINCE_DIFFICULTY[province] ?? 1.0;
  const yearOffset = YEAR_OFFSET[year] ?? 0;

  // 院校在层次内的相对位置
  let uniPosition = 0.5;
  if (university.tier === '985' && UNIVERSITY_RANK_985[university.name]) {
    uniPosition = (UNIVERSITY_RANK_985[university.name] - 1) / 25;
  } else {
    let hash = 0;
    for (const ch of university.name) {
      hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    }
    uniPosition = Math.abs(hash % 100) / 100;
  }

  // 热门专业加分偏移（计算机、金融、临床医学等）
  const HOT_MAJORS = ['计算机科学与技术', '软件工程', '人工智能', '临床医学', '口腔医学', '金融学', '数据科学与大数据技术', '电子信息工程'];
  const WARM_MAJORS = ['法学', '会计学', '通信工程', '自动化', '电气工程及其自动化', '统计学', '汉语言文学'];
  const COLD_MAJORS = ['哲学', '历史学', '考古学', '宗教学', '伦理学', '世界史', '农学', '园艺'];

  let majorOffset = 0;
  if (HOT_MAJORS.includes(major.name)) {
    majorOffset = localRng.intBetween(8, 20);
  } else if (WARM_MAJORS.includes(major.name)) {
    majorOffset = localRng.intBetween(2, 10);
  } else if (COLD_MAJORS.includes(major.name)) {
    majorOffset = localRng.intBetween(-15, -5);
  } else {
    majorOffset = localRng.intBetween(-5, 5);
  }

  // 基础分数
  const scoreRange = range.minScoreHigh - range.minScoreLow;
  const baseScore = range.minScoreHigh - uniPosition * scoreRange;

  // 综合计算
  const adjustedScore = baseScore * difficulty + yearOffset + majorOffset;
  const randomDelta = localRng.intBetween(-4, 4);
  const rawMinScore = Math.round(adjustedScore + randomDelta);
  const clampedMinScore = Math.max(range.minScoreLow, Math.min(range.minScoreHigh + 25, rawMinScore));

  // 平均分
  const avgDelta = localRng.intBetween(3, 15);
  const avgScore = clampedMinScore + avgDelta;

  // 位次
  const rankRange = range.rankHigh - range.rankLow;
  const baseRank = range.rankLow + uniPosition * rankRange;
  // 热门专业位次更小（排名更靠前）
  const majorRankFactor = HOT_MAJORS.includes(major.name) ? 0.85 : COLD_MAJORS.includes(major.name) ? 1.15 : 1.0;
  const rankDifficulty = 1 / difficulty;
  const rawRank = Math.round(baseRank * rankDifficulty * majorRankFactor + localRng.intBetween(-300, 300));
  const clampedMinRank = Math.max(range.rankLow, Math.min(range.rankHigh, rawRank));

  return {
    minScore: clampedMinScore,
    avgScore,
    minRank: clampedMinRank,
    batch: range.batch,
  };
}

/**
 * 根据院校特色选择专业子集
 */
function selectMajorsForUniversity(
  uni: SeedUniversity,
  totalMajors: number,
  count: number,
): SeedMajor[] {
  // 用院校名称生成稳定的选择
  let seed = 0;
  for (const ch of uni.name) {
    seed = ((seed << 5) - seed + ch.charCodeAt(0)) | 0;
  }

  // 根据院校类型调整专业选择倾向
  const tagStr = uni.tags.join(',');
  const is理工 = tagStr.includes('理工');
  const is医学 = tagStr.includes('医学');
  const is师范 = tagStr.includes('师范');
  const is财经 = tagStr.includes('财经');
  const is综合 = tagStr.includes('综合');

  // 给每个专业打分排序
  const scored = majors.map((m, idx) => {
    let score = Math.abs((seed * (idx + 1) * 2654435761) % 1000);

    // 理工类院校偏好工学/理学
    if (is理工 && (m.category === '工学' || m.category === '理学')) score += 500;
    // 师范类院校偏好教育学/文学
    if (is师范 && (m.category === '教育学' || m.category === '文学')) score += 500;
    // 财经类院校偏好经济学/管理学
    if (is财经 && (m.category === '经济学' || m.category === '管理学')) score += 500;
    // 医学强校偏重医学
    if (is医学 && m.category === '医学') score += 500;
    // 综合类院校分布均匀
    if (is综合) score += 200;

    return { major: m, score, idx };
  });

  // 按分数降序，取前 count 个
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, count).map((s) => s.major);

  // 确保至少包含一个工学和一个非工学专业（综合类院校）
  if (is综合 && count >= 4) {
    const has工学 = selected.some((m) => m.category === '工学');
    const has非工学 = selected.some((m) => m.category !== '工学');
    if (!has工学) {
      const gongxue = majors.find((m) => m.category === '工学');
      if (gongxue) selected[selected.length - 1] = gongxue;
    }
    if (!has非工学) {
      const feigongxue = majors.find((m) => m.category === '文学');
      if (feigongxue) selected[selected.length - 2] = feigongxue;
    }
  }

  return selected;
}

// ─────────────────────────────────────────────────────────────────────────────
// 入口（直接运行脚本时调用 main）
// ─────────────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('[致命错误]', err);
  process.exit(1);
});
