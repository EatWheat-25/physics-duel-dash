import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";

type Subject = {
  id: string;
  name: string;
  levels: string[];
};

const SUBJECTS: Subject[] = [
  { id: "math", name: "Mathematics", levels: ["A1", "A2", "A1+A2"] },
  { id: "physics", name: "Physics", levels: ["A1", "A2", "A1+A2"] },
  { id: "chemistry", name: "Chemistry", levels: ["A1", "A2", "A1+A2"] },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<
    { subject: string; level: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.onboarding_completed) {
      navigate("/");
    }
  };

  const handleSubjectToggle = (subject: string, level: string) => {
    const exists = selectedSubjects.find(
      (s) => s.subject === subject && s.level === level
    );

    if (exists) {
      setSelectedSubjects(
        selectedSubjects.filter(
          (s) => !(s.subject === subject && s.level === level)
        )
      );
    } else {
      setSelectedSubjects([...selectedSubjects, { subject, level }]);
    }
  };

  const handleSubmit = async () => {
    if (step === 1) {
      if (!username.trim()) {
        toast({
          title: "Username required",
          description: "Please enter a username",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!age || parseInt(age) < 1) {
        toast({
          title: "Age required",
          description: "Please enter your age",
          variant: "destructive",
        });
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (selectedSubjects.length === 0) {
        toast({
          title: "Select subjects",
          description: "Please select at least one subject",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from("profiles").upsert({
          id: user.id,
          username: username.trim(),
          age: parseInt(age),
          subjects: selectedSubjects,
          onboarding_completed: true,
        }, {
          onConflict: "id", ignoreDuplicates: false
        });

        if (error) throw error;

        // Refresh profile to load the saved data
        await refreshProfile();

        toast({
          title: "Welcome!",
          description: "Your profile has been created",
        });
        navigate("/");
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="w-full max-w-lg p-8 space-y-6 bg-card rounded-xl border shadow-lg">
        <div className="space-y-2">
          <div className="flex gap-2 mb-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <h2 className="text-2xl font-bold">
            {step === 1 && "Choose your username"}
            {step === 2 && "How old are you?"}
            {step === 3 && "Select your subjects"}
          </h2>
          <p className="text-muted-foreground">
            {step === 1 && "Pick a unique username for your profile"}
            {step === 2 && "Let us know your age"}
            {step === 3 && "Choose the subjects you want to study"}
          </p>
        </div>

        <div className="space-y-4">
          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="Enter your age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min="1"
                max="120"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {SUBJECTS.map((subject) => (
                <div key={subject.id} className="space-y-3 p-4 border rounded-lg">
                  <h3 className="font-semibold">{subject.name}</h3>
                  <div className="space-y-2">
                    {subject.levels.map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${subject.id}-${level}`}
                          checked={selectedSubjects.some(
                            (s) => s.subject === subject.id && s.level === level
                          )}
                          onCheckedChange={() =>
                            handleSubjectToggle(subject.id, level)
                          }
                        />
                        <Label
                          htmlFor={`${subject.id}-${level}`}
                          className="cursor-pointer"
                        >
                          {level}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Loading..." : step === 3 ? "Complete" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
