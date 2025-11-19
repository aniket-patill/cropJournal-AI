import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Coins } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Reward {
  id: string;
  title: string;
  description: string;
  credits_cost: number;
  image_url: string | null;
  available: boolean;
}

export default function Marketplace() {
  const { user, getToken } = useAuthContext();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRewards();
      fetchCredits();
    }
  }, [user]);

  const fetchCredits = async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getCredits();
      setCredits(response.credits);
    } catch (error: any) {
      console.error('Error fetching credits:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load credits",
        variant: "destructive",
      });
    }
  };

  const fetchRewards = async () => {
    try {
      const response = await apiClient.getRewards();
      setRewards(response.rewards || []);
    } catch (error: any) {
      console.error('Error fetching rewards:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load rewards",
        variant: "destructive",
      });
    }
  };

  const handleRedeem = async () => {
    if (!selectedReward || !user) return;
    
    if (credits < selectedReward.credits_cost) {
      toast({
        title: "Insufficient credits",
        description: `You need ${selectedReward.credits_cost - credits} more credits to redeem this reward.`,
        variant: "destructive",
      });
      setSelectedReward(null);
      return;
    }

    setRedeeming(true);
    
    try {
      const response = await apiClient.redeemReward(selectedReward.id);
      
      toast({
        title: "Reward redeemed!",
        description: `You've successfully redeemed ${selectedReward.title}`,
      });
      
      fetchCredits();
      setSelectedReward(null);
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      toast({
        title: "Redemption failed",
        description: error.message || "Failed to redeem reward",
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Marketplace</h1>
          <p className="text-muted-foreground mt-1">Redeem your credits for sustainable farming rewards</p>
        </div>
        <Card className="card-shadow">
          <CardContent className="flex items-center gap-2 pt-6">
            <Coins className="h-5 w-5 text-warning" />
            <span className="text-2xl font-heading font-bold text-primary">{credits}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => {
          const canAfford = credits >= reward.credits_cost;
          
          return (
            <Card key={reward.id} className="card-shadow hover-lift overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                <ShoppingBag className="h-16 w-16 text-primary" />
              </div>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{reward.title}</CardTitle>
                  <Badge variant={canAfford ? "default" : "secondary"} className="ml-2">
                    <Coins className="h-3 w-3 mr-1" />
                    {reward.credits_cost}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{reward.description}</p>
                <Button
                  onClick={() => setSelectedReward(reward)}
                  disabled={!canAfford}
                  className="w-full"
                  variant={canAfford ? "default" : "secondary"}
                >
                  {canAfford ? "Redeem" : "Insufficient Credits"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedReward} onOpenChange={() => setSelectedReward(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Are you sure you want to redeem this reward?
            </DialogDescription>
          </DialogHeader>
          {selectedReward && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{selectedReward.title}</h3>
                <p className="text-sm text-muted-foreground">{selectedReward.description}</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <span className="font-medium">Cost:</span>
                <div className="flex items-center gap-1 text-primary font-bold">
                  <Coins className="h-4 w-4" />
                  {selectedReward.credits_cost} credits
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <span className="font-medium">Remaining:</span>
                <div className="flex items-center gap-1 font-bold">
                  <Coins className="h-4 w-4" />
                  {credits - selectedReward.credits_cost} credits
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReward(null)}>
              Cancel
            </Button>
            <Button onClick={handleRedeem} disabled={redeeming}>
              {redeeming ? "Redeeming..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
