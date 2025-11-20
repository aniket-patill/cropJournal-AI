import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Coins } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Reward {
  id: string;
  title: string;
  description: string;
  credits_cost: number;
  image_url: string | null;
  available: boolean;
}

/**
 * Reliable fallback image used when a reward image is missing or fails to load.
 * Replace with a local import if you'd rather bundle a local image.
 */
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=5b1f5d9a9d1f6b4b1c6a7f6a5a8e0c2a";

/**
 * Realistic fallback rewards with relevant photos and relatable copy.
 * All credits_cost values are within the requested 50 - 200 range.
 */
const SAMPLE_REWARDS: Reward[] = [
  {
    id: "sample-1",
    title: "Organic Compost (10kg)",
    description:
      "Boost soil health and yields — a 10kg bag of locally blended organic compost suitable for fruit trees and kitchen gardens.",
    credits_cost: 150,
    image_url:
      "https://images.unsplash.com/photo-1601758123927-1a0b3a8f8f9d?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=1e9a3b9b6f4d5a2f8b7c6d5e4a3b2c1d",
    available: true,
  },
  {
    id: "sample-2",
    title: "Seedling Trays (10 pcs)",
    description:
      "Reusable polycarbonate seedling trays — perfect for starting vegetable seedlings and reducing plastic waste on the farm.",
    credits_cost: 75,
    image_url:
      "https://images.unsplash.com/photo-1528825871115-3581a5387919?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=2f6b7c8d9a0e1b2c3d4e5f6a7b8c9d0e",
    available: true,
  },
  {
    id: "sample-3",
    title: "Ergonomic Hand Trowel",
    description:
      "Strong, rust-resistant hand trowel with a comfortable grip — ideal for planting seedlings and working raised beds.",
    credits_cost: 60,
    image_url:
      "https://images.unsplash.com/photo-1587502537745-1a64b3d7f44d?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=a3b2c1d4e5f6g7h8i9j0k1l2m3n4o5p6",
    available: true,
  },
  {
    id: "sample-4",
    title: "Native Wildflower Seed Mix (200g)",
    description:
      "A hand-picked mix of native wildflower seeds to attract pollinators and improve on-farm biodiversity.",
    credits_cost: 50,
    image_url:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=4f3e2d1c0b9a8e7d6c5b4a3f2e1d0c9b",
    available: true,
  },
  {
    id: "sample-5",
    title: "Drip Irrigation Starter Kit",
    description:
      "Small drip kit for two raised beds — saves water and delivers moisture directly to roots, great during dry spells.",
    credits_cost: 199,
    image_url:
      "https://images.unsplash.com/photo-1582719478179-8f8f9b2a3c4d?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d",
    available: true,
  },
  {
    id: "sample-6",
    title: "Local Market Voucher",
    description:
      "Support local farmers — a voucher you can spend at participating farmers' markets or co-op stores near you.",
    credits_cost: 120,
    image_url:
      "https://images.unsplash.com/photo-1506806732259-39c2d0268443?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=6b5a4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
    available: true,
  },
];

/** Small helper component so each card image handles loading/error gracefully. */
function CardImage({ src, alt }: { src: string | null; alt: string }) {
  const [currentSrc, setCurrentSrc] = useState<string>(src ?? FALLBACK_IMAGE);
  const [loading, setLoading] = useState(true);

  // If parent changes src, update
  useEffect(() => {
    setCurrentSrc(src ?? FALLBACK_IMAGE);
    setLoading(true);
  }, [src]);

  return (
    <div className="h-48 bg-muted/40 flex items-center justify-center overflow-hidden relative">
      {/* visual placeholder to avoid jump */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/80 animate-pulse" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          if (currentSrc !== FALLBACK_IMAGE) {
            setCurrentSrc(FALLBACK_IMAGE);
            setLoading(false);
          }
        }}
      />
    </div>
  );
}

/** clamp value to 50 - 200 range */
const clampCost = (value: number) => Math.min(200, Math.max(50, Math.floor(value)));

export default function Marketplace() {
  const { user } = useAuthContext();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRewards();
      fetchCredits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchCredits = async () => {
    if (!user) return;

    try {
      const response = await apiClient.getCredits();
      setCredits(response.credits);
    } catch (error: any) {
      console.error("Error fetching credits:", error);
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

      // If API returns nothing or empty list, use SAMPLE_REWARDS (but ensure clamp)
      let apiRewards: Reward[] = response?.rewards ?? [];

      if (!apiRewards || apiRewards.length === 0) {
        apiRewards = SAMPLE_REWARDS.map((r) => ({ ...r, credits_cost: clampCost(r.credits_cost) }));
      } else {
        // Ensure each reward has image_url; fallback to sample images by index and clamp costs
        apiRewards = apiRewards.map((r, idx) => {
          const img = r.image_url ?? SAMPLE_REWARDS[idx % SAMPLE_REWARDS.length].image_url ?? FALLBACK_IMAGE;
          const originalCost = typeof r.credits_cost === "number" ? r.credits_cost : SAMPLE_REWARDS[idx % SAMPLE_REWARDS.length].credits_cost;
          return {
            ...r,
            image_url: img,
            credits_cost: clampCost(originalCost),
          };
        });
      }

      setRewards(apiRewards);
    } catch (error: any) {
      console.error("Error fetching rewards:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load rewards",
        variant: "destructive",
      });

      // On error, fallback to sample rewards so the UI remains testable
      setRewards(SAMPLE_REWARDS.map((r) => ({ ...r, credits_cost: clampCost(r.credits_cost) })));
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
      console.error("Error redeeming reward:", error);
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
          <p className="text-muted-foreground mt-1">Redeem your credits for practical, farm-friendly rewards</p>
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
              {/* image area */}
              <CardImage src={reward.image_url ?? FALLBACK_IMAGE} alt={reward.title} />

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
                  className="w-full"
                  variant={canAfford ? "default" : "secondary"}
                >
                  {canAfford ? "Redeem" : "View Details"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={!!selectedReward} onOpenChange={(open) => {
        if (!open) {
          setSelectedReward(null);
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedReward && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-2xl">Checkout</SheetTitle>
                <SheetDescription>Review your order and complete payment with credits</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-4">
                {/* Reward Details Section */}
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                      <img
                        src={selectedReward.image_url ?? FALLBACK_IMAGE}
                        alt={selectedReward.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1">{selectedReward.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{selectedReward.description}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Summary Section */}
                <div className="space-y-3 border-t pt-4">
                  <h4 className="font-semibold text-base">Payment Summary</h4>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">Item Cost</span>
                      <div className="flex items-center gap-1.5 text-primary font-semibold">
                        <Coins className="h-4 w-4" />
                        <span>{selectedReward.credits_cost} credits</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">Current Balance</span>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Coins className="h-4 w-4 text-warning" />
                        <span>{credits} credits</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <span className="text-sm font-semibold">Remaining Balance</span>
                      <div className="flex items-center gap-1.5 text-primary font-bold">
                        <Coins className="h-4 w-4" />
                        <span>{Math.max(0, credits - selectedReward.credits_cost)} credits</span>
                      </div>
                    </div>
                  </div>

                  {credits < selectedReward.credits_cost && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive font-medium">
                        Insufficient credits. You need {selectedReward.credits_cost - credits} more credits.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <SheetFooter className="gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedReward(null)}
                  disabled={redeeming}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRedeem}
                  disabled={redeeming || credits < selectedReward.credits_cost}
                  className="w-full"
                >
                  {redeeming ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Coins className="h-4 w-4 mr-2" />
                      Pay {selectedReward.credits_cost} credits
                    </>
                  )}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
