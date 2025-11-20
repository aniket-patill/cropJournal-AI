import { useAuthContext } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import heroImage from "@/assets/hero-farm.jpg";
import DemoImage from "@/assets/demo-page.png"

const Index = () => {
  const { user } = useAuthContext();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-green-300 border-b border-white/20 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-primary drop-shadow-sm">
            KrishiLog
          </h1>
          <button className="px-6 py-2 bg-primary/30 text-primary-foreground rounded-lg font-medium transition-all duration-300 hover:bg-primary hover:text-white backdrop-blur-sm border border-white/20 shadow-lg">
            <a href="/auth" className="no-underline">Get Started</a>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[700px] flex items-center justify-center overflow-hidden">
        <img
          src={heroImage}
          alt="Sustainable farming"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background/40" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-6xl md:text-7xl font-heading font-bold text-foreground mb-6 leading-tight">
              Grow Sustainably, Earn Rewards
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Track your eco-friendly farming practices, earn credits, and redeem rewards. Join the sustainable agriculture revolution.
            </p>
            <button className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-primary-foreground hover:text-primary hover:shadow-xl transform hover:scale-105">
              <a href="/auth" className="no-underline">Start Your Journey</a>
            </button>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-24 bg-muted/10">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h3 className="text-4xl md:text-5xl font-heading font-bold mb-8">The Challenge</h3>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Farmers worldwide face difficulties in tracking sustainable practices and gaining recognition for their efforts. 
            Without proper tools, eco-friendly farming often goes unnoticed and unrewarded.
          </p>
        </div>
      </section>

{/* Solution Overview */}
<section className="py-24 bg-background">
  <div className="container mx-auto px-4 text-center">
    <h3 className="text-4xl md:text-5xl font-heading font-bold mb-16">Our Solution</h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Card 1 */}
      <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-all flex flex-col items-center">
        <div className="text-5xl font-bold text-primary mb-4">1</div>
        <h4 className="text-2xl font-heading font-semibold mb-4">Log Activities</h4>
        <p className="text-muted-foreground text-lg">
          Record sustainable farming practices like organic inputs, water conservation, and soil health improvements.
        </p>
      </div>

      {/* Card 2 */}
      <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-all flex flex-col items-center">
        <div className="text-5xl font-bold text-success mb-4">2</div>
        <h4 className="text-2xl font-heading font-semibold mb-4">Earn Credits</h4>
        <p className="text-muted-foreground text-lg">
          Get rewarded with credits for every eco-friendly activity you complete on your farm.
        </p>
      </div>

      {/* Card 3 */}
      <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-all flex flex-col items-center">
        <div className="text-5xl font-bold text-secondary mb-4">3</div>
        <h4 className="text-2xl font-heading font-semibold mb-4">Redeem Rewards</h4>
        <p className="text-muted-foreground text-lg">
          Exchange credits for farming supplies, tools, and training courses.
        </p>
      </div>
    </div>
  </div>
</section>


     
 {/* Demo Walkthrough */}
<section className="py-24 bg-background">
  <div className="container mx-auto px-4 text-center max-w-4xl">
    <h3 className="text-4xl md:text-5xl font-heading font-bold mb-8">MVP Walkthrough</h3>
  
    <div className="bg-card p-8 rounded-xl border border-border shadow-lg">
      {/* Replace with actual demo image */}
      <img
        src={DemoImage}
        alt="MVP demo screenshot"
        className="w-full h-auto rounded-lg object-cover"
      />
    </div>
  </div>
</section>


      {/* Testimonials */}
      <section className="py-24 bg-muted/10">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-4xl md:text-5xl font-heading font-bold mb-12">Early Feedback</h3>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-card p-6 rounded-lg border border-border shadow">
              <p className="text-lg text-muted-foreground">
                "This makes tracking sustainability effortless. I finally feel recognized for my eco-friendly practices."
              </p>
              <p className="mt-4 font-semibold text-primary">Krutika Sambrinikar</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border shadow">
              <p className="text-lg text-muted-foreground">
                "The credits system motivates me to adopt better farming methods. It's simple and rewarding."
              </p>
              <p className="mt-4 font-semibold text-primary">Ayman Shilledar</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-4xl md:text-5xl font-heading font-bold mb-8">Join the Movement</h3>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Be part of the sustainable agriculture revolution. Start logging your practices today and earn rewards.
          </p>
          <button className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-primary-foreground hover:text-primary hover:shadow-xl transform hover:scale-105">
            <a href="/auth" className="no-underline">Get Started</a>
          </button>
        </div>
      </section>

 
    </div>
  );
};

export default Index;