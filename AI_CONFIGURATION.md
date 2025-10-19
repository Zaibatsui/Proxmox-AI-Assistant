# AI Configuration Guide

This guide explains how to configure AI features in the Proxmox AI Admin application using OpenAI's API.

## Table of Contents

1. [Overview](#overview)
2. [Getting OpenAI API Key](#getting-openai-api-key)
3. [Configuring API Key](#configuring-api-key)
4. [AI Features Overview](#ai-features-overview)
5. [Testing AI Assistant](#testing-ai-assistant)
6. [Troubleshooting](#troubleshooting)
7. [Usage and Costs](#usage-and-costs)

---

## Overview

The Proxmox AI Admin uses OpenAI's GPT models to provide intelligent assistance for managing your Proxmox environment. The AI Assistant can:

- **Answer questions** about your environment
- **Provide real-time information** about VMs, containers, and hardware
- **Execute actions** via natural language (with your confirmation)
- **Offer recommendations** for system configuration and troubleshooting

**AI Configuration is Optional:**
- The application works without AI configuration
- You can still manage VMs, scan devices, and use all other features
- AI Assistant tab requires OpenAI API key to function

---

## Getting OpenAI API Key

### Step 1: Create OpenAI Account

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Click **"Sign Up"** (or "Log In" if you have an account)
3. Complete registration with your email
4. Verify your email address

### Step 2: Add Payment Method

**⚠️ Important:** OpenAI requires a payment method for API access.

1. Go to [Billing Settings](https://platform.openai.com/account/billing)
2. Click **"Add payment method"**
3. Enter your credit/debit card information
4. Set up billing limits (recommended):
   - **Monthly budget:** $10-20 for typical usage
   - **Email alerts:** Enable to monitor spending

### Step 3: Generate API Key

1. Navigate to [API Keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Configure:
   - **Name:** "Proxmox AI Admin" (or your preferred name)
   - **Permissions:** "All" (for full access)
4. Click **"Create secret key"**
5. **⚠️ Copy the key immediately** - it won't be shown again!

**Your API key will look like:**
```
sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### Step 4: Store Your Key Securely

- **Do not share** your API key publicly
- **Do not commit** it to version control
- **Store securely** - you'll need it for configuration
- **Regenerate if compromised** - can create new keys anytime

---

## Configuring API Key

### Per-User Configuration (Recommended)

Each user can configure their own OpenAI API key for personalized AI access.

**Steps:**

1. **Log in to the application**
2. **Navigate to Settings** (gear icon in sidebar)
3. **Find "AI Configuration" section**
4. **Enter your OpenAI API key:**
   ```
   sk-proj-abc123def456...
   ```
5. **Click "Save Keys"**
6. **Verify:** Green success message should appear

**Benefits:**
- Each user uses their own OpenAI quota
- Individual cost tracking per user
- Users can update their own keys

### Server-Wide Configuration (Alternative)

Set a default API key for all users via environment variable.

**Edit `backend/.env`:**
```bash
nano backend/.env
```

**Add or update:**
```env
OPENAI_API_KEY=sk-proj-abc123def456...
```

**Restart backend:**
```bash
docker-compose restart backend
```

**Note:** User-configured keys override the server-wide key.

---

## AI Features Overview

### Real-Time Environment Awareness

The AI Assistant has access to your live Proxmox environment through function calling:

1. **VM/Container Information**
   - Current status (running/stopped)
   - Resource usage
   - Configuration details

2. **Hardware Devices**
   - GPU information
   - USB devices
   - NVMe drives
   - PCI devices

3. **System Information**
   - Node status
   - Available resources
   - Storage information

### Example Conversations

**Query VM Status:**
```
You: "What VMs do I have running?"

AI: "You currently have 3 VMs running:
1. ubuntu-server (ID: 100) - Running
2. windows-desktop (ID: 101) - Running  
3. test-environment (ID: 102) - Running

Total: 3 running, 2 stopped"
```

**Hardware Information:**
```
You: "Show me my GPU devices"

AI: "Your system has the following GPUs:
1. NVIDIA RTX 3090 (Bus: 01:00.0)
2. NVIDIA GTX 1080 Ti (Bus: 02:00.0)

Both GPUs are currently available and not assigned to any VMs."
```

**Action Requests:**
```
You: "Start VM 100"

AI: "I can help you start VM 100 (ubuntu-server). 
Would you like me to proceed?"

You: "Yes"

AI: "Starting VM 100... Done! The VM is now running."
```

### AI Capabilities

**Information Retrieval:**
- ✅ List VMs and containers
- ✅ Check VM status
- ✅ View hardware devices
- ✅ Get system information

**Actions (via function calling):**
- ✅ Start/Stop/Restart VMs
- ✅ Query device information
- ✅ Get real-time status
- 🔄 More actions in development

**Recommendations:**
- ✅ Best practices for VM configuration
- ✅ Hardware passthrough advice
- ✅ Troubleshooting suggestions

---

## Testing AI Assistant

### Step 1: Verify Configuration

1. Go to **Settings** page
2. Check **"AI Configuration"** section
3. Ensure API key is saved
4. Look for success confirmation

### Step 2: Access AI Assistant

1. Navigate to **"AI Assistant"** tab in sidebar
2. You should see the chat interface
3. Previous conversations (if any) will be loaded

### Step 3: Test Basic Interaction

**Try these example queries:**

**Test 1: Simple greeting**
```
You: "Hello, what can you help me with?"
```
Should get a friendly response explaining capabilities.

**Test 2: Environment query**
```
You: "What VMs do I have?"
```
Should list your actual VMs (requires Proxmox configuration).

**Test 3: Hardware query**
```
You: "Show me my hardware devices"
```
Should list detected devices (requires SSH configuration).

### Step 4: Verify Real-Time Data

The AI should provide **actual information** from your environment, not generic responses.

**Expected behavior:**
- ✅ Lists your real VM names and IDs
- ✅ Shows actual hardware devices
- ✅ Reflects current VM states (running/stopped)

**If showing generic/mock data:**
- Check Proxmox API configuration
- Verify SSH connection
- See troubleshooting section

---

## Troubleshooting

### Issue: "API Key Required" or "AI Configuration Missing"

**Symptoms:**
- Error message when trying to use AI Assistant
- Chat input disabled

**Solutions:**

1. **Verify API key is configured:**
   - Go to Settings → AI Configuration
   - Check if API key is entered
   - Click "Save Keys" if needed

2. **Check API key format:**
   - Should start with `sk-proj-` or `sk-`
   - No extra spaces or characters

3. **Test key manually:**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```
   Should return list of available models.

### Issue: "OpenAI API Error" / Rate Limit

**Symptoms:**
- Error messages in AI responses
- "Rate limit exceeded"
- "Insufficient quota"

**Solutions:**

1. **Check billing status:**
   - Visit [OpenAI Billing](https://platform.openai.com/account/billing)
   - Ensure payment method is valid
   - Add credits if balance is low

2. **Check usage limits:**
   - Visit [Usage Dashboard](https://platform.openai.com/usage)
   - Review current usage
   - Adjust budget limits if needed

3. **Rate limiting:**
   - Wait a few minutes and retry
   - OpenAI has per-minute request limits
   - Consider upgrading tier for higher limits

### Issue: AI Shows Generic Responses

**Symptoms:**
- AI provides general information instead of your actual data
- Says "I don't have access to your environment"
- Can't list your VMs or devices

**Solutions:**

1. **Verify Proxmox API is configured:**
   - Go to Settings → Proxmox API Configuration
   - Test API connection
   - Should show ✅ Connected

2. **Check backend logs:**
   ```bash
   docker logs proxmox-ai-backend | grep -i "function\|tool"
   ```
   Should show function calls being made.

3. **Test VM Management page:**
   - Navigate to "VM & Container Management"
   - Click "Load VMs & Containers"
   - Should display your VMs
   - If this works, AI should also have access

4. **Restart backend:**
   ```bash
   docker-compose restart backend
   ```

### Issue: Slow AI Responses

**Symptoms:**
- Long wait times for AI responses
- Timeout errors

**Possible causes:**

1. **OpenAI API latency:**
   - Normal: 2-5 seconds
   - Slow: 10+ seconds
   - Check [OpenAI Status](https://status.openai.com/)

2. **Function calling overhead:**
   - AI making multiple environment queries
   - This is normal for complex questions
   - Can take 5-10 seconds

3. **Network issues:**
   - Check internet connectivity
   - Test backend API access

### Issue: API Key Not Saving

**Symptoms:**
- Save successful message appears
- But API key doesn't persist after reload

**Solutions:**

1. **Check database connection:**
   ```bash
   docker logs proxmox-ai-mongodb
   ```

2. **Check backend logs:**
   ```bash
   docker logs proxmox-ai-backend | grep -i "api_key\|openai"
   ```

3. **Verify user is logged in:**
   - Ensure you're authenticated
   - Try logging out and back in

4. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R)
   - Or clear site data

---

## Usage and Costs

### Understanding OpenAI Pricing

OpenAI charges based on:
- **Tokens processed** (input + output)
- **Model used** (GPT-4 is more expensive than GPT-3.5)

**Current rates (as of 2025):**
- **GPT-4:** ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- **GPT-3.5 Turbo:** ~$0.001 per 1K input tokens, ~$0.002 per 1K output tokens

*Note: Check [OpenAI Pricing](https://openai.com/pricing) for current rates.*

### Estimating Costs

**Typical usage:**
- Simple query: ~500-1000 tokens = $0.01-0.05
- Complex query with function calls: ~2000-5000 tokens = $0.05-0.25
- Daily casual use: $0.50-2.00
- Heavy daily use: $2.00-10.00

**Monthly estimates:**
- Light user (few queries/day): $5-15/month
- Regular user (10-20 queries/day): $15-50/month
- Heavy user (50+ queries/day): $50-150/month

### Cost Optimization

**Tips to reduce costs:**

1. **Be specific in queries:**
   - "List my running VMs" instead of "Tell me about my environment"
   
2. **Use simple questions:**
   - Direct queries use fewer tokens
   
3. **Avoid repetitive queries:**
   - Use other UI tabs for frequent checks
   - AI Assistant for complex questions

4. **Set budget alerts:**
   - Configure in OpenAI billing settings
   - Get notified before spending too much

5. **Monitor usage:**
   - Check [OpenAI Usage](https://platform.openai.com/usage) regularly
   - Review what queries cost most

### Free Alternatives

**Without OpenAI API key:**
- ✅ VM management still works
- ✅ Device scanning still works
- ✅ All monitoring features work
- ❌ AI Assistant unavailable

**The AI Assistant is a convenience feature** - the application is fully functional without it.

---

## Best Practices

### Security

1. **Never share API keys** in screenshots, logs, or support requests
2. **Use environment variables** for server-wide keys
3. **Rotate keys regularly** (every 3-6 months)
4. **Set spending limits** in OpenAI dashboard
5. **Monitor usage** for unexpected spikes

### Usage

1. **Start with simple queries** to understand AI capabilities
2. **Verify AI responses** before taking actions
3. **Use AI for complex questions** - simple checks use the UI
4. **Provide context** in your questions for better responses
5. **Review function calls** to understand what AI is accessing

### Maintenance

1. **Check billing monthly** to monitor costs
2. **Update API keys** if regenerated
3. **Test AI periodically** to ensure it's working
4. **Review audit logs** for AI-initiated actions

---

## Model Information

The application currently uses:
- **Model:** GPT-4 or GPT-3.5 Turbo (configurable in backend)
- **Function Calling:** Enabled for real-time environment access
- **Context Window:** 8K-128K tokens (model-dependent)
- **Response Format:** Markdown with code blocks

**Future updates may include:**
- Model selection in UI
- Custom system prompts
- Temperature/parameter controls
- Support for other AI providers

---

## Quick Reference

### API Key Format
```
sk-proj-[52 characters of alphanumeric]
Example: sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### Configuration Locations
```
Per-user: Settings → AI Configuration
Server-wide: backend/.env → OPENAI_API_KEY
```

### Test Commands
```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"

# Check backend has key
docker exec proxmox-ai-backend env | grep OPENAI

# View AI-related logs
docker logs proxmox-ai-backend | grep -i openai
```

### Example Queries
```
"What VMs do I have?"
"Show me my running containers"
"List all GPU devices"
"What's the status of VM 100?"
"Show me my NVMe drives"
"Start VM 101"
```

---

## Additional Resources

- [OpenAI Platform Documentation](https://platform.openai.com/docs)
- [OpenAI API Pricing](https://openai.com/pricing)
- [OpenAI Usage Dashboard](https://platform.openai.com/usage)
- [OpenAI Status Page](https://status.openai.com/)
- [OpenAI Community Forum](https://community.openai.com/)

---

**Version 2.0** | Last Updated: January 2025
