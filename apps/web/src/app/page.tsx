import Link from "next/link";
import { Cpu, TrendingUp, Home as HomeIcon, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: '知渡 - AI 志愿填报与大学生成长平台',
  description: '从高考志愿到人生规划，AI 驱动的个人成长操作系统。覆盖 3000+ 高校，500+ 专业，智能匹配冲稳保三档方案。',
  alternates: { canonical: '/' },
};

type IconComponent = React.ComponentType<{ className?: string }>;

interface Feature {
  icon: IconComponent;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
}

const features: Feature[] = [
  {
    icon: Cpu,
    title: "核心引擎层",
    subtitle: "Core Engine",
    description:
      "基于 AI 的智能匹配引擎，涵盖高校数据库、专业解析、志愿推荐算法，为每个学生提供精准的升学方案。",
    tags: ["高校库", "专业库", "智能匹配"],
  },
  {
    icon: TrendingUp,
    title: "成长管理层",
    subtitle: "Growth Management",
    description:
      "从学业规划到职业发展，全程追踪学生成长轨迹，提供目标设定、进度管理与智能建议。",
    tags: ["学业规划", "目标追踪", "成长档案"],
  },
  {
    icon: HomeIcon,
    title: "个人空间层",
    subtitle: "Personal Space",
    description:
      "个性化的学习空间，支持笔记管理、知识图谱、智能复盘，打造专属的学习与成长基地。",
    tags: ["笔记系统", "知识图谱", "智能复盘"],
  },
  {
    icon: Users,
    title: "关系网络层",
    subtitle: "Relationships",
    description:
      "连接学生、家长、导师与院校老师，构建多角色协作网络，实现信息透明与高效沟通。",
    tags: ["导师匹配", "家校互动", "社区交流"],
  },
];

const steps = [
  {
    step: "01",
    title: "填写个人信息",
    description: "输入成绩、兴趣、目标地区等基本信息，系统快速建立个人档案。",
  },
  {
    step: "02",
    title: "AI 智能分析",
    description: "基于海量高校数据与录取规律，AI 引擎进行多维度匹配分析。",
  },
  {
    step: "03",
    title: "获取专属方案",
    description: "生成个性化志愿推荐报告，含冲、稳、保三档院校组合建议。",
  },
  {
    step: "04",
    title: "全程成长陪伴",
    description: "从志愿填报到大学毕业，持续提供学业、职业、生活全方位指导。",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: '知渡',
            alternateName: 'Zhidu',
            description: '从高考志愿到人生规划，AI 驱动的个人成长操作系统',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
            featureList: [
              'AI 智能志愿填报',
              '院校专业匹配',
              '生涯规划',
              '学业管理与 GPA 计算',
              '技能树成长追踪',
              'AI 知识问答',
            ],
          }),
        }}
      />
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">
              知
            </div>
            <span className="text-xl font-bold text-navy">知渡</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-text-secondary transition hover:text-navy">
              产品功能
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-text-secondary transition hover:text-navy"
            >
              使用流程
            </a>
            <a href="#" className="text-sm text-text-secondary transition hover:text-navy">
              关于我们
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition hover:text-navy"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-light"
            >
              免费开始
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue/5 blur-3xl" />
          <div className="absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-navy/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-20 pt-24 md:pb-28 md:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-text-secondary">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              AI 驱动的升学与成长平台
            </div>

            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-navy md:text-5xl lg:text-6xl">
              从高考志愿
              <br />
              <span className="text-blue">到人生规划</span>
            </h1>

            <p className="mb-10 text-lg leading-relaxed text-text-secondary md:text-xl">
              知渡是你的 AI 个人成长操作系统。从志愿填报到大学毕业，
              知能匹配、全程陪伴、精准规划每一步。
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-8 py-3.5 text-base font-semibold text-white transition hover:bg-navy-light"
              >
                免费开始使用
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-8 py-3.5 text-base font-semibold text-navy transition hover:bg-border-subtle"
              >
                了解更多
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 border-t border-border pt-10">
              <div>
                <div className="text-2xl font-bold text-navy md:text-3xl">3000+</div>
                <div className="mt-1 text-sm text-text-tertiary">覆盖高校</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-navy md:text-3xl">500+</div>
                <div className="mt-1 text-sm text-text-tertiary">专业解析</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-navy md:text-3xl">98%</div>
                <div className="mt-1 text-sm text-text-tertiary">用户满意度</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-navy md:text-4xl">四大核心模块</h2>
            <p className="text-lg text-text-secondary">
              从内核引擎到外延服务，构建完整的学生成长生态系统
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.subtitle}
                className="group rounded-2xl border border-border bg-background p-8 transition hover:border-blue/30"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/10">
                    <feature.icon className="h-6 w-6 text-navy" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-navy">{feature.title}</h3>
                    <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      {feature.subtitle}
                    </span>
                  </div>
                </div>
                <p className="mb-5 leading-relaxed text-text-secondary">{feature.description}</p>
                <div className="flex flex-wrap gap-2">
                  {feature.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-navy/5 px-3 py-1 text-xs font-medium text-navy"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-navy md:text-4xl">简单四步，开启智能升学</h2>
            <p className="text-lg text-text-secondary">
              从信息录入到方案生成，AI 全程为你保驾护航
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((item) => (
              <div key={item.step} className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue/10 text-lg font-bold text-blue">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-bold text-navy">{item.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{item.description}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-20 rounded-2xl bg-navy p-10 text-center md:p-14">
            <h3 className="mb-4 text-2xl font-bold text-white md:text-3xl">
              准备好开启你的智能升学之路了吗？
            </h3>
            <p className="mb-8 text-blue-light">
              免费注册，立即体验 AI 志愿推荐与成长管理服务
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-navy transition hover:bg-blue-light hover:text-white"
            >
              立即开始
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-navy text-xs font-bold text-white">
                知
              </div>
              <span className="text-lg font-bold text-navy">知渡</span>
              <span className="text-sm text-text-tertiary">© 2026</span>
            </div>
            <div className="flex gap-8 text-sm text-text-secondary">
              <Link href="/privacy" className="transition hover:text-navy">
                隐私政策
              </Link>
              <Link href="/terms" className="transition hover:text-navy">
                服务条款
              </Link>
              <a href="mailto:zhiwaisong@gmail.com" className="transition hover:text-navy">
                联系我们
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
