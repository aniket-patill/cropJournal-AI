import { WhatsAppChat } from "@/components/WhatsAppChat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WhatsAppDemo() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">WhatsApp Demo</h1>
        <p className="text-muted-foreground mt-1">Test the AI processing pipeline with text or audio messages</p>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Chat Interface</CardTitle>
          <CardDescription>Send text or audio messages to test transcription and NLP extraction</CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsAppChat />
        </CardContent>
      </Card>
    </div>
  );
}

