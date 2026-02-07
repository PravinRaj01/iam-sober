import { useState, useEffect, useRef } from "react";
import { GuidedMeditations } from "@/components/coping/GuidedMeditations";
import { PersonalizedStrategies } from "@/components/coping/PersonalizedStrategies";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Wind, Footprints, Phone, Music, Book, Play, StopCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";

const CopingTools = () => {
  const { t } = useLanguage();
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "hold1" | "exhale" | "hold2">("inhale");
  const [breathingLevel, setBreathingLevel] = useState(4);
  const [sessionDuration, setSessionDuration] = useState(5);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [indicatorPosition, setIndicatorPosition] = useState({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const phaseStartTimeRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(false);

  const tools = [
    { title: t("coping.breathing"), description: t("coping.breathingDesc"), icon: Wind, color: "bg-primary" },
    { title: t("coping.walk"), description: t("coping.walkDesc"), icon: Footprints, color: "bg-success" },
    { title: t("coping.call"), description: t("coping.callDesc"), icon: Phone, color: "bg-accent" },
    { title: t("coping.music"), description: t("coping.musicDesc"), icon: Music, color: "bg-warning" },
    { title: t("coping.read"), description: t("coping.readDesc"), icon: Book, color: "bg-purple-500" },
  ];

  const affirmations = [
    t("coping.affirmation1"),
    t("coping.affirmation2"),
    t("coping.affirmation3"),
    t("coping.affirmation4"),
    t("coping.affirmation5"),
    t("coping.affirmation6"),
  ];

  const totalCycles = Math.max(1, Math.floor((sessionDuration * 60) / (breathingLevel * 4)));
  const phaseDuration = breathingLevel * 1000;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (breathingActive) {
      interval = setInterval(() => {
        setElapsedTime((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [breathingActive]);

  const startBreathing = () => {
    setBreathingActive(true);
    isActiveRef.current = true;
    setCurrentCycle(1);
    setElapsedTime(0);
    setBreathingPhase("inhale");
    setIndicatorPosition({ x: 0, y: 0 });
    // Delay start to ensure initial render
    requestAnimationFrame(() => {
      phaseStartTimeRef.current = Date.now();
      runBreathingCycle();
    });
  };

  const stopBreathing = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    isActiveRef.current = false;
    setBreathingActive(false);
    setElapsedTime(0);
    setCurrentCycle(1);
    setIndicatorPosition({ x: 0, y: 0 });
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "inhale": return "hsl(var(--primary))";
      case "hold1": return "hsl(var(--accent))";
      case "exhale": return "hsl(var(--success))";
      case "hold2": return "hsl(var(--warning))";
      default: return "hsl(var(--primary))";
    }
  };

  const runBreathingCycle = () => {
    const phases: Array<"inhale" | "hold1" | "exhale" | "hold2"> = ["inhale", "hold1", "exhale", "hold2"];
    let phaseIndex = 0;
    let cycleCount = 1;

    const animateIndicator = () => {
      if (!isActiveRef.current) return;

      const now = Date.now();
      const elapsed = now - phaseStartTimeRef.current;
      const progress = Math.min(elapsed / phaseDuration, 1);

      // Calculate smooth position along box edges
      let x = 0, y = 0;
      const currentPhase = phases[phaseIndex];
      
      switch (currentPhase) {
        case "inhale": // Top edge, left to right
          x = progress * 100;
          y = 0;
          break;
        case "hold1": // Right edge, top to bottom
          x = 100;
          y = progress * 100;
          break;
        case "exhale": // Bottom edge, right to left
          x = 100 - (progress * 100);
          y = 100;
          break;
        case "hold2": // Left edge, bottom to top
          x = 0;
          y = 100 - (progress * 100);
          break;
      }

      setIndicatorPosition({ x, y });

      // Check if phase is complete
      if (progress >= 1) {
        phaseIndex = (phaseIndex + 1) % phases.length;
        if (phaseIndex === 0) {
          cycleCount += 1;
          setCurrentCycle(cycleCount);
          if (cycleCount > totalCycles) {
            stopBreathing();
            return;
          }
        }
        setBreathingPhase(phases[phaseIndex]);
        phaseStartTimeRef.current = Date.now();
      }

      animationFrameRef.current = requestAnimationFrame(animateIndicator);
    };

    animationFrameRef.current = requestAnimationFrame(animateIndicator);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-calm">
      <PageHeader title={t("coping.title")} />

      <main className="container mx-auto px-4 py-8 max-w-6xl animate-fade-in space-y-6">
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold mb-2">{t("coping.fullTitle")}</h1>
          <p className="text-muted-foreground">{t("coping.subtitle")}</p>
        </div>

        {/* Box Breathing Exercise */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="h-5 w-5" />
              {t("coping.boxBreathing")}
            </CardTitle>
            <CardDescription>{t("coping.boxBreathingDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {!breathingActive ? (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Breathing Level (seconds per phase)</label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => setBreathingLevel(Math.max(3, breathingLevel - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex-1 text-center font-bold text-2xl">{breathingLevel}s</div>
                      <Button variant="outline" size="icon" onClick={() => setBreathingLevel(Math.min(8, breathingLevel + 1))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Session Duration</label>
                    <Select value={sessionDuration.toString()} onValueChange={(v) => setSessionDuration(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 minute</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button onClick={startBreathing} size="lg" className="w-full bg-gradient-primary">
                  <Play className="h-5 w-5 mr-2" />
                  Start Breathing Exercise
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative aspect-square max-w-md mx-auto bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-12 backdrop-blur-sm">
                  {/* Box border */}
                  <div className="absolute inset-12 border-4 rounded-2xl transition-colors duration-300"
                       style={{ borderColor: getPhaseColor(breathingPhase) }}>
                    {/* Animated indicator */}
                    <div 
                      className="absolute w-6 h-6 rounded-full shadow-2xl"
                      style={{
                        left: `${indicatorPosition.x}%`,
                        top: `${indicatorPosition.y}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: getPhaseColor(breathingPhase),
                        boxShadow: `0 0 20px ${getPhaseColor(breathingPhase)}, 0 0 40px ${getPhaseColor(breathingPhase)}40`,
                        transition: 'background-color 0.3s ease'
                      }}
                    >
                      <div className="absolute inset-0 rounded-full animate-ping opacity-50"
                           style={{ backgroundColor: getPhaseColor(breathingPhase) }} />
                    </div>
                  </div>
                  
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-5xl font-bold capitalize mb-3 transition-colors duration-300"
                       style={{ color: getPhaseColor(breathingPhase) }}>
                      {breathingPhase === "hold1" || breathingPhase === "hold2" ? "Hold" : breathingPhase}
                    </p>
                    <p className="text-muted-foreground text-lg">Cycle {currentCycle}/{totalCycles}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Elapsed Time</p>
                    <p className="text-2xl font-bold">{formatTime(elapsedTime)}</p>
                  </div>
                  <Button onClick={stopBreathing} variant="destructive" size="lg">
                    <StopCircle className="h-5 w-5 mr-2 fill-current" />
                    Stop
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coping Tools Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.slice(1).map((tool) => (
            <Card key={tool.title} className="bg-card/50 backdrop-blur-lg border-border/50 hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className={`w-12 h-12 rounded-full ${tool.color} flex items-center justify-center mb-2`}>
                  <tool.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">{tool.title}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Guided Meditations */}
        <GuidedMeditations />

        {/* AI Coping Strategies */}
        <PersonalizedStrategies />

        {/* Daily Affirmations */}
        <Card className="bg-gradient-primary text-primary-foreground">
          <CardHeader>
            <CardTitle>{t("coping.dailyAffirmations")}</CardTitle>
            <CardDescription className="text-primary-foreground/80">{t("coping.affirmationsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {affirmations.map((affirmation, idx) => (
                <div key={idx} className="p-3 bg-white/10 backdrop-blur-sm rounded-lg">
                  <p className="text-sm font-medium">{affirmation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CopingTools;
