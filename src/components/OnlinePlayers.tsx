import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PresenceUser {
  user_id: string;
  display_name: string;
  online_at: string;
}

interface OnlinePlayersProps {
  users: PresenceUser[];
  currentUserId?: string | null;
}

export const OnlinePlayers = ({ users, currentUserId }: OnlinePlayersProps) => {
  return (
    <Card className="bg-background/40 backdrop-blur-sm border-primary/20">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Online Players
          </h3>
          <span className="ml-auto text-sm text-muted-foreground">
            {users.length} online
          </span>
        </div>
        
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No players online
            </p>
          ) : (
            users.map((user) => (
              <motion.div
                key={user.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  user.user_id === currentUserId
                    ? 'bg-primary/20 border border-primary/40'
                    : 'bg-secondary/50'
                }`}
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-semibold text-sm">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.display_name}
                    {user.user_id === currentUserId && (
                      <span className="ml-2 text-xs text-primary">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Online now
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
};
