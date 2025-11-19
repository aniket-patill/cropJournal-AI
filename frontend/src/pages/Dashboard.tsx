import { useEffect, useState, useRef } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, TrendingUp, Calendar, Mic, MessageCircle, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from "@/hooks/use-toast";

interface Activity {
  id: string;
  description: string;
  crop_name: string | null;
  activity_type: string;
  credits_earned: number;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuthContext();
  const [credits, setCredits] = useState<number>(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState({ activities: 0, credits: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [dashboardData, creditsData] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getCredits(),
      ]);

      setCredits(creditsData.credits);
      setActivities(dashboardData.recent_activities || []);
      setWeeklyStats(dashboardData.weekly_stats);
      generateChartData(dashboardData.recent_activities || []);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load dashboard data",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const generateChartData = (activities: Activity[]) => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const dataByDate = last7Days.map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      credits: 0,
    }));

    activities.forEach(activity => {
      const activityDate = new Date(activity.created_at).toISOString().split('T')[0];
      const index = last7Days.indexOf(activityDate);
      if (index !== -1) {
        dataByDate[index].credits += activity.credits_earned;
      }
    });

    setChartData(dataByDate);
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
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

  const handleVoiceInput = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        // Request final data chunk before stopping
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        // Don't stop tracks immediately - let onstop handler clean up
        // This ensures all chunks are collected
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
        setLocationError(null);
      } catch (locError: any) {
        console.warn('Location error:', locError);
        setLocationError(locError.message);
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
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        // Check if we have any audio chunks
        if (audioChunksRef.current.length === 0) {
          toast({
            title: "Recording failed",
            description: "No audio was captured. Please try again and speak clearly.",
            variant: "destructive",
          });
          // Clean up stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          setIsProcessing(false);
          return;
        }

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Validate blob size (minimum ~10KB for a very short recording)
        if (audioBlob.size < 10000) {
          toast({
            title: "Recording too short",
            description: "Please record for at least 3-5 seconds. Try again and speak clearly.",
            variant: "destructive",
          });
          // Clean up stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          setIsProcessing(false);
          return;
        }
        
        // Convert blob to File
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, {
          type: 'audio/webm'
        });

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Upload and process with location
        await uploadAndProcessAudio(audioFile);
      };

      // Start recording with timeslice to ensure chunks are collected periodically
      // timeslice: 1000ms means we get chunks every second
      mediaRecorder.start(1000);
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: location ? "Speak your farming activity... Click again to stop." : "Recording (location unavailable). Click again to stop.",
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

  const uploadAndProcessAudio = async (audioFile: File) => {
    if (!user) return;

    setIsProcessing(true);

    try {
      // Prepare form data with location if available
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      if (location) {
        formData.append('latitude', location.lat.toString());
        formData.append('longitude', location.lng.toString());
        formData.append('location_accuracy', location.accuracy.toString());
      }

      const response = await apiClient.logActivity({
        audio: audioFile,
        activity_type: 'other', // Default, NLP will extract the correct type
        latitude: location?.lat,
        longitude: location?.lng,
        location_accuracy: location?.accuracy,
      });

      toast({
        title: "Activity logged!",
        description: `You've earned ${response.credits_earned} credits. Total: ${response.total_credits}`,
      });

      // Refresh dashboard data
      await fetchDashboardData();
      
      // Reset location for next recording
      setLocation(null);
    } catch (error: any) {
      console.error('Error processing audio:', error);
      toast({
        title: "Error processing audio",
        description: error.message || "Failed to process your recording. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      audioChunksRef.current = [];
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

  const handleWhatsAppClick = () => {
    const phoneNumber = "1234567890"; // Replace with actual WhatsApp bot number
    const message = "Hello! I need help with sustainable farming.";
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your sustainability journey</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleVoiceInput}
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            className="h-12 w-12"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Mic className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`} />
            )}
          </Button>
          <Button
            onClick={handleWhatsAppClick}
            variant="outline"
            size="icon"
            className="h-12 w-12"
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="card-shadow hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <Coins className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold text-primary">{credits}</div>
            <p className="text-xs text-muted-foreground mt-1">Available for redemption</p>
          </CardContent>
        </Card>

        <Card className="card-shadow hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold">{weeklyStats.activities}</div>
            <p className="text-xs text-muted-foreground mt-1">Activities logged</p>
          </CardContent>
        </Card>

        <Card className="card-shadow hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits Earned</CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold text-success">{weeklyStats.credits}</div>
            <p className="text-xs text-muted-foreground mt-1">This week</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Credits Over Time</CardTitle>
          <CardDescription>Your progress in the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="credits"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest sustainability actions</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No activities yet. Start logging your sustainable farming practices!
            </p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.crop_name && `${activity.crop_name} • `}
                      {new Date(activity.created_at).toLocaleDateString()}
                    </p>
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
