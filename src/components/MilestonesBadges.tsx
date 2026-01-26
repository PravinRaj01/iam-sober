import { differenceInDays } from "date-fns";
import { Award, Calendar, Star, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MilestonesBadgesProps {
  startDate: string;
}

const milestones = [
  { days: 1, label: "1 Day", icon: Star, color: "text-yellow-500" },
  { days: 7, label: "1 Week", icon: Calendar, color: "text-blue-500" },
  { days: 30, label: "1 Month", icon: Award, color: "text-purple-500" },
  { days: 90, label: "90 Days", icon: Trophy, color: "text-success" },
  { days: 180, label: "6 Months", icon: Trophy, color: "text-primary" },
  { days: 365, label: "1 Year", icon: Trophy, color: "text-accent" },
];

const MilestonesBadges = ({ startDate }: MilestonesBadgesProps) => {
  const daysSober = differenceInDays(new Date(), new Date(startDate));

  return (
    <Card className="p-6 bg-card/60 backdrop-blur-xl border-border/40">
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
        Milestones
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
              <span className="text-xs font-medium text-center">{milestone.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default MilestonesBadges;
