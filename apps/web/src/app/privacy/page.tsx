import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: '隐私政策 - 知渡',
  description: '知渡平台隐私政策',
};

const sections = [
  {
    title: '一、信息收集',
    content:
      '我们在您注册和使用知渡平台的过程中，会收集以下信息：账号信息（邮箱地址、密码）、个人资料（姓名、省份、年级等）、使用数据（访问日志、功能使用记录、设备信息）以及您主动提交的成绩、兴趣偏好等升学相关信息。我们仅收集为提供服务所必需的信息。',
  },
  {
    title: '二、信息使用',
    content:
      '我们收集的信息用于以下目的：提供和优化平台核心服务（如 AI 志愿推荐、学业规划建议）、维护账号安全与身份验证、发送服务通知和系统公告、分析平台使用情况以改进产品体验、履行法律法规规定的义务。我们不会将您的个人信息用于与平台服务无关的商业目的。',
  },
  {
    title: '三、信息存储与安全',
    content:
      '您的数据存储在经过安全认证的服务端环境中。我们采用行业标准的加密技术保护数据传输过程，并通过访问控制、日志审计等措施保障数据安全。尽管我们采取了合理的安全措施，但无法保证互联网传输的绝对安全性。建议您妥善保管账号密码，定期更换密码以增强安全性。',
  },
  {
    title: '四、信息共享',
    content:
      '未经您的明确同意，我们不会将您的个人信息出售或出租给第三方。在以下情形中，我们可能会共享必要的信息：为提供核心服务所需的技术合作方（如 AI 模型服务、云存储）且已签署保密协议；法律法规要求或政府主管部门依法要求；为保护知渡及用户的合法权益和人身安全所必需。',
  },
  {
    title: '五、用户权利',
    content:
      '您有权访问、更正或删除您的个人信息，也可以撤回之前给予的同意。如需注销账号，请通过平台内反馈功能或邮件联系我们，我们将在 15 个工作日内处理。注销后，我们将停止使用您的个人信息，但法律法规要求保留的数据除外。',
  },
  {
    title: '六、Cookie 使用',
    content:
      '我们使用 Cookie 和类似技术来提升用户体验，包括保持登录状态、记录用户偏好设置、分析流量来源和使用模式。您可以通过浏览器设置管理或禁用 Cookie，但这可能影响部分功能的正常使用。我们还可能使用第三方分析工具（如匿名化的访问统计）来帮助理解平台使用情况。',
  },
  {
    title: '七、政策更新',
    content:
      '我们可能会根据法律法规变化、业务发展或安全需要更新本隐私政策。更新后的政策将在平台内公示，重大变更会通过邮件或站内通知的方式告知用户。建议定期查看本页面以了解最新的隐私保护措施。',
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-navy text-xs font-bold text-white">
              智
            </div>
            <span className="text-lg font-bold text-navy">知渡</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <h1 className="mb-2 text-3xl font-bold text-text-primary">隐私政策</h1>
        <p className="mb-10 text-sm text-text-tertiary">
          最后更新日期：2025 年 1 月 1 日
        </p>

        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-lg font-semibold text-text-primary">
                {section.title}
              </h2>
              <p className="leading-relaxed text-text-secondary">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <span className="text-sm text-text-tertiary">
            &copy; 2025 知渡
          </span>
          <div className="flex gap-6 text-sm text-text-secondary">
            <Link href="/terms" className="transition hover:text-text-primary">
              服务条款
            </Link>
            <Link href="/" className="transition hover:text-text-primary">
              返回首页
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
