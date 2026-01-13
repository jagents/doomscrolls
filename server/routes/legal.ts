import { Hono } from 'hono';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const legal = new Hono();

// Get the directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache the HTML content (read once at startup)
let privacyPolicyHtml: string | null = null;
let termsOfServiceHtml: string | null = null;

function getPrivacyPolicy(): string {
  if (!privacyPolicyHtml) {
    privacyPolicyHtml = readFileSync(
      join(__dirname, '../../store-compliance/privacy-policy.html'),
      'utf-8'
    );
  }
  return privacyPolicyHtml;
}

function getTermsOfService(): string {
  if (!termsOfServiceHtml) {
    termsOfServiceHtml = readFileSync(
      join(__dirname, '../../store-compliance/terms-of-service.html'),
      'utf-8'
    );
  }
  return termsOfServiceHtml;
}

// GET /legal/privacy - Serve Privacy Policy
legal.get('/privacy', (c) => {
  return c.html(getPrivacyPolicy());
});

// GET /legal/terms - Serve Terms of Service
legal.get('/terms', (c) => {
  return c.html(getTermsOfService());
});

export { legal };
