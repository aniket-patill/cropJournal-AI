import { useAuthContext } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sprout, Leaf, Award, TrendingUp } from "lucide-react";
import heroImage from "@/assets/hero-farm.jpg";

const Index = () => {
  const { user } = useAuthContext();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-primary">CropJournal AI</h1>
          </div>
          <Button asChild>
            <a href="/auth">Get Started</a>
          </Button>
        </div>
      </header>

      <section className="relative h-[600px] flex items-center">
        <img
          src={heroImage}
          alt="Sustainable farming"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-5xl font-heading font-bold text-foreground mb-6">
              Grow Sustainably, Earn Rewards
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Track your eco-friendly farming practices, earn credits, and redeem rewards.
              Join the sustainable agriculture revolution.
            </p>
            <Button size="lg" asChild className="text-lg px-8">
              <a href="/auth">Start Your Journey</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-heading font-bold text-center mb-12">
            How It Works
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-6 rounded-lg card-shadow text-center hover-lift">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Leaf className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-xl font-heading font-semibold mb-3">Log Activities</h4>
              <p className="text-muted-foreground">
                Record your sustainable farming practices like organic inputs, water conservation, and soil health improvements.
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg card-shadow text-center hover-lift">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Award className="h-8 w-8 text-success" />
              </div>
              <h4 className="text-xl font-heading font-semibold mb-3">Earn Credits</h4>
              <p className="text-muted-foreground">
                Get rewarded with credits for every eco-friendly activity you complete on your farm.
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg card-shadow text-center hover-lift">
              <div className="h-16 w-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-secondary" />
              </div>
              <h4 className="text-xl font-heading font-semibold mb-3">Redeem Rewards</h4>
              <p className="text-muted-foreground">
                Exchange your credits for valuable farming supplies, tools, and training courses.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 CropJournal AI. Building a sustainable future together.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
