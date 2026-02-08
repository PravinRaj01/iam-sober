import * as React from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface TimePickerWheelProps {
  value: string; // "HH:MM" format (24h)
  onChange: (value: string) => void;
  className?: string;
}

function to12Hour(h24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return { hour12, period };
}

function to24Hour(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const { hour12, period } = to12Hour(h);
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

type ClockMode = "hour" | "minute";

export function TimePickerWheel({ value, onChange, className }: TimePickerWheelProps) {
  const [open, setOpen] = React.useState(false);
  const h24 = parseInt(value.split(":")[0], 10);
  const minute = parseInt(value.split(":")[1], 10);
  const { hour12, period } = to12Hour(h24);

  const [selectedHour, setSelectedHour] = React.useState(hour12);
  const [selectedMinute, setSelectedMinute] = React.useState(minute);
  const [selectedPeriod, setSelectedPeriod] = React.useState<"AM" | "PM">(period);
  const [mode, setMode] = React.useState<ClockMode>("hour");

  React.useEffect(() => {
    const newH24 = parseInt(value.split(":")[0], 10);
    const newMin = parseInt(value.split(":")[1], 10);
    const { hour12: h12, period: p } = to12Hour(newH24);
    setSelectedHour(h12);
    setSelectedMinute(newMin);
    setSelectedPeriod(p);
  }, [value]);

  React.useEffect(() => {
    if (open) setMode("hour");
  }, [open]);

  const commitChange = (h12: number, min: number, p: "AM" | "PM") => {
    const h24 = to24Hour(h12, p);
    onChange(`${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  };

  const handleHourClick = (hour: number) => {
    setSelectedHour(hour);
    commitChange(hour, selectedMinute, selectedPeriod);
    // Auto-switch to minute mode after selecting hour
    setTimeout(() => setMode("minute"), 200);
  };

  const handleMinuteClick = (minute: number) => {
    setSelectedMinute(minute);
    commitChange(selectedHour, minute, selectedPeriod);
  };

  const handlePeriodChange = (p: "AM" | "PM") => {
    setSelectedPeriod(p);
    commitChange(selectedHour, selectedMinute, p);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal gap-2", className)}
        >
          <Clock className="h-4 w-4 text-muted-foreground" />
          {formatTime12h(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="bottom">
        <div className="p-4 space-y-4">
          {/* Header: HH : MM  AM/PM */}
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Select Time
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode("hour")}
              className={cn(
                "text-4xl font-bold w-16 h-16 rounded-lg flex items-center justify-center transition-colors",
                mode === "hour"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-foreground hover:bg-muted/80"
              )}
            >
              {String(selectedHour).padStart(2, "0")}
            </button>
            <span className="text-4xl font-bold text-foreground">:</span>
            <button
              onClick={() => setMode("minute")}
              className={cn(
                "text-4xl font-bold w-16 h-16 rounded-lg flex items-center justify-center transition-colors",
                mode === "minute"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-foreground hover:bg-muted/80"
              )}
            >
              {String(selectedMinute).padStart(2, "0")}
            </button>
            <div className="flex flex-col ml-2 gap-0.5">
              <button
                onClick={() => handlePeriodChange("AM")}
                className={cn(
                  "text-xs font-bold px-2.5 py-1 rounded transition-colors",
                  selectedPeriod === "AM"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                AM
              </button>
              <button
                onClick={() => handlePeriodChange("PM")}
                className={cn(
                  "text-xs font-bold px-2.5 py-1 rounded transition-colors",
                  selectedPeriod === "PM"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* Clock Face */}
          <ClockFace
            mode={mode}
            selectedHour={selectedHour}
            selectedMinute={selectedMinute}
            onHourClick={handleHourClick}
            onMinuteClick={handleMinuteClick}
          />

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ClockFaceProps {
  mode: ClockMode;
  selectedHour: number;
  selectedMinute: number;
  onHourClick: (hour: number) => void;
  onMinuteClick: (minute: number) => void;
}

function ClockFace({ mode, selectedHour, selectedMinute, onHourClick, onMinuteClick }: ClockFaceProps) {
  const size = 220;
  const center = size / 2;
  const radius = 85;

  const items = mode === "hour"
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const selectedValue = mode === "hour" ? selectedHour : selectedMinute;
  const selectedIndex = items.indexOf(selectedValue);

  // Calculate angle for each item (12 o'clock = -90deg offset)
  const getPosition = (index: number) => {
    const angle = (index * 360) / items.length - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const selectedPos = selectedIndex >= 0 ? getPosition(selectedIndex) : null;

  return (
    <div
      className="relative rounded-full bg-muted mx-auto"
      style={{ width: size, height: size }}
    >
      {/* Hand line */}
      {selectedPos && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={size}
          height={size}
        >
          <line
            x1={center}
            y1={center}
            x2={selectedPos.x}
            y2={selectedPos.y}
            className="stroke-primary"
            strokeWidth={2}
          />
          <circle cx={center} cy={center} r={3} className="fill-primary" />
        </svg>
      )}

      {/* Number buttons */}
      {items.map((item, i) => {
        const pos = getPosition(i);
        const isSelected = item === selectedValue;
        const displayLabel = mode === "minute" ? String(item).padStart(2, "0") : String(item);

        return (
          <button
            key={item}
            onClick={() => mode === "hour" ? onHourClick(item) : onMinuteClick(item)}
            className={cn(
              "absolute w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors -translate-x-1/2 -translate-y-1/2",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent/30 text-foreground"
            )}
            style={{ left: pos.x, top: pos.y }}
          >
            {displayLabel}
          </button>
        );
      })}
    </div>
  );
}
