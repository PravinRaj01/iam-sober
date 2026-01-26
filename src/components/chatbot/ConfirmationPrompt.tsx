import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, X, AlertCircle } from "lucide-react";

interface ConfirmationPromptProps {
  action: string;
  details: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ConfirmationPrompt = ({ 
  action, 
  details, 
  onConfirm, 
  onCancel,
  isLoading 
}: ConfirmationPromptProps) => {
  return (
    <Card className="border-primary/30 bg-primary/5 animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <AlertCircle className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium">Confirm: {action}</p>
              <p className="text-xs text-muted-foreground mt-1">{details}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onConfirm}
                disabled={isLoading}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfirmationPrompt;
