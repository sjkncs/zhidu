import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: '服务条款 - 知渡',
  description: '知渡平台服务条款',
};

const sections = [
  {
    title: '一、服务介绍',
    content:
      '知渡（以下简称"本平台"）是一个基于人工智能技术的升学规划与大学生成长管理平台。本平台为用户提供志愿填报辅助、学业规划、职业发展建议等服务。使用本平台服务前，请仔细阅读本服务条款的全部内容。一旦您注册或使用本平台服务，即表示您已充分理解并同意本条款。',
  },
  {
    title: '二、用户责任',
    content:
      '用户应确保所提供的个人信息真实、准确、完整，并在信息发生变更时及时更新。用户不得利用本平台从事任何违反法律法规的行为，包括但不限于发布虚假信息、侵犯他人知识产权、传播恶意软件或进行任何形式的网络攻击。用户应妥善保管账号信息，因账号保管不善导致的损失由用户自行承担。',
  },
  {
    title: '三、知识产权',
    content:
      '本平台的所有内容，包括但不限于文字、图片、音频、视频、软件、界面设计、商标及其他标识，均受相关知识产权法律保护。未经本平台书面许可，用户不得复制、转载、修改、分发或以其他方式使用上述内容。本平台 AI 生成的建议和报告仅供参考，不构成专业决策依据。',
  },
  {
    title: '四、免责声明',
    content:
      '本平台尽力确保服务的稳定性和准确性，但不对因不可抗力、系统维护或网络故障等原因导致的服务中断承担责任。AI 生成的志愿填报建议基于算法模型和公开数据，不保证录取结果。用户应根据自身情况综合判断，本平台不对用户基于平台建议做出的任何决策承担法律责任。',
  },
  {
    title: '五、服务变更',
    content:
      '本平台保留随时修改或暂停部分或全部服务的权利，包括但不限于功能调整、界面更新、收费模式变更等。重大变更将通过平台公告或邮件通知用户。若用户在服务变更后继续使用本平台，即视为同意变更后的条款。',
  },
  {
    title: '六、联系方式',
    content:
      '如您对本服务条款有任何疑问或建议，请通过平台内的反馈功能或发送邮件至 zhiwaisong@gmail.com 与我们联系。我们将在合理期限内回复您的咨询。',
  },
];

export default function TermsPage() {
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
              知
            </div>
            <span className="text-lg font-bold text-navy">知渡</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <h1 className="mb-2 text-3xl font-bold text-text-primary">服务条款</h1>
        <p className="mb-10 text-sm text-text-tertiary">
          最后更新日期：2026 年 7 月 1 日
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
            &copy; 2026 知渡
          </span>
          <div className="flex gap-6 text-sm text-text-secondary">
            <Link href="/privacy" className="transition hover:text-text-primary">
              隐私政策
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
