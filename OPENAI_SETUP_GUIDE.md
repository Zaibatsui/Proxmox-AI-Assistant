# OpenAI ChatGPT Integration - Setup Guide

Your Proxmox AI Admin app now uses **OpenAI ChatGPT** for the AI Assistant feature!

## Quick Setup

### 1. Get Your OpenAI API Key

You likely already have one, but if not:

1. Go to: https://platform.openai.com/api-keys
2. Sign in with your OpenAI account
3. Click **"Create new secret key"**
4. Name it: "Proxmox AI Admin"
5. Copy the key (starts with `sk-proj-...` or `sk-...`)

### 2. Add to Environment

**Edit `backend/.env`:**
```bash
OPENAI_API_KEY="sk-proj-your-actual-key-here"
```

**Or set as environment variable:**
```bash
export OPENAI_API_KEY="sk-proj-your-actual-key-here"
```

### 3. Restart Backend

```bash
# If using Docker Compose
docker-compose restart backend

# If running manually
# Kill and restart uvicorn
```

### 4. Test It

1. Open app → Login
2. Go to **AI Assistant**
3. Ask: "What is IOMMU?"
4. Should get GPT-4 response!

## Model Configuration

Currently using: **GPT-4o** (latest, most capable)

### Available Models:

**Recommended:**
- `gpt-4o` - Latest, smartest, best for technical tasks
- `gpt-4-turbo` - Fast, capable, good balance

**Budget-friendly:**
- `gpt-3.5-turbo` - Cheaper, still capable for basic queries

### Change Model:

Edit `backend/server.py` line ~741:
```python
completion = await client.chat.completions.create(
    model="gpt-4o",  # Change to: gpt-4-turbo, gpt-3.5-turbo, etc.
    messages=[...],
)
```

## Cost Comparison

### OpenAI Pricing (as of 2025):

**GPT-4o:**
- Input: $2.50 per 1M tokens
- Output: $10.00 per 1M tokens

**GPT-4 Turbo:**
- Input: $10.00 per 1M tokens
- Output: $30.00 per 1M tokens

**GPT-3.5 Turbo:**
- Input: $0.50 per 1M tokens
- Output: $1.50 per 1M tokens

### Estimated Monthly Cost:

**Moderate usage (50 queries/day):**

**With GPT-4o:**
```
Input:  50 * 30 * 500 = 750,000 tokens = $1.88
Output: 50 * 30 * 1000 = 1,500,000 tokens = $15.00
Total: ~$17/month
```

**With GPT-3.5 Turbo (budget):**
```
Input:  $0.38
Output: $2.25
Total: ~$3/month
```

### Compare to Anthropic:
- GPT-4o: ~$17/month
- Claude Sonnet: ~$25/month
- **Savings: $8/month** ✅

## API Key Management

### Free Credits

New OpenAI accounts get $5 free credits (covers ~300 queries with GPT-4o)

### Check Usage

Monitor at: https://platform.openai.com/usage

### Set Spending Limits

1. Go to: https://platform.openai.com/account/billing/limits
2. Set **monthly budget limit**
3. Get notified before hitting limit

### Security

**Protect your API key:**
- Never commit to git
- Use `.env` files (add to `.gitignore`)
- Rotate keys periodically
- Set spending limits

## Advantages of Using OpenAI

✅ **You Already Have It** - No new account needed
✅ **Familiar Billing** - Same account as ChatGPT Plus
✅ **Lower Cost** - GPT-4o cheaper than Claude
✅ **Fast Responses** - Low latency
✅ **Reliable** - High uptime
✅ **Great for Technical Tasks** - Excellent at code and system administration

## Feature Compatibility

Everything that worked with Claude works with GPT-4:

✅ Hardware analysis
✅ IOMMU group detection
✅ Passthrough recommendations
✅ Action creation (bind drivers, attach to VMs)
✅ Safety warnings
✅ Command generation

## Troubleshooting

### Error: "AI service not configured"

**Solution:**
1. Verify `OPENAI_API_KEY` in `backend/.env`
2. Check key is valid at https://platform.openai.com/api-keys
3. Restart backend

### Error: "Rate limit exceeded"

**Solution:**
- You've hit your usage limit
- Check usage: https://platform.openai.com/usage
- Upgrade plan or wait for reset

### Error: "Insufficient credits"

**Solution:**
- Add payment method: https://platform.openai.com/account/billing
- Buy credits or set up auto-recharge

### Slow Responses

**Try:**
- Switch to `gpt-4-turbo` (faster)
- Or `gpt-3.5-turbo` (fastest, cheapest)

## Alternative: Use Both!

Want to offer users a choice?

**Add model selection in Settings:**
```python
# In backend/.env
AI_PROVIDER=openai  # or anthropic
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# In code, check AI_PROVIDER and use appropriate client
```

## Migration Summary

**Changed:**
- ❌ `anthropic` library → ✅ `openai` library
- ❌ `ANTHROPIC_API_KEY` → ✅ `OPENAI_API_KEY`
- ❌ Claude 3.5 Sonnet → ✅ GPT-4o

**Same Features:**
- All AI capabilities work identically
- Action creation
- Hardware analysis
- Conversation history

**Better:**
- ✅ Lower monthly cost
- ✅ Use existing OpenAI account
- ✅ Faster setup

## Get Started Now

```bash
# 1. Edit backend/.env
OPENAI_API_KEY="your-key-here"

# 2. Restart
docker-compose restart backend

# 3. Test in AI Assistant
Ask: "Explain GPU passthrough"

# Done! 🚀
```

**Your Proxmox AI Admin now uses OpenAI ChatGPT - same great features, lower cost!** 💰
