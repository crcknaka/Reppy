# Supabase Edge Functions

## delete-account

Edge function for deleting user accounts. This function uses the service role key to delete the user from `auth.users`.

### Deploy

1. Install Supabase CLI if not installed:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project (get project ref from Supabase dashboard URL):
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy delete-account
   ```

### Environment Variables

The function uses the following environment variables (automatically available in Supabase Edge Functions):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Anonymous key for client auth
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

### Usage

The function is called from the client via:
```typescript
fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${session.access_token}`,
  },
});
```
