# App Compliance Audit Prompt
## For Claude Code CLI — AppComplianceAudit.md
### Version 1.0 — January 2026

---

# MASTER PROMPT FOR CLAUDE CODE CLI

You are helping prepare this app for submission to the Apple App Store, Google Play Store, and/or Chrome Web Store.

## YOUR PROCESS

Work in two phases:

### PHASE 1: AUDIT & GENERATE DOCUMENTS (No code changes)
1. Read this entire file to understand requirements and boilerplate
2. Explore the codebase to understand the app
3. Generate all required text/documents in a new `/store-compliance/` folder
4. Create a compliance report showing what exists vs. what's missing, save as `Audit{AppName}Report.md`
5. Create a high-level plan for proposed changes to backend/API and all 4 apps (web, iOS, Android, Chrome), save as `Audit{AppName}Plan.md`
6. STOP and wait for human review before Phase 2

### PHASE 2: IMPLEMENT CHANGES (After human approval)

**IMPORTANT: Always implement in backend/API and webapp FIRST.** 

Even if a feature is only "required" for one platform (e.g., account deletion for iOS), implement it across all platforms for consistency. The native apps (iOS, Android, Chrome) will follow the patterns established in backend/webapp.

1. Backend/API changes first
2. Web app changes second
3. Document any changes necessary and save/update in `Audit{AppName}Plan.md` so iOS, Android, Chrome can follow the same patterns
4. Human will handle native platform implementations (iOS, Android, Chrome) separately

---

# SECTION 1: PUBLISHER INFORMATION

Use this information in all generated documents:

```
Publisher Name: Dragon Dance Publishing
Contact Email: contact@dragondancepublishing.com
Website: http://dragondancepublishing.com
Jurisdiction: Texas, USA
Support URL: mailto:support@dragondancepublishing.com
Marketing URL Pattern: http://dragondancepublishing.com/apps/[APP_SLUG]
```

---

# SECTION 2: APP INFORMATION (FILL THIS IN)

Before running, fill in these details about the specific app:

```yaml
app_name: "[APP_NAME]"
app_slug: "[app-slug-lowercase]"  # for URLs
one_liner: "[One sentence describing what the app does]"
portfolio: "execfunc" | "scout" | "other"  # which portfolio
platforms:
  - web
  - ios
  - android
  - chrome_extension

# AI Usage
uses_ai: true | false
ai_provider: "OpenAI" | "Anthropic" | "None"
ai_provider_privacy_url: "https://openai.com/policies/privacy-policy"
ai_data_sent: "[what data is sent, e.g., 'message text', 'photo', 'responses']"
ai_purpose: "[why, e.g., 'to analyze tone and meaning', 'to identify gear items']"

# Features
has_accounts: true | false
has_iap: true | false
has_social_features: true | false  # chat, community, user interaction
has_user_generated_content: true | false  # user submits text/images

# Monetization
monetization_model: "subscription" | "one_time" | "free" | "none_yet"
free_tier_limit: 5  # daily limit for free users
free_tier_unit: "analyses" | "uses" | "queries"  # what is limited

# Content
is_scout_app: true | false
professional_disclaimer: "[e.g., 'professional counseling, therapy, or relationship advice']"
```

---

# SECTION 3: PRIVACY POLICY TEMPLATE

Generate a Privacy Policy using this template. Save to `/store-compliance/privacy-policy.md` and `/store-compliance/privacy-policy.html`.

```markdown
# Privacy Policy

**Last Updated:** [TODAY'S DATE]

**[APP_NAME]** ("the App") is published by Dragon Dance Publishing ("we," "us," or "our"). This Privacy Policy explains how we collect, use, and protect your information when you use the App.

## 1. Information We Collect

**Information You Provide:**
[IF uses_ai AND ai_data_sent]
- [DESCRIBE ai_data_sent] you submit for processing
[/IF]
[IF has_accounts]
- Email address and password when you create an account
[/IF]
[IF NOT has_accounts AND NOT uses_ai]
- We do not collect personal information you provide directly
[/IF]

**Information Collected Automatically:**
- Device identifier (anonymous UUID) for rate limiting and service operation
- Basic usage data (features used, session duration)

**Information We Do NOT Collect:**
- We do not collect your name, location, contacts, or other personal information unless explicitly stated above
- We do not track you across other apps or websites

## 2. How We Use Your Information

We use collected information to:
- Provide and operate the App's features
[IF uses_ai]
- Process your input using third-party AI services (see Section 3)
[/IF]
- Enforce usage limits and prevent abuse
- Improve the App based on aggregate usage patterns

## 3. Third-Party AI Services

[IF uses_ai]
This App uses **[ai_provider]** to [ai_purpose]. When you use this feature, your [ai_data_sent] is transmitted to [ai_provider]'s servers for processing.

- **What is sent:** [ai_data_sent]
- **Why:** [ai_purpose]
- **Provider's privacy policy:** [ai_provider_privacy_url]

We do not store your AI-processed content on our servers longer than necessary to deliver results to you. [ai_provider] may process data according to their own privacy policy.

You will be asked for consent before any data is sent to AI services.
[/IF]

[IF NOT uses_ai]
This App does not use third-party AI services or transmit your data to external AI providers.
[/IF]

## 4. Data Storage and Security

- Data is transmitted using industry-standard encryption (HTTPS/TLS)
[IF has_accounts]
- Account passwords are securely hashed and never stored in plain text
[/IF]
- We retain data only as long as necessary to provide the service
- Our servers are located in the United States

## 5. Data Sharing

We do not sell your personal information. We may share information only:
[IF uses_ai]
- With AI service providers as described in Section 3
[/IF]
- If required by law or legal process
- To protect our rights or the safety of users

## 6. Your Choices and Rights

[IF has_accounts]
- **Delete Account:** You can delete your account and associated data at any time within the App's Settings
[/IF]
[IF NOT has_accounts]
- **Your Data:** Since we don't create accounts, we don't store personal data tied to your identity
[/IF]
- **Opt-out:** You can stop using the App at any time
- **Contact:** For any privacy questions, contact us at contact@dragondancepublishing.com

## 7. Children's Privacy

This App is not directed at children under 13. We do not knowingly collect personal information from children under 13.

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy in the App.

## 9. Contact Us

Dragon Dance Publishing  
Email: contact@dragondancepublishing.com  
Website: http://dragondancepublishing.com
```

---

# SECTION 4: TERMS OF SERVICE TEMPLATE

Generate Terms of Service using this template. Save to `/store-compliance/terms-of-service.md` and `/store-compliance/terms-of-service.html`.

```markdown
# Terms of Service

**Last Updated:** [TODAY'S DATE]

These Terms of Service ("Terms") govern your use of **[APP_NAME]** ("the App"), published by Dragon Dance Publishing ("we," "us," or "our"). By using the App, you agree to these Terms.

## 1. Acceptance of Terms

By downloading, accessing, or using the App, you agree to be bound by these Terms. If you do not agree, do not use the App.

## 2. Description of Service

[one_liner]

The App is provided "as is" for informational and personal productivity purposes.

## 3. User Conduct

You agree not to:
- Use the App for any unlawful purpose
- Attempt to circumvent usage limits or security measures
- Reverse engineer, decompile, or disassemble the App
- Use the App to harass, abuse, or harm others
[IF uses_ai]
- Submit content designed to manipulate or abuse AI systems
[/IF]

## 4. Intellectual Property

The App and its original content, features, and functionality are owned by Dragon Dance Publishing and are protected by copyright, trademark, and other intellectual property laws.

[IF has_user_generated_content]
You retain ownership of any content you submit to the App. By submitting content, you grant us a limited license to process it solely to provide the App's features.
[/IF]

## 5. AI-Generated Content

[IF uses_ai]
The App uses artificial intelligence to generate responses and analysis. AI-generated content:
- Is provided for informational purposes only
- May not be accurate, complete, or appropriate for your situation
- Should not be relied upon as professional advice (for example, [professional_disclaimer])
- Is not a substitute for qualified professional guidance

You are solely responsible for how you use AI-generated content.
[/IF]

[IF NOT uses_ai]
This App does not generate AI content.
[/IF]

## 6. Disclaimer of Warranties

THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.

[IF is_scout_app]
**Scouting Disclaimer:** This App is not affiliated with, endorsed by, or sponsored by Scouting America (Boy Scouts of America) or any official Scouting organization. This App does not represent Scouting America in any capacity. For official Scouting information, requirements, and policies, consult official BSA resources at scouting.org.
[/IF]

## 7. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, DRAGON DANCE PUBLISHING SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP.

## 8. In-App Purchases

[IF has_iap]
The App may offer optional in-app purchases. All purchases are final and non-refundable except as required by applicable law or app store policies. You may restore previous purchases using the "Restore Purchases" feature.
[/IF]

[IF NOT has_iap]
This App does not currently offer in-app purchases.
[/IF]

## 9. Termination

We reserve the right to terminate or suspend your access to the App at any time, without notice, for conduct that we believe violates these Terms or is harmful to other users or us.

## 10. Changes to Terms

We may modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the new Terms.

## 11. Governing Law

These Terms shall be governed by the laws of the State of Texas, United States, without regard to conflict of law principles.

## 12. Contact Us

Dragon Dance Publishing  
Email: contact@dragondancepublishing.com  
Website: http://dragondancepublishing.com
```

---

# SECTION 5: AI CONSENT COMPONENT

[IF uses_ai]

Generate the AI consent inline component. This appears the FIRST time a user triggers an AI action.

**Copy for this app:**
```
This sends your [ai_data_sent] to [ai_provider] for processing.

Privacy Policy

[Cancel]  [Continue]
```

**Implementation Requirements:**
1. Show inline (not modal) above the AI action button on first use
2. "Privacy Policy" links to the privacy policy
3. "Cancel" dismisses without taking action
4. "Continue" stores consent and proceeds with AI action
5. Store consent: `localStorage.setItem('ai_consent_granted', 'true')`
6. Never show again after consent granted

**Save component specification to:** `/store-compliance/ai-consent-component.md`

[/IF]

---

# SECTION 6: APP STORE DESCRIPTION

Generate the App Store / Play Store description. Save to `/store-compliance/app-store-description.md`.

**Template:**
```
[ONE_LINE_HOOK — expand one_liner to be compelling, ~10 words]

[PROBLEM_STATEMENT — 1-2 sentences about the pain point this app solves. Be specific and relatable.]

[APP_NAME] helps you [SOLUTION — what the app does, written as benefit to user].

FEATURES:
• [FEATURE_1 — read codebase to identify key feature]
• [FEATURE_2]
• [FEATURE_3]
• [FEATURE_4]

[IF uses_ai]
Powered by advanced AI to [ai_purpose].
[/IF]

[IF has_iap AND free_tier_limit > 0]
FREE TO USE
Get [free_tier_limit] free [free_tier_unit] per day. Upgrade to Pro for unlimited access.
[/IF]

[IF is_scout_app]
NOT AFFILIATED WITH SCOUTING AMERICA
This app is an independent study tool and is not affiliated with, endorsed by, or sponsored by Scouting America (BSA). For official requirements and policies, visit scouting.org.
[/IF]

PRIVACY FIRST
• No account required
• Your data is not stored
• See our Privacy Policy for details

Questions or feedback? Contact us at support@dragondancepublishing.com
```

**Instructions for Claude Code:**
- Read the codebase to understand actual features
- Write compelling, honest copy
- Keep total length under 4000 characters
- Do not mention competitors
- Do not claim features that don't exist

---

# SECTION 7: KEYWORDS

Generate App Store keywords. Save to `/store-compliance/keywords.md`.

**iOS App Store:** 100 characters max, comma-separated, no spaces after commas

**Base keywords by portfolio:**

ExecFunc apps:
```
executive function,ADHD,attention,focus,neurodivergent,autism,productivity,anxiety
```

Scout apps:
```
scouting,boy scouts,merit badge,eagle scout,BSA,scout rank,camping,outdoor skills
```

**Instructions for Claude Code:**
- Start with base keywords for the portfolio
- Add 3-5 app-specific keywords based on features
- Keep total under 100 characters
- Prioritize high-intent search terms
- Save final keyword string to file

---

# SECTION 8: AGE RATING ANSWERS

Generate age rating questionnaire answers. Save to `/store-compliance/age-rating.md`.

**Default answers (override if app differs):**

| Question | Answer |
|----------|--------|
| Violence | None |
| Sexual Content | None |
| Nudity | None |
| Profanity/Crude Humor | None |
| Alcohol/Tobacco/Drugs | None |
| Gambling | None |
| Horror/Fear Themes | None |
| Mature/Suggestive Themes | None |
| User-Generated Content | [Yes if has_user_generated_content, else No] |
| Unrestricted Internet Access | No |
| Shares Location | No |
| Shares Personal Info | No |

**Instructions for Claude Code:**
- Review app features for any content that changes these defaults
- Note any concerns in the compliance report

---

# SECTION 9: COMPLIANCE REPORT & PLAN

After generating all documents, create a compliance report and implementation plan.

## Compliance Report

Save to `/store-compliance/Audit{AppName}Report.md` (e.g., `AuditRBTLReport.md`).

**Report Template:**

```markdown
# Compliance Report for [APP_NAME]
Generated: [DATE]

## Documents Generated
- [ ] Privacy Policy (privacy-policy.md, privacy-policy.html)
- [ ] Terms of Service (terms-of-service.md, terms-of-service.html)
- [ ] App Store Description (app-store-description.md)
- [ ] Keywords (keywords.md)
- [ ] Age Rating Answers (age-rating.md)
[IF uses_ai]
- [ ] AI Consent Component Spec (ai-consent-component.md)
[/IF]

## Codebase Audit Results

### Legal Links
- Privacy Policy link in app: [FOUND/MISSING] — location: ____
- Terms of Service link in app: [FOUND/MISSING] — location: ____

### AI Consent (if applicable)
- AI consent flow implemented: [YES/NO]
- Consent stored in: ____

### Account Deletion (if has_accounts)
- Account deletion UI exists: [YES/NO] — location: ____
- Deletion actually deletes data: [UNKNOWN - needs verification]

### Rate Limiting
- Rate limiting implemented: [YES/NO]
- Current limit: ____
- Limit enforcement: [hard stop / soft stop / none]

### In-App Purchases (if has_iap)
- StoreKit/Billing integrated: [YES/NO]
- Restore Purchases button: [FOUND/MISSING]

### Store Assets
- App icon (1024x1024): [FOUND/MISSING]
- Screenshots: [FOUND/MISSING]

## Blockers Before Submission
1. [Critical items that must be fixed]

## Recommendations
1. [Nice-to-have improvements]
```

---

## Implementation Plan

Save to `/store-compliance/Audit{AppName}Plan.md` (e.g., `AuditRBTLPlan.md`).

**Plan Template:**

```markdown
# Implementation Plan for [APP_NAME]
Generated: [DATE]

## Overview
[Brief summary of what needs to be implemented]

## Backend/API Changes
1. [Change description — what and why]
2. [Change description]
3. ...

## Web App Changes
1. [Change description — what and why]
2. [Change description]
3. ...

## iOS App Changes
1. [Change description — what and why]
2. [Change description]
3. ...

## Android App Changes
1. [Change description — what and why]
2. [Change description]
3. ...

## Chrome Extension Changes
1. [Change description — what and why]
2. [Change description]
3. ...

## Implementation Order
1. Backend/API first: [list which changes]
2. Web App second: [list which changes]
3. Native apps follow webapp patterns

## Estimated Effort
- Backend/API: [Low/Medium/High]
- Web App: [Low/Medium/High]
- iOS: [Low/Medium/High]
- Android: [Low/Medium/High]
- Chrome: [Low/Medium/High]

## Open Questions
1. [Any decisions needed from human before proceeding]
```

---

# SECTION 10: PHASE 2 IMPLEMENTATION GUIDE

After human reviews Phase 1 output and approves, proceed with Phase 2.

## Core Principle: Backend/Webapp First, Always

**Implement ALL compliance features in backend/API and webapp first, even if only "required" for a specific platform.** This ensures:
- Consistency across all 4 platforms (web, iOS, Android, Chrome)
- Native apps can reference webapp implementation as the source of truth
- Easier maintenance with one pattern to follow

Example: iOS requires in-app account deletion, but implement it in webapp too so all platforms have it.

## Implementation Order

1. **Backend/API first**
   - Add privacy policy endpoint (serve HTML)
   - Add terms of service endpoint (serve HTML)
   - Verify rate limiting works correctly
   - Add any account management endpoints

2. **Web App second**
   - Add footer links: Privacy Policy | Terms of Service
   - Implement AI consent inline component (if uses_ai)
   - Add account deletion flow (if has_accounts)
   - Add Restore Purchases UI (if has_iap)

3. **Document for native platforms**
   - Create `/store-compliance/IMPLEMENTATION_NOTES.md`
   - Document exactly what was added to webapp
   - Note file paths, component names, API endpoints
   - Human will replicate patterns in iOS/Android/Chrome

## Code Patterns

### Footer Links Pattern (Web)
```html
<footer class="app-footer">
  <a href="/legal/privacy" target="_blank">Privacy Policy</a>
  <span class="separator">|</span>
  <a href="/legal/terms" target="_blank">Terms of Service</a>
</footer>
```

### AI Consent Pattern (Web/React)
```tsx
const [consentGiven, setConsentGiven] = useState(
  () => localStorage.getItem('ai_consent_granted') === 'true'
);

const handleAIAction = () => {
  if (!consentGiven) {
    setShowConsentPrompt(true);
    return;
  }
  // proceed with AI action
};

const handleConsent = () => {
  localStorage.setItem('ai_consent_granted', 'true');
  localStorage.setItem('ai_consent_date', new Date().toISOString());
  setConsentGiven(true);
  setShowConsentPrompt(false);
  // proceed with AI action
};
```

### Backend Legal Routes Pattern (Hono/Express)
```typescript
// Serve legal pages
app.get('/legal/privacy', (c) => {
  return c.html(privacyPolicyHtml);
});

app.get('/legal/terms', (c) => {
  return c.html(termsOfServiceHtml);
});
```

---

# SECTION 11: FINAL CHECKLIST BEFORE SUBMISSION

Before submitting to any store, verify:

## All Platforms
- [ ] Privacy Policy accessible via URL
- [ ] Privacy Policy linked in app Settings/About/Footer
- [ ] Terms of Service accessible via URL
- [ ] Terms of Service linked in app
- [ ] AI consent implemented (if uses_ai)
- [ ] App description written and reviewed
- [ ] Keywords finalized
- [ ] Age rating questionnaire ready

## iOS App Store
- [ ] App icon 1024x1024
- [ ] Screenshots for required device sizes
- [ ] App Store Connect listing complete
- [ ] StoreKit integrated (if has_iap)
- [ ] Restore Purchases button visible
- [ ] Account deletion in-app (if has_accounts)
- [ ] Demo account credentials ready (if needed)

## Google Play Store
- [ ] App icon 512x512
- [ ] Feature graphic 1024x500
- [ ] Screenshots for phone (and tablet if supporting)
- [ ] Data Safety form completed
- [ ] Google Play Billing integrated (if has_iap)
- [ ] Account deletion in-app AND web URL (if has_accounts)
- [ ] Content rating questionnaire completed
- [ ] AAB format build ready

## Chrome Web Store
- [ ] Icon 128x128
- [ ] Screenshots 1280x800 or 640x400
- [ ] Detailed description
- [ ] Single purpose statement
- [ ] Permission justifications for each permission
- [ ] Manifest V3 compliant

---

# HOW TO RUN THIS

## Phase 1 Command:
```
Read AppComplianceAudit.md and execute Phase 1. 

First, fill in Section 2 (App Information) by analyzing this codebase. 
Then generate all documents to /store-compliance/ folder.
Finally, create the compliance report and plan.

Do NOT make any code changes yet. Stop after generating documents. Wait for human approval of plan.
```

## Phase 2 Command (after human review):
```
Read AppComplianceAudit.md and the generated /store-compliance/Audit{AppName}Plan.md.

Execute Phase 2: Implement the required code changes.
Start with backend/API, then web app.
Document all changes in /store-compliance/IMPLEMENTATION_NOTES.md for iOS/Android/Chrome.
```

---

*End of Store Compliance Automation Prompt*
