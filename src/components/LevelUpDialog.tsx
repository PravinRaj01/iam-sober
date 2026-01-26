import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import StorageImage from "./StorageImage";
import { Sparkles } from "lucide-react";

interface LevelUpDialogProps {
  open: boolean;
  onClose: () => void;
  oldLevel: number;
  newLevel: number;
}

const LevelUpDialog = ({ open, onClose, oldLevel, newLevel }: LevelUpDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-primary/20 via-card/90 to-accent/20 backdrop-blur-2xl border-2 border-primary/40 max-w-md">
        <div className="text-center space-y-6 py-4">
          <div className="flex justify-center">
            <StorageImage
              bucket="illustrations"
              path="11.png"
              alt="Level up celebration"
              className="h-40 w-auto rounded-lg opacity-90 drop-shadow-2xl animate-scale-in"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Sparkles className="h-6 w-6 animate-pulse" />
              <h2 className="text-3xl font-bold">Congratulations!</h2>
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            
            <p className="text-lg text-muted-foreground">
              You've leveled up!
            </p>
            
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-muted-foreground">
                  Level {oldLevel}
                </div>
              </div>
              
              <div className="text-3xl text-primary animate-pulse">→</div>
              
              <div className="text-center">
                <div className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Level {newLevel}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Keep up the amazing work on your recovery journey!
            </p>
          </div>
          
          <Button
            onClick={onClose}
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LevelUpDialog;
