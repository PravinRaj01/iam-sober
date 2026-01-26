import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Loader2, Plus, Pencil, Trash2, Search, Sparkles, Edit2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import SentimentBadge from "@/components/journal/SentimentBadge";
import TriggerDetector from "@/components/journal/TriggerDetector";
import StorageImage from "@/components/StorageImage";
import { PageHeader } from "@/components/layout/PageHeader";

const Journal = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzingEntryId, setAnalyzingEntryId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile-addiction-journal"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("addiction_type")
        .eq("id", user.id)
        .single();

      if (error) return null;
      return data;
    },
  });

  const { data: entries, refetch } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Real-time subscription for entries added via chatbot
  useEffect(() => {
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('journal-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'journal_entries',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            refetch();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupSubscription();
  }, [refetch]);

  const filteredEntries = entries?.filter(
    (entry) =>
      entry.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingId) {
        const { error } = await supabase
          .from("journal_entries")
          .update({
            title: title.trim() || null,
            content: content.trim(),
          })
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Entry updated!",
          description: "Your journal entry has been updated.",
        });
      } else {
        const { error } = await supabase.from("journal_entries").insert({
          user_id: user.id,
          title: title.trim() || null,
          content: content.trim(),
        });

        if (error) throw error;

        toast({
          title: "Entry saved!",
          description: "Your journal entry has been saved.",
        });
      }

      setTitle("");
      setContent("");
      setEditingId(null);
      setDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: any) => {
    setEditingId(entry.id);
    setTitle(entry.title || "");
    setContent(entry.content);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("journal_entries").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Entry deleted",
        description: "Your journal entry has been removed.",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAnalyzeSentiment = async (entryId: string) => {
    setAnalyzingEntryId(entryId);
    
    try {
      const entry = entries?.find(e => e.id === entryId);
      if (!entry) return;

      const { data, error } = await supabase.functions.invoke("analyze-journal-sentiment", {
        body: { text: entry.content, entryId },
      });

      if (error) {
        console.error("Sentiment analysis error:", error);
        
        // Provide specific error messages
        if (error.message?.includes("429")) {
          throw new Error("Rate limit reached. Please try again in a minute.");
        } else if (error.message?.includes("402")) {
          throw new Error("AI credits depleted. Please add credits in Settings.");
        }
        
        throw error;
      }

      toast({
        title: "Sentiment analyzed",
        description: `This entry has a ${data.sentiment.label} tone`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message || "Unable to analyze sentiment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzingEntryId(null);
    }
  };

  return (
    <div className="flex-1 bg-gradient-calm min-h-screen">
      <PageHeader 
        title="Journal" 
        actions={
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingId(null);
                setTitle("");
                setContent("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Entry</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-popover/95 backdrop-blur-xl border-border/50">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Journal Entry" : "New Journal Entry"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input
                    id="title"
                    placeholder="Entry title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Your thoughts</Label>
                  <Textarea
                    id="content"
                    placeholder="Write freely about your day, feelings, challenges, or wins..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    required
                    disabled={loading}
                  />
                  {content.length > 50 && (
                    <TriggerDetector content={content} addictionType={profile?.addiction_type || null} />
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingId ? "Updating..." : "Saving..."}
                    </>
                  ) : (
                    editingId ? "Update Entry" : "Save Entry"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <main className="container mx-auto px-4 py-8 max-w-4xl animate-fade-in">
        {entries && entries.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card/50 backdrop-blur-sm"
              />
            </div>
          </div>
        )}

        {!entries || entries.length === 0 ? (
          <Card className="text-center py-16 bg-card/50 backdrop-blur-lg overflow-hidden border-border/40 shadow-xl transition-all duration-300 hover:shadow-2xl hover:bg-card/60 animate-fade-up">
            <div className="mb-6">
              <StorageImage
                bucket="illustrations"
                path="8.png"
                alt="Start your recovery journal"
                className="mx-auto h-48 w-auto rounded-lg opacity-90 drop-shadow-lg transition-all duration-300 hover:opacity-100 hover:scale-105"
              />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-3 bg-gradient-primary bg-clip-text text-transparent">Your Recovery Journal Awaits</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Writing about your journey helps process emotions and track your progress. Our AI-powered sentiment analysis can help you understand your emotional patterns.
              </p>
              
              {/* Sample Entry Preview */}
              <div className="bg-muted/30 rounded-lg p-4 mb-6 text-left border border-border/30">
                <div className="flex items-start gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Sample Entry: Day 7</p>
                    <p className="text-sm text-muted-foreground italic">
                      "Today was challenging but I stayed strong. I almost gave in to the urge but called my support group instead. 
                      I'm learning that it's okay to ask for help. Every day is a victory, no matter how small it feels."
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => setDialogOpen(true)} 
                className="bg-gradient-primary"
                size="lg"
              >
                <Edit2 className="h-5 w-5 mr-2" />
                Write Your First Entry
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEntries?.map((entry) => (
              <Card key={entry.id} className="hover:shadow-soft transition-shadow bg-card/50 backdrop-blur-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-xl">
                          {entry.title || "Untitled Entry"}
                        </CardTitle>
                        <SentimentBadge 
                          sentiment={(entry as any).sentiment?.label}
                          isAnalyzing={analyzingEntryId === entry.id}
                        />
                      </div>
                      <CardDescription>
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {!(entry as any).sentiment && analyzingEntryId !== entry.id && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleAnalyzeSentiment(entry.id)}
                          title="Analyze sentiment"
                        >
                          <Sparkles className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-popover/95 backdrop-blur-xl border-border/50">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This entry will be permanently deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(entry.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground whitespace-pre-wrap">{entry.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Journal;
