import { differenceInDays } from "date-fns";
import { Award, Calendar, Star, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

interface MilestonesBadgesProps {
  startDate: string;
}

const MilestonesBadges = ({ startDate }: MilestonesBadgesProps) => {
  const { t } = useLanguage();
  const daysSober = differenceInDays(new Date(), new Date(startDate));

  const milestones = [
    { days: 1, labelKey: "milestones.1day" as const, icon: Star, color: "text-yellow-500" },
    { days: 7, labelKey: "milestones.1week" as const, icon: Calendar, color: "text-blue-500" },
    { days: 30, labelKey: "milestones.1month" as const, icon: Award, color: "text-purple-500" },
    { days: 90, labelKey: "milestones.90days" as const, icon: Trophy, color: "text-success" },
    { days: 180, labelKey: "milestones.6months" as const, icon: Trophy, color: "text-primary" },
    { days: 365, labelKey: "milestones.1year" as const, icon: Trophy, color: "text-accent" },
  ];

  return (
    <Card className="p-6 bg-card/60 backdrop-blur-xl border-border/40">
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
        {t("milestones.title")}
      </h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {milestones.map((milestone) => {
          const achieved = daysSober >= milestone.days;
          const Icon = milestone.icon;

          return (
            <div
              key={milestone.days}
              className={`flex flex-col items-center space-y-2 p-4 rounded-xl transition-all backdrop-blur-sm ${
                achieved
                  ? "bg-gradient-success text-success-foreground shadow-lg hover:shadow-2xl"
                  : "bg-muted/20 backdrop-blur-sm text-muted-foreground opacity-50"
              }`}
            >
              <Icon className={`h-5 w-5 ${achieved ? "" : "opacity-50"}`} />
              <span className="text-xs font-medium text-center">{t(milestone.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default MilestonesBadges;