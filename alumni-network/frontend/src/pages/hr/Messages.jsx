import { PageHeader } from "@/components/ui-custom";
import HRCommunicationsPanel from "@/components/hr-communications-panel";

export default function HRMessagesPage() {
  return <>
      <PageHeader title="Messages" description="Reply to alumni through the HR Communications channel." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Messages"
    }]} />
      <HRCommunicationsPanel />
    </>;
}
