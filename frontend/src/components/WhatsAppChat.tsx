import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Paperclip, Mic, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  isLoading?: boolean;
}

export function WhatsAppChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Hello! I can help you log your sustainable farming activities. Send me a text message, record a voice message, or upload an audio file describing your activity.',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [userLanguage, setUserLanguage] = useState<string>('en');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user language preference on mount
  useEffect(() => {
    const fetchUserLanguage = async () => {
      try {
        const response = await apiClient.getProfile();
        if (response.profile?.language) {
          setUserLanguage(response.profile.language);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchUserLanguage();
  }, []);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const handleSend = async (text?: string, audioFile?: File) => {
    const messageToSend = text?.trim() || '';
    if (!messageToSend && !audioFile) return;

    const userMessageText = audioFile 
      ? '🎤 Audio message' 
      : messageToSend;

    // Add user message instantly
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMessageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Clear input
    setInputText('');

    // Add loading bot message
    const loadingMessageId = (Date.now() + 1).toString();
    const loadingMessage: Message = {
      id: loadingMessageId,
      sender: 'bot',
      text: '',
      timestamp: new Date(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, loadingMessage]);

    setLoading(true);

    try {
      // Get location for verification (optional)
      let location: { lat: number; lng: number; accuracy: number } | null = null;
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
          });
          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
        }
      } catch (locError) {
        // Location is optional, continue without it
        console.warn('Location not available:', locError);
      }

      // Call logActivity API to save to database
      const response = await apiClient.logActivity({
        description: messageToSend || undefined,
        audio: audioFile,
        latitude: location?.lat,
        longitude: location?.lng,
        location_accuracy: location?.accuracy,
      });

      // Format success message with credits earned
      const successMessage = `Activity logged successfully! You earned ${response.credits_earned} credits. Total credits: ${response.total_credits}`;

      // Replace loading message with bot response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                id: loadingMessageId,
                sender: 'bot',
                text: successMessage,
                timestamp: new Date(),
              }
            : msg
        )
      );

      toast({
        title: 'Activity logged!',
        description: `You've earned ${response.credits_earned} credits. Total: ${response.total_credits}`,
      });
    } catch (error: any) {
      console.error('Error in handleSend:', error);
      const errorMessage = error?.message || error?.error?.message || 'Failed to process your message. Please try again.';
      
      // Replace loading message with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                id: loadingMessageId,
                sender: 'bot',
                text: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
                timestamp: new Date(),
              }
            : msg
        )
      );

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    handleSend(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!inputText.trim() || loading) return;
      handleSend(inputText);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate audio file type
      const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/webm'];
      if (!audioTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an audio file (MP3, WAV, M4A, or WEBM).',
          variant: 'destructive',
        });
        return;
      }

      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload an audio file smaller than 10MB.',
          variant: 'destructive',
        });
        return;
      }

      handleSend(undefined, file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTimestamp = (date: Date) => {
    return format(date, 'HH:mm');
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVoiceRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingTime(0);
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          toast({
            title: 'Recording failed',
            description: 'No audio was captured. Please try again.',
            variant: 'destructive',
          });
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (audioBlob.size < 10000) {
          toast({
            title: 'Recording too short',
            description: 'Please record for at least 3-5 seconds.',
            variant: 'destructive',
          });
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }

        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, {
          type: 'audio/webm'
        });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Send the audio file
        await handleSend(undefined, audioFile);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      toast({
        title: 'Microphone access denied',
        description: error.message || 'Please allow microphone access to record audio.',
        variant: 'destructive',
      });
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                message.sender === 'user'
                  ? 'bg-[#DCF8C6] text-[#000000] rounded-br-none'
                  : 'bg-white text-[#000000] rounded-bl-none'
              }`}
            >
              {message.isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing...</span>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.sender === 'user'
                        ? 'text-[#000000]/60'
                        : 'text-[#000000]/60'
                    }`}
                  >
                    {formatTimestamp(message.timestamp)}
                  </p>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#E0E0E0] bg-[#F0F0F0]">
        {isRecording ? (
          /* Recording UI - WhatsApp style */
          <div className="p-3 flex items-center justify-between bg-[#F0F0F0]">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-[#075E54] flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-[#075E54] rounded-full animate-pulse"
                        style={{
                          height: `${8 + Math.random() * 12}px`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-[#075E54] font-medium">
                    {formatRecordingTime(recordingTime)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recording...</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={cancelRecording}
                className="text-red-600 hover:bg-red-50"
                title="Cancel"
              >
                <X className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                onClick={handleVoiceRecording}
                className="bg-[#075E54] text-white hover:bg-[#064E44] rounded-full w-12 h-12"
                title="Send"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : (
          /* Normal Input UI */
          <form onSubmit={handleTextSubmit} className="flex gap-2 p-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload audio file"
              className="text-[#075E54] hover:bg-[#075E54]/10"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <Input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 bg-white border-[#E0E0E0]"
            />
            {inputText.trim() ? (
              <Button type="submit" size="icon" disabled={loading} className="bg-[#075E54] text-white hover:bg-[#064E44]">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleVoiceRecording}
                size="icon"
                disabled={loading}
                className="bg-[#075E54] text-white hover:bg-[#064E44] rounded-full"
                title="Record voice message"
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

