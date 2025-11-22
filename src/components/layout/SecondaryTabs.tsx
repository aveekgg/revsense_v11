import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SecondaryTabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const SecondaryTabs = ({ tabs, activeTab, onTabChange }: SecondaryTabsProps) => {
  return (
    <div className="border-b bg-card">
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent h-12 px-4">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};

export default SecondaryTabs;
