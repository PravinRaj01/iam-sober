-- Create achievements table
create table public.achievements (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    description text not null,
    badge_name text not null,
    points integer not null,
    category text not null,
    requirements jsonb not null
);

-- Create user_achievements table to track earned achievements
create table public.user_achievements (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    achievement_id uuid references public.achievements on delete cascade not null,
    earned_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, achievement_id)
);

-- Add gamification columns to profiles table
alter table public.profiles
add column if not exists points integer default 0,
add column if not exists level integer default 1,
add column if not exists xp integer default 0,
add column if not exists current_streak integer default 0,
add column if not exists longest_streak integer default 0,
add column if not exists last_check_in timestamp with time zone;

-- Insert initial achievements
insert into public.achievements (title, description, badge_name, points, category, requirements) values
-- Milestone Achievements
('First Step', 'Complete your first day sober', 'first-step', 100, 'milestone', '{"days": 1}'),
('Week Warrior', 'Stay sober for 7 days', 'week-warrior', 200, 'milestone', '{"days": 7}'),
('Monthly Master', 'Maintain sobriety for 30 days', 'monthly-master', 500, 'milestone', '{"days": 30}'),
('Quarterly Champion', 'Stay sober for 90 days', 'quarterly-champ', 1000, 'milestone', '{"days": 90}'),
('Half-Year Hero', 'Achieve 180 days of sobriety', 'half-year-hero', 2000, 'milestone', '{"days": 180}'),
('Year of Triumph', 'Complete one year sober', 'year-triumph', 5000, 'milestone', '{"days": 365}'),

-- Streak Achievements
('Streak Starter', 'Check in 3 days in a row', 'streak-starter', 150, 'streak', '{"streak": 3}'),
('Consistency King', 'Maintain a 7-day check-in streak', 'streak-master', 300, 'streak', '{"streak": 7}'),
('Streak Legend', 'Achieve a 30-day check-in streak', 'streak-legend', 1000, 'streak', '{"streak": 30}'),

-- Journal Achievements
('Dear Diary', 'Write your first journal entry', 'first-journal', 100, 'journal', '{"entries": 1}'),
('Prolific Writer', 'Create 10 journal entries', 'journal-master', 300, 'journal', '{"entries": 10}'),
('Memoir Maker', 'Write 50 journal entries', 'journal-legend', 1000, 'journal', '{"entries": 50}'),

-- Goals Achievements
('Goal Getter', 'Complete your first goal', 'first-goal', 200, 'goals', '{"completed": 1}'),
('Goal Crusher', 'Complete 5 goals', 'goal-master', 500, 'goals', '{"completed": 5}'),
('Achievement Architect', 'Complete 20 goals', 'goal-legend', 2000, 'goals', '{"completed": 20}'),

-- Community Achievements
('Community Member', 'Share your first milestone', 'first-share', 100, 'community', '{"shares": 1}'),
('Inspiration', 'Share 5 milestones', 'share-master', 300, 'community', '{"shares": 5}'),
('Community Leader', 'Share 20 milestones', 'share-legend', 1000, 'community', '{"shares": 20}'),

-- Tool Usage Achievements
('Tool Explorer', 'Use your first coping tool', 'tool-starter', 100, 'tools', '{"tools_used": 1}'),
('Tool Master', 'Use coping tools 10 times', 'tool-master', 300, 'tools', '{"tools_used": 10}'),
('Coping Champion', 'Use coping tools 50 times', 'tool-legend', 1000, 'tools', '{"tools_used": 50}');

-- Create function to calculate level from XP
create or replace function calculate_level(xp integer) returns integer as $$
begin
  -- Level formula: Level = 1 + floor(sqrt(XP/100))
  -- This creates a curve where each level requires more XP than the last
  return 1 + floor(sqrt(xp/100));
end;
$$ language plpgsql;

-- Create function to update user level based on XP
create or replace function update_user_level() returns trigger as $$
begin
  new.level := calculate_level(new.xp);
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update level when XP changes
create trigger update_level_trigger
  before update of xp on public.profiles
  for each row
  execute function update_user_level();

-- Function to check and update streaks
create or replace function update_streak() returns trigger as $$
declare
  last_checkin timestamp;
  days_diff integer;
begin
  -- Get user's last check-in
  select last_check_in into last_checkin
  from public.profiles
  where id = new.user_id;

  if last_checkin is null then
    -- First check-in
    update public.profiles
    set current_streak = 1,
        longest_streak = 1,
        last_check_in = new.created_at
    where id = new.user_id;
  else
    days_diff := extract(days from (new.created_at - last_checkin));
    
    if days_diff = 1 then
      -- Consecutive day, increase streak
      update public.profiles
      set current_streak = current_streak + 1,
          longest_streak = greatest(longest_streak, current_streak + 1),
          last_check_in = new.created_at
      where id = new.user_id;
    elsif days_diff = 0 then
      -- Same day, just update last_check_in
      update public.profiles
      set last_check_in = new.created_at
      where id = new.user_id;
    else
      -- Streak broken
      update public.profiles
      set current_streak = 1,
          last_check_in = new.created_at
      where id = new.user_id;
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Create trigger for check-ins to update streaks
create trigger update_streak_trigger
  after insert on public.check_ins
  for each row
  execute function update_streak();