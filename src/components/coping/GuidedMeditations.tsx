import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayCircle, PauseCircle, Heart, Loader2, Info, Play, Pause, RotateCcw, Forward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Meditation {
  id: string;
  title: string;
  duration: number;
  description: string;
  audioUrl: string;
  category: string;
}

const meditations: Meditation[] = [
  {
    id: "1",
    title: "Mindful Urge Surfing",
    duration: 300,
    description: "Learn to observe and let go of cravings without acting on them.",
    audioUrl: "/meditations/urge-surfing.mp3",
    category: "Cravings",
  },
  {
    id: "2",
    title: "Body Scan Relaxation",
    duration: 600,
    description: "Release tension and find calm through progressive relaxation.",
    audioUrl: "/meditations/body-scan.mp3",
    category: "Relaxation",
  },
  {
    id: "3",
    title: "Self-Compassion Practice",
    duration: 480,
    description: "Cultivate kindness towards yourself in moments of difficulty.",
    audioUrl: "/meditations/self-compassion.mp3",
    category: "Emotional Support",
  },
];

export function GuidedMeditations() {
  const [currentMeditation, setCurrentMeditation] = useState<Meditation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [meditationScript, setMeditationScript] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { toast } = useToast();
  const isStoppingRef = useRef(false);
  const pausedTimeRef = useRef(0);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      isStoppingRef.current = true;
      window.speechSynthesis.cancel();
    };
  }, []);

  const stopPlayback = (isManualStop = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsSpeaking(false);
    setIsPlaying(false);
    setIsPaused(false);
    pausedTimeRef.current = 0;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      isStoppingRef.current = isManualStop;
      window.speechSynthesis.cancel();
    }
  };

  const togglePauseResume = () => {
    if (!currentMeditation || !meditationScript) return;

    if (isSpeaking) {
      // Pause the playback
      window.speechSynthesis.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      pausedTimeRef.current = elapsedTime;
      setIsSpeaking(false);
      setIsPaused(true);
    } else if (isPaused) {
      // Resume the playback
      window.speechSynthesis.resume();
      timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
      setIsSpeaking(true);
      setIsPaused(false);
    }
  };

  const handleSelectMeditation = async (meditation: Meditation) => {
    if (currentMeditation?.id === meditation.id) {
      // Toggle play/pause if the same meditation is clicked again
      togglePauseResume();
      return;
    }

    stopPlayback(true);
    setCurrentMeditation(meditation);
    setElapsedTime(0);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-meditation', {
        body: {
          title: meditation.title,
          description: meditation.description,
          duration: meditation.duration,
        },
      });

      if (error) throw error;

      setMeditationScript(data.script);
      setIsPlaying(true);
      speakMeditation(data.script);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to generate meditation. Please try again.",
        variant: "destructive",
      });
      setCurrentMeditation(null);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanScriptForDisplay = (script: string): string => {
    return script
      .replace(/\*\*(.*?)\*\*/g, '')
      .replace(/\((.*?)\)/g, '')
      .replace(/\[pause\]/gi, '\n\n')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  };

  const speakMeditation = (script: string) => {
    isStoppingRef.current = false;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedTime(0);

    const cleanScript = script
      .replace(/\*\*(.*?)\*\*/g, '')
      .replace(/\((.*?)\)/g, '')
      .replace(/\[pause\]/gi, '... ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanScript);
    utteranceRef.current = utterance;

    // Enhanced voice selection with more options
    const femaleVoice = 
      // Windows voices
      voices.find(v => v.lang.startsWith('en') && v.name.includes('Zira')) ||
      voices.find(v => v.lang.startsWith('en') && v.name.includes('Eva')) ||
      // macOS/iOS voices
      voices.find(v => v.lang.startsWith('en') && v.name.includes('Samantha')) ||
      voices.find(v => v.lang.startsWith('en') && v.name.includes('Victoria')) ||
      voices.find(v => v.lang.startsWith('en') && v.name.includes('Karen')) ||
      // Google voices
      voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
      // Edge neural voices
      voices.find(v => v.lang.startsWith('en') && (v.name.includes('Aria') || v.name.includes('Jenny'))) ||
      // Fallback to any English voice
      voices.find(v => v.lang.startsWith('en'));
    
    if (femaleVoice) utterance.voice = femaleVoice;

    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    };

    utterance.onend = () => {
      if (!isStoppingRef.current) {
        setElapsedTime(currentMeditation?.duration || 0);
      }
      stopPlayback();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        toast({
          title: "Audio Error",
          description: "Failed to play audio. Your browser might not support it.",
          variant: "destructive",
        });
        stopPlayback();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentMeditation) return;
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = Math.floor(percentage * currentMeditation.duration);
    
    setElapsedTime(newTime);
    toast({ 
      title: "Seeking is not fully supported for AI-generated audio.", 
      description: "Playback will continue from its current position." 
    });
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-lg border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-accent" />
            Guided Meditations
          </CardTitle>
          <CardDescription>
            Practice mindfulness to manage cravings and emotions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {meditations.map((meditation) => (
                <Card
                  key={meditation.id}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300 cursor-pointer",
                    currentMeditation?.id === meditation.id
                      ? "bg-accent/10 border-accent"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => handleSelectMeditation(meditation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{meditation.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {meditation.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="bg-accent/10 text-accent px-2 py-1 rounded">
                            {meditation.category}
                          </span>
                          <span className="text-muted-foreground">
                            {Math.floor(meditation.duration / 60)} min
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center h-10 w-10">
                        {isLoading && currentMeditation?.id === meditation.id ? (
                          <Loader2 className="h-6 w-6 animate-spin text-accent" />
                        ) : currentMeditation?.id === meditation.id && isPlaying ? (
                          isSpeaking ? (
                            <PauseCircle className="h-6 w-6 text-accent" />
                          ) : isPaused ? (
                            <PlayCircle className="h-6 w-6 text-accent" />
                          ) : (
                            <PlayCircle className="h-6 w-6 text-accent" />
                          )
                        ) : (
                          <PlayCircle className="h-6 w-6 text-muted-foreground group-hover:text-primary/70" />
                        )}
                      </div>
                    </div>
                    {currentMeditation?.id === meditation.id && (
                      <div className="mt-4 space-y-3 animate-fade-in">
                        <div className="space-y-2">
                          <Progress 
                            value={(elapsedTime / (currentMeditation.duration || 1)) * 100} 
                            className="h-2 cursor-pointer" 
                            onClick={handleSeek} 
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatDuration(elapsedTime)}</span>
                            <span>{formatDuration(currentMeditation.duration)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setShowScriptDialog(true); 
                            }}
                          >
                            <Info className="h-4 w-4 mr-2" />
                            View Script
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{currentMeditation?.title}</DialogTitle>
            <DialogDescription>
              Read the meditation script below.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] mt-4 bg-muted/30 rounded-lg p-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {cleanScriptForDisplay(meditationScript)}
            </p>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}