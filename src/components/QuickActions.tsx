import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, BookOpen, Target, Activity } from "lucide-react";

const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    { label: "Check In", icon: Heart, path: "/check-in", gradient: "bg-gradient-primary" },
    { label: "Journal", icon: BookOpen, path: "/journal", gradient: "bg-gradient-success" },
    { label: "Goals", icon: Target, path: "/goals", gradient: "bg-accent" },
    { label: "Coping Tools", icon: Activity, path: "/coping", gradient: "bg-warning" },
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`${action.gradient} text-white h-auto py-6 flex flex-col items-center space-y-2 hover:opacity-90 transition-opacity`}
              variant="default"
            >
              <Icon className="h-6 w-6" />
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
};

export default QuickActions;
