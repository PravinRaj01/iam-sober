import { Button } from "@/components/ui/button";
import { TrendingUp, BookOpen, Target, AlertCircle, PartyPopper } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface QuickActionsProps {
  onAction: (message: string) => void;
  compact?: boolean;
}

const QuickActions = ({ onAction, compact }: QuickActionsProps) => {
  const { t } = useLanguage();

  const actions = [
    {
      icon: TrendingUp,
      label: t("chatbot.qa.howAmIDoing"),
      message: t("chatbot.qa.howAmIDoingMsg"),
    },
    {
      icon: BookOpen,
      label: t("chatbot.qa.journalInsights"),
      message: t("chatbot.qa.journalInsightsMsg"),
    },
    {
      icon: Target,
      label: t("chatbot.qa.setGoal"),
      message: t("chatbot.qa.setGoalMsg"),
    },
    {
      icon: AlertCircle,
      label: t("chatbot.qa.struggling"),
      message: t("chatbot.qa.strugglingMsg"),
    },
    {
      icon: PartyPopper,
      label: t("chatbot.qa.celebrateWins"),
      message: t("chatbot.qa.celebrateWinsMsg"),
    },
  ];

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {actions.slice(0, 3).map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            onClick={() => onAction(action.message)}
            className="shrink-0"
          >
            <action.icon className="h-3 w-3 mr-1" />
            {action.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 w-full max-w-md mx-auto">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          onClick={() => onAction(action.message)}
          className="justify-start h-auto py-3 w-full"
        >
          <action.icon className="h-4 w-4 mr-2 shrink-0" />
          <span className="text-left truncate">{action.label}</span>
        </Button>
      ))}
    </div>
  );
};

export default QuickActions;