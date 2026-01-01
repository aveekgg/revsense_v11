# Testing Edge Functions - Quick Guide

## 🎯 How to Test Your Edge Functions

Your Edge Functions are deployed and the secrets are configured correctly. Here's how to test them:

### **Method 1: Test Current Project (Easiest)**

Use your current project credentials from `.env`:

```bash
# Test ai-sql-orchestrator
curl -i --location --request POST \
  'https://qgtelxfvamsitzrsoiox.supabase.co/functions/v1/ai-sql-orchestrator' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndGVseGZ2YW1zaXR6cnNvaW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NjA1MjYsImV4cCI6MjA4MjMzNjUyNn0.zwTxmnOfKK6Auid_Jo54xu4dEv3FriKH36eumxlVxoA' \
  --header 'Content-Type: application/json' \
  --data '{"userQuery":"Show me total revenue","sessionId":"test-123","chatHistory":[]}'
```

**Expected Response:**
- ✅ Status: 200 OK
- ✅ JSON response with SQL query and results
- ❌ 404 = Function not deployed
- ❌ 500 = Function error (check logs)

### **Method 2: Test Using Supabase CLI**

```bash
# Invoke function locally
supabase functions invoke ai-sql-orchestrator \
  --data '{"userQuery":"Show me total revenue","sessionId":"test-123","chatHistory":[]}'
```

### **Method 3: Test All Functions**

Create a test script:

```bash
#!/bin/bash

PROJECT_URL="https://qgtelxfvamsitzrsoiox.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndGVseGZ2YW1zaXR6cnNvaW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NjA1MjYsImV4cCI6MjA4MjMzNjUyNn0.zwTxmnOfKK6Auid_Jo54xu4dEv3FriKH36eumxlVxoA"

echo "Testing Edge Functions..."
echo ""

# Test 1: ai-sql-orchestrator
echo "1. Testing ai-sql-orchestrator..."
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  --request POST \
  "${PROJECT_URL}/functions/v1/ai-sql-orchestrator" \
  --header "Authorization: Bearer ${ANON_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"userQuery":"test","sessionId":"test","chatHistory":[]}'

# Test 2: ai-chart-generator
echo "2. Testing ai-chart-generator..."
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  --request POST \
  "${PROJECT_URL}/functions/v1/ai-chart-generator" \
  --header "Authorization: Bearer ${ANON_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"userQuery":"test"}'

# Test 3: generate-session-title
echo "3. Testing generate-session-title..."
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  --request POST \
  "${PROJECT_URL}/functions/v1/generate-session-title" \
  --header "Authorization: Bearer ${ANON_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"messages":[]}'

echo ""
echo "✅ All functions tested!"
echo "200 = Success, 404 = Not deployed, 500 = Error"
```

Save as `test_functions.sh` and run:
```bash
chmod +x test_functions.sh
./test_functions.sh
```

### **Method 4: Check Function Logs**

```bash
# View logs for a specific function
supabase functions logs ai-sql-orchestrator

# Follow logs in real-time
supabase functions logs ai-sql-orchestrator --follow
```

### **Method 5: Test in Browser (Frontend)**

The easiest way is to just use your app:

1. Open your app: http://localhost:5173
2. Go to "Ask AI" page
3. Type a question: "Show me total revenue"
4. If it works, your Edge Functions are working! ✅

---

## 🔍 Troubleshooting

### Error: "Unauthorized" (401)
- Check your anon key is correct
- Make sure you're using the right project URL

### Error: "Function not found" (404)
- Function not deployed
- Run: `supabase functions deploy ai-sql-orchestrator`

### Error: "Internal Server Error" (500)
- Check function logs: `supabase functions logs ai-sql-orchestrator`
- Verify OPENAI_API_KEY is set: `supabase secrets list`

### Error: "CORS error"
- This is normal when testing from browser
- Use curl or the app instead

---

## ✅ Quick Verification Checklist

- [ ] Secrets are set: `supabase secrets list`
- [ ] Functions are deployed: `supabase functions list`
- [ ] Test with curl (see Method 1 above)
- [ ] Check logs if errors: `supabase functions logs <function-name>`
- [ ] Test in your app: http://localhost:5173

---

## 🎯 For New Project Testing

When you create a new Supabase project, replace:
- `PROJECT_URL` with new project URL
- `ANON_KEY` with new project anon key

Then run the same tests!
