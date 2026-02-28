-- Add event_members to the realtime publication so the existing
-- postgres_changes listener in the event detail screen receives
-- updates when members join or check in.
ALTER PUBLICATION supabase_realtime ADD TABLE event_members;
