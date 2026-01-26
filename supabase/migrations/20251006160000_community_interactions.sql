create table if not exists public.community_interactions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users not null,
    type text not null check (type in ('milestone_share', 'support_given', 'support_received')),
    milestone_days integer,
    message text,
    anonymous boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create RLS policies
alter table public.community_interactions enable row level security;

create policy "Users can view all community interactions"
    on public.community_interactions for select
    using (true);

create policy "Users can create their own interactions"
    on public.community_interactions for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own interactions"
    on public.community_interactions for update
    using (auth.uid() = user_id);

create policy "Users can delete their own interactions"
    on public.community_interactions for delete
    using (auth.uid() = user_id);

-- Create indexes
create index community_interactions_user_id_idx on public.community_interactions(user_id);
create index community_interactions_type_idx on public.community_interactions(type);
create index community_interactions_created_at_idx on public.community_interactions(created_at);