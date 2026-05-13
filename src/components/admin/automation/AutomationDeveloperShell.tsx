import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AUTOMATION_TAB_GROUPS,
  AUTOMATION_TAB_IDS,
  AUTOMATION_TAB_INTRO,
  type AutomationTabId,
} from '@/components/admin/automation/constants';
import { TemplatesTab } from '@/components/admin/automation/TemplatesTab';
import { FlowsTab } from '@/components/admin/automation/FlowsTab';
import { CampaignsTab } from '@/components/admin/automation/CampaignsTab';
import { AudienceTab } from '@/components/admin/automation/AudienceTab';
import { BirthdaysTab } from '@/components/admin/automation/BirthdaysTab';
import { LogsTab } from '@/components/admin/automation/LogsTab';
import { DeveloperIntegrationTab } from '@/components/admin/automation/DeveloperIntegrationTab';

type Props = {
  validTab: AutomationTabId;
  onTabChange: (tab: AutomationTabId) => void;
};

export function AutomationDeveloperShell({ validTab, onTabChange }: Props) {
  const tabIntro = AUTOMATION_TAB_INTRO[validTab];

  return (
    <Tabs value={validTab} onValueChange={(v) => onTabChange(v as AutomationTabId)} className="mt-6">
      <TabsList className="w-full flex flex-col gap-3 h-auto bg-violet-50/80 p-3 rounded-2xl border border-violet-100 items-stretch">
        {AUTOMATION_TAB_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {group.tabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary px-3 py-2 text-sm shrink-0"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </div>
          </div>
        ))}
      </TabsList>

      <div className="mt-6 rounded-3xl border border-border/50 bg-gradient-to-b from-white to-violet-50/30 p-5 md:p-7 shadow-[0_8px_40px_-12px_rgba(124,58,237,0.15)]">
        <div className="mb-6 rounded-2xl border border-violet-100/80 bg-white/70 px-4 py-3 text-right shadow-sm">
          <p className="text-sm font-semibold text-foreground">{tabIntro.headline}</p>
          <ol className="mt-2 mr-4 list-decimal text-xs text-muted-foreground space-y-1 leading-relaxed">
            {tabIntro.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>

        <TabsContent value="templates" className="mt-0 outline-none">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="flows" className="mt-0 outline-none">
          <FlowsTab />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-0 outline-none">
          <CampaignsTab />
        </TabsContent>
        <TabsContent value="audience" className="mt-0 outline-none">
          <AudienceTab />
        </TabsContent>
        <TabsContent value="birthdays" className="mt-0 outline-none">
          <BirthdaysTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-0 outline-none">
          <LogsTab />
        </TabsContent>
        <TabsContent value="integration" className="mt-0 outline-none">
          <DeveloperIntegrationTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}
