import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Trophy, Award, Target, BookOpen, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  category: string;
  earned_at?: string;
}

interface AchievementCardProps {
  achievement: Achievement;
  earned?: boolean;
  onHover?: (achievement: Achievement) => void;
}

const categoryIcons = {
  milestone: Trophy,
  streak: Award,
  goals: Target,
  journal: BookOpen,
  community: Users,
  tools: Wrench,
};

const categoryGradients = {
  milestone: "from-yellow-500 to-amber-600",
  streak: "from-blue-500 to-indigo-600",
  goals: "from-green-500 to-emerald-600",
  journal: "from-purple-500 to-violet-600",
  community: "from-pink-500 to-rose-600",
  tools: "from-cyan-500 to-sky-600",
};

const AchievementCard = ({ achievement, earned = false, onHover }: AchievementCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = categoryIcons[achievement.category as keyof typeof categoryIcons] || Trophy;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 transform border border-border/50 backdrop-blur-lg",
        earned ? "bg-gradient-to-br bg-opacity-10" : "bg-card/60 opacity-40",
        earned && categoryGradients[achievement.category as keyof typeof categoryGradients],
        isHovered && "scale-105"
      )}
      onMouseEnter={() => {
        setIsHovered(true);
        onHover?.(achievement);
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="relative z-10 space-y-3 text-center p-4">
        <div className="mx-auto rounded-full p-3 bg-background/80 backdrop-blur-sm">
          <Icon className={cn(
            "w-8 h-8",
            earned ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        <div className="space-y-1">
          <h3 className={cn(
            "font-semibold leading-none tracking-tight",
            earned ? "text-primary-foreground" : "text-muted-foreground"
          )}>
            {achievement.title}
          </h3>
          <p className={cn(
            "text-sm",
            earned ? "text-primary-foreground/80" : "text-muted-foreground/60"
          )}>
            {achievement.xp_reward} XP
          </p>
        </div>
      </CardHeader>
      {isHovered && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 text-center transition-opacity duration-200">
          <p className="text-sm text-white">{achievement.description}</p>
        </div>
      )}
      {earned && achievement.earned_at && (
        <div className="absolute bottom-2 right-2">
          <span className="text-xs text-primary-foreground/80">
            Earned {new Date(achievement.earned_at).toLocaleDateString()}
          </span>
        </div>
      )}
    </Card>
  );
};

export default AchievementCard;