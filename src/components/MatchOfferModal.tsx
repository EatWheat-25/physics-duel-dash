import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface MatchOfferModalProps {
  offerId: string;
  matchId: string;
  opponentName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const MatchOfferModal = ({
  offerId,
  matchId,
  opponentName,
  onAccept,
  onDecline,
}: MatchOfferModalProps) => {
  const [timeLeft, setTimeLeft] = useState(15);
  const [accepting, setAccepting] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDecline]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke('accept_offer', {
        body: { offerId }
      });

      if (error) {
        console.error('Error accepting offer:', error);
        setAccepting(false);
        return;
      }

      if (data?.status === 'confirmed') {
        onAccept();
      } else if (data?.status === 'pending') {
        setWaiting(true);
      }
    } catch (error) {
      console.error('Error accepting offer:', error);
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    try {
      await supabase.functions.invoke('decline_offer', {
        body: { offerId }
      });
    } catch (error) {
      console.error('Error declining offer:', error);
    }
    onDecline();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-card border-2 border-primary rounded-2xl p-8 max-w-md w-full mx-4"
        >
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-6xl font-bold text-primary mb-4"
            >
              {timeLeft}
            </motion.div>

            <h2 className="text-3xl font-bold mb-2">Match Found!</h2>
            <p className="text-muted-foreground mb-6">
              You'll battle against <span className="text-primary font-bold">{opponentName}</span>
            </p>

            {waiting ? (
              <div className="text-muted-foreground">
                Waiting for opponent to accept...
              </div>
            ) : (
              <div className="flex gap-4">
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2" />
                  Accept
                </Button>
                <Button
                  onClick={handleDecline}
                  disabled={accepting}
                  variant="destructive"
                  className="flex-1 h-14 text-lg"
                >
                  <XCircle className="mr-2" />
                  Decline
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
