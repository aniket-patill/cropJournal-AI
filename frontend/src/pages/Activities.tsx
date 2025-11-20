import { useEffect, useState, useRef } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Coins, Filter, Mic, Loader2, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface Activity {
  id: string;
  description: string;
  crop_name: string | null;
  activity_type: string;
  credits_earned: number;
  created_at: string;
}

const activityTypeLabels: Record<string, string> = {
  organic_input: "Organic Input",
  water_conservation: "Water Conservation",
  soil_health: "Soil Health",
  pest_management: "Pest Management",
  crop_rotation: "Crop Rotation",
  other: "Other",
};

export default function Activities() {
  const { user } = useAuthContext();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [formData, setFormData] = useState({
    description: "",
    crop_name: "",
    activity_type: "organic_input",
    credits_earned: 10,
  });
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [userLanguage, setUserLanguage] = useState<string>("en");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user) {
      fetchActivities();
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const response = await apiClient.getProfile();
      if (response.profile?.language) {
        setUserLanguage(response.profile.language);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    if (filterType === "all") {
      setFilteredActivities(activities);
    } else {
      setFilteredActivities(activities.filter(a => a.activity_type === filterType));
    }
  }, [filterType, activities]);

  const fetchActivities = async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getActivities();
      setActivities(response.activities || []);
      setFilteredActivities(response.activities || []);
    } catch (error: any) {
      console.error('Error fetching activities:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load activities",
        variant: "destructive",
      });
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleVoiceRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    // Start recording
    try {
      // Request location permission first
      try {
        const loc = await getCurrentLocation();
        setLocation(loc);
      } catch (locError: any) {
        console.warn('Location error:', locError);
        toast({
          title: "Location not available",
          description: "Recording without location. Some verification checks may be skipped.",
          variant: "default",
        });
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert blob to File
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, {
          type: 'audio/webm'
        });

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Process the recording
        await processRecordedAudio(audioFile);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: "Speak your farming activity... Click the button again to stop.",
      });
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone access denied",
        description: error.message || "Please allow microphone access to record audio.",
        variant: "destructive",
      });
    }
  };

  const processRecordedAudio = async (audioFile: File) => {
    if (!user) return;

    setProcessing(true);

    try {
      const response = await apiClient.logActivity({
        audio: audioFile,
        activity_type: formData.activity_type,
        crop: formData.crop_name || undefined,
        latitude: location?.lat,
        longitude: location?.lng,
        location_accuracy: location?.accuracy,
      });

      toast({
        title: "Activity logged!",
        description: `You've earned ${response.credits_earned} credits. Total: ${response.total_credits}`,
      });

      fetchActivities();
      setDialogOpen(false);
      setFormData({
        description: "",
        crop_name: "",
        activity_type: "organic_input",
        credits_earned: 10,
      });
      setLocation(null);
    } catch (error: any) {
      console.error('Error processing audio:', error);
      toast({
        title: "Error processing audio",
        description: error.message || "Failed to process your recording. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      audioChunksRef.current = [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validate: require either description OR we should have recorded audio
    // Since we're voice-first, description is optional
    if (!formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please record your voice or provide a description",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProcessing(true);
    
    try {
      // Get location if not already captured
      let currentLocation = location;
      if (!currentLocation) {
        try {
          currentLocation = await getCurrentLocation();
          setLocation(currentLocation);
        } catch (locError: any) {
          console.warn('Location error:', locError);
          // Continue without location
        }
      }

      const response = await apiClient.logActivity({
        description: formData.description,
        crop: formData.crop_name || undefined,
        area: undefined,
        activity_type: formData.activity_type,
        latitude: currentLocation?.lat,
        longitude: currentLocation?.lng,
        location_accuracy: currentLocation?.accuracy,
      });

      toast({
        title: "Activity logged!",
        description: `You've earned ${response.credits_earned} credits`,
      });
      
      fetchActivities();
      setDialogOpen(false);
      setFormData({
        description: "",
        crop_name: "",
        activity_type: "organic_input",
        credits_earned: 10,
      });
      setLocation(null);
    } catch (error: any) {
      console.error('Error logging activity:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to log activity",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Activity Log</h1>
          <p className="text-muted-foreground mt-1">Track all your sustainable farming practices</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Log Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Log New Activity</DialogTitle>
                <DialogDescription>
                  Record your sustainable farming practice using voice. Speak naturally and the system will transcribe and extract the details automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Voice Recording Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Voice Recording (Recommended)</Label>
                    <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1">
                      <Globe className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        {userLanguage === "kn" ? "ಕನ್ನಡ" : userLanguage === "mr" ? "मराठी" : "English"}
                      </span>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      onClick={handleVoiceRecording}
                      variant={isRecording ? "destructive" : "outline"}
                      size="lg"
                      className="flex-1"
                      disabled={processing}
                      title={`Record in ${userLanguage === "kn" ? "Kannada" : userLanguage === "mr" ? "Marathi" : "English"}`}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : isRecording ? (
                        <>
                          <Mic className={`h-5 w-5 mr-2 ${isRecording ? 'animate-pulse' : ''}`} />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="h-5 w-5 mr-2" />
                          Start Recording
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isRecording 
                      ? `Recording in ${userLanguage === "kn" ? "Kannada (ಕನ್ನಡ)" : userLanguage === "mr" ? "Marathi (मराठी)" : "English"}... Speak your farming activity clearly. Click again to stop.`
                      : "Click to record your voice. The system will automatically transcribe and extract activity details."}
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or type manually</span>
                  </div>
                </div>

                {/* Description Field - Optional when voice is recorded */}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description {isRecording || processing ? "(Optional - voice recording in progress)" : "(Optional if recording voice)"}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what you did... (e.g., 'Applied organic compost to 2 acres of rice fields')"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    disabled={isRecording || processing}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isRecording || processing 
                      ? "Voice recording will be used. You can add additional context here if needed."
                      : "If you record voice, this field is optional. Otherwise, provide a description of your activity."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crop_name">Crop Name (Optional)</Label>
                    <Input
                      id="crop_name"
                      placeholder="e.g., Tomatoes, Rice"
                      value={formData.crop_name}
                      onChange={(e) => setFormData({ ...formData, crop_name: e.target.value })}
                      disabled={isRecording || processing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activity_type">Activity Type</Label>
                    <Select
                      value={formData.activity_type}
                      onValueChange={(value) => setFormData({ ...formData, activity_type: value })}
                      disabled={isRecording || processing}
                    >
                      <SelectTrigger id="activity_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {Object.entries(activityTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {processing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing audio, transcribing, and extracting information...</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false);
                  setFormData({
                    description: "",
                    crop_name: "",
                    activity_type: "organic_input",
                    credits_earned: 10,
                  });
                  setLocation(null);
                  if (isRecording) {
                    handleVoiceRecording(); // Stop recording if active
                  }
                }}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading || processing || isRecording || (!formData.description.trim() && !isRecording && !processing)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Logging...
                    </>
                  ) : (
                    "Log Activity"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Activities</CardTitle>
              <CardDescription>Your complete activity history</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  {Object.entries(activityTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredActivities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No activities yet. Start logging your sustainable farming practices!
            </p>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <p className="font-medium">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {activity.crop_name && (
                        <Badge variant="secondary">{activity.crop_name}</Badge>
                      )}
                      <Badge variant="outline">
                        {activityTypeLabels[activity.activity_type] || activity.activity_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-success font-semibold">
                    <Coins className="h-4 w-4" />
                    +{activity.credits_earned}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
