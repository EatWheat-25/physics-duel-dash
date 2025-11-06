-- Add INSERT policy for matches so users can create matches
CREATE POLICY "Users can create matches"
ON matches
FOR INSERT
WITH CHECK (auth.uid() IN (player1_id, player2_id));