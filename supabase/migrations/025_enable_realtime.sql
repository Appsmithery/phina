-- Enable Supabase Realtime on key tables so all connected clients
-- receive instant updates when rating rounds, events, or wines change.
ALTER PUBLICATION supabase_realtime ADD TABLE rating_rounds, events, wines;
