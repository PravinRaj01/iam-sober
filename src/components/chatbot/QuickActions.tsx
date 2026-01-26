import { Button } from "@/components/ui/button";
import { TrendingUp, BookOpen, Target, AlertCircle, PartyPopper } from "lucide-react";

interface QuickActionsProps {
  onAction: (message: string) => void;
  compact?: boolean;
}

const QuickActions = ({ onAction, compact }: QuickActionsProps) => {
  const actions = [
    {
      icon: TrendingUp,
      label: "How am I doing?",
      message: "Can you analyze my overall progress and give me insights?",
    },
    {
      icon: BookOpen,
      label: "Journal insights",
      message: "What patterns do you see in my recent journal entries?",
    },
    {
      icon: Target,
      label: "Set a goal",
      message: "Help me create a meaningful recovery goal based on my progress",
    },
    {
      icon: AlertCircle,
      label: "I'm struggling",
      message: "I'm having a difficult moment right now. Can you suggest some coping strategies?",
    },
    {
      icon: PartyPopper,
      label: "Celebrate wins",
      message: "Let's celebrate my achievements! What milestones have I reached?",
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
