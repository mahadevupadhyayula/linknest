import { useState, useEffect } from 'react';
import { useSpaceRuntime } from '../SpaceRuntimeContext';
import type { DesktopThemeTokens } from '../types';

// Version marker for auto-upgrade detection
// Increment this when making breaking changes that stale copies need
export const EMAIL_GATE_VERSION = 16; // v16: Multi-step onboarding wizard with "Step X of 3" text indicators

interface EmailGateProps {
  spaceId: string;
  branding?: {
    name?: string;
    tagline?: string;
    logoUrl?: string;
  };
  themeTokens?: DesktopThemeTokens;
}

type GateStep = 'loading' | 'email' | 'code' | 'extension' | 'install' | 'complete';

// Derive a usable color set from a single hex primary color
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function colorWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export default function EmailGate({
  spaceId,
  branding,
  themeTokens,
}: EmailGateProps) {
  const { setSessionId } = useSpaceRuntime();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<GateStep>('loading');
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Get workspaceId from window context
  const workspaceId = (window as any).__WORKSPACE_ID__ || null;
  const gdprEnabled = !!(window as any).__GDPR_ENABLED__;

  useEffect(() => {
    storeAttribution();
    checkExistingSession();
  }, [spaceId]);

  // Pre-fill email from localStorage when loaded inside the onboarding walkthrough
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('walkthrough') === 'true') {
      const storedEmail = localStorage.getItem('user_email');
      if (storedEmail) setEmail(storedEmail);
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const checkExistingSession = async () => {
    const sessionKey = `space_session_${spaceId}`;
    const existingSession = localStorage.getItem(sessionKey);

    if (existingSession) {
      try {
        const session = JSON.parse(existingSession);
        const effectiveSessionId = session.workspaceSessionId || session.id;

        if (effectiveSessionId) {
          if (workspaceId) {
            try {
              const configRes = await fetch(`/api/auth/otp/space/config/${workspaceId}`);
              const configData = await configRes.json();
              const otpConfig = configData.config || configData;

              if (otpConfig.enabled) {
                setOtpEnabled(true);
                const checkRes = await fetch(`/api/auth/otp/space/check-session?workspaceId=${workspaceId}&sessionUuid=${encodeURIComponent(effectiveSessionId)}`, {
                  credentials: 'include'
                });
                const checkData = await checkRes.json();

                if (checkData.verified) {
                  setSessionId(effectiveSessionId);
                  setStep('complete');
                  return;
                } else {
                  setStep('email');
                  return;
                }
              }
            } catch (e) {
              console.log('[EmailGate] OTP config check failed, using simple mode');
            }
          }

          setSessionId(effectiveSessionId);
          setStep('complete');
          return;
        }
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }

    if (workspaceId) {
      try {
        const configRes = await fetch(`/api/auth/otp/space/config/${workspaceId}`);
        const configData = await configRes.json();
        const otpConfig = configData.config || configData;
        setOtpEnabled(otpConfig.enabled || false);
      } catch (e) {
        setOtpEnabled(false);
      }
    }

    setStep('email');
  };

  // Complete the onboarding and go to dashboard
  const completeOnboarding = () => {
    if (pendingSessionId) {
      setSessionId(pendingSessionId);
    }
    setStep('complete');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      if (otpEnabled && workspaceId) {
        const attribution = getAttribution();
        const visitorId = getVisitorId();
        const sessionId = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

        const registerRes = await fetch(`/api/space/${spaceId}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            sessionId,
            visitorId,
            attribution,
            metadata: {},
            workspaceId,
            marketingConsent,
          }),
        });

        const registerResult = await registerRes.json();

        if (!registerRes.ok) {
          setError(registerResult.error || 'Failed to create session');
          setLoading(false);
          return;
        }

        const wsSessionId = registerResult.workspaceSessionId;
        setPendingSessionId(wsSessionId);

        if (typeof (window as any).fbq === 'function' && (window as any).__META_PIXEL_ID__) {
          (window as any).fbq('init', (window as any).__META_PIXEL_ID__, { em: normalizedEmail.toLowerCase().trim() });
        }
        fireLeadEventWithRetry(normalizedEmail);

        const sessionKey = `space_session_${spaceId}`;
        const pendingSession = {
          id: wsSessionId,
          workspaceSessionId: wsSessionId,
          email: normalizedEmail,
          contactId: registerResult.contactId || null,
          timestamp: Date.now(),
          verified: registerResult.isReturningUser === false,
          isReturningUser: !!registerResult.isReturningUser,
          metadata: registerResult.metadata || {},
        };
        localStorage.setItem(sessionKey, JSON.stringify(pendingSession));

        if (registerResult.isReturningUser === false) {
          try {
            window.dispatchEvent(new CustomEvent('audos:session-established', {
              detail: { workspaceSessionId: wsSessionId, email: normalizedEmail },
            }));
          } catch (e) {}

          // NEW: Go to extension prompt instead of dashboard
          setStep('extension');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/auth/otp/space/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: normalizedEmail, workspaceId, sessionUuid: wsSessionId }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to send code');
          setLoading(false);
          return;
        }

        setResendCooldown(result.resendCooldown || 60);
        setStep('code');
      } else {
        await registerSession();
      }
    } catch (err) {
      console.error('[EmailGate] Error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 4) {
      setError('Please enter the 4-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (!pendingSessionId) {
        setError('Session expired. Please start over.');
        setStep('email');
        setLoading(false);
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();
      const response = await fetch('/api/auth/otp/space/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, code, workspaceId, sessionUuid: pendingSessionId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Invalid code');
        if (result.attemptsRemaining !== undefined) {
          setError(`Invalid code. ${result.attemptsRemaining} attempts remaining.`);
        }
        setLoading(false);
        return;
      }

      await completeVerifiedSession();
    } catch (err) {
      console.error('[EmailGate] Verification error:', err);
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !pendingSessionId) return;

    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const response = await fetch('/api/auth/otp/space/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, workspaceId, sessionUuid: pendingSessionId }),
      });

      const result = await response.json();

      if (response.ok) {
        setResendCooldown(result.resendCooldown || 60);
        setCode('');
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const completeVerifiedSession = async () => {
    const sessionKey = `space_session_${spaceId}`;
    const normalizedEmail = email.toLowerCase().trim();
    let verifiedMetadata: Record<string, unknown> = {};
    try {
      const existingSession = localStorage.getItem(sessionKey);
      if (existingSession) {
        const parsed = JSON.parse(existingSession);
        if (parsed.metadata) verifiedMetadata = parsed.metadata;
      }
    } catch {}
    const session = {
      id: pendingSessionId,
      workspaceSessionId: pendingSessionId,
      email: normalizedEmail,
      timestamp: Date.now(),
      verified: true,
      isReturningUser: true,
      metadata: verifiedMetadata,
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));

    try {
      window.dispatchEvent(new CustomEvent('audos:session-established', {
        detail: {
          workspaceSessionId: pendingSessionId,
          email: normalizedEmail,
        }
      }));
    } catch (e) {}

    // For returning users who verified via OTP, go to extension prompt
    setStep('extension');
    setLoading(false);
  };

  const registerSession = async () => {
    const normalizedEmail = email.toLowerCase().trim();
    const attribution = getAttribution();
    const visitorId = getVisitorId();
    const sessionId = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    const response = await fetch(`/api/space/${spaceId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        sessionId,
        visitorId,
        attribution,
        metadata: {},
        workspaceId,
        marketingConsent,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error || 'Registration failed. Please try again.');
      setLoading(false);
      return;
    }

    const effectiveSessionId = result.workspaceSessionId || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    setPendingSessionId(effectiveSessionId);

    const sessionKey = `space_session_${spaceId}`;
    const session = {
      id: effectiveSessionId,
      workspaceSessionId: result.workspaceSessionId || effectiveSessionId,
      email: normalizedEmail,
      contactId: result.contactId || null,
      timestamp: Date.now(),
      isReturningUser: !!result.isReturningUser,
      metadata: result.metadata || {},
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));

    try {
      window.dispatchEvent(new CustomEvent('audos:session-established', {
        detail: {
          workspaceSessionId: result.workspaceSessionId,
          email: normalizedEmail,
        }
      }));
    } catch (e) {}

    if (typeof (window as any).fbq === 'function' && (window as any).__META_PIXEL_ID__) {
      (window as any).fbq('init', (window as any).__META_PIXEL_ID__, { em: normalizedEmail.toLowerCase().trim() });
    }
    fireLeadEventWithRetry(normalizedEmail);

    // Go to extension prompt instead of dashboard
    setStep('extension');
    setLoading(false);
  };

  function getVisitorId(): string {
    const key = 'audos_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `v_${Math.random().toString(36).substring(2)}_${Date.now()}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getAttrCookie(): Record<string, string> | null {
    try {
      const raw = localStorage.getItem('audos_attribution');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setAttrCookie(jsonStr: string) {
    const ATTR_COOKIE_NAME = 'audos_attr';
    const MULTI_LEVEL_TLDS = ['co.uk','co.za','co.in','co.jp','co.kr','co.nz','com.au','com.br','com.cn','com.mx','com.sg','com.hk','com.tw','com.ar','com.co','com.eg','com.my','com.ng','com.pe','com.ph','com.pk','com.tr','com.ua','com.vn','org.uk','org.au','net.au','net.uk','ac.uk','gov.uk','gov.au','edu.au','ne.jp','or.jp'];
    const hostname = window.location.hostname;
    const platformDomains = [
      'replit.dev', 'replit.app', 'repl.co',
      'github.io', 'herokuapp.com', 'netlify.app', 'vercel.app',
      'pages.dev', 'workers.dev', 'web.app', 'firebaseapp.com',
      'azurewebsites.net', 'cloudfront.net', 'amazonaws.com',
      'ngrok.io', 'ngrok.app', 'railway.app', 'render.com',
      'fly.dev', 'deno.dev', 'glitch.me'
    ];
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    let isPlatform = false;
    for (let i = 0; i < platformDomains.length; i++) {
      if (hostname.endsWith('.' + platformDomains[i]) || hostname === platformDomains[i]) {
        isPlatform = true;
        break;
      }
    }
    let domainPart = '';
    if (!isLocalhost && !isIP && !isPlatform) {
      const parts = hostname.split('.');
      const lastTwo = parts.slice(-2).join('.');
      if (MULTI_LEVEL_TLDS.indexOf(lastTwo) !== -1 && parts.length >= 3) {
        domainPart = '; domain=.' + parts.slice(-3).join('.');
      } else if (parts.length >= 2) {
        domainPart = '; domain=.' + parts.slice(-2).join('.');
      }
    }
    const isSecure = window.location.protocol === 'https:';
    const secureFlag = isSecure ? '; Secure' : '';
    document.cookie = ATTR_COOKIE_NAME + '=' + encodeURIComponent(jsonStr) + '; max-age=86400; path=/' + domainPart + '; SameSite=Lax' + secureFlag;
  }

  function storeAttribution() {
    const params = new URLSearchParams(window.location.search);
    const hasUtm = params.has('utm_source') || params.has('utm_medium') || params.has('utm_campaign') || params.has('fbclid') || params.has('gclid') || params.has('ref');
    if (!hasUtm) return;

    const attr: Record<string, string> = { capturedAt: Date.now().toString() };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref'].forEach(p => {
      const v = params.get(p);
      if (v) attr[p === 'ref' ? 'referrer' : p.replace('utm_', 'utm').replace('_', '')] = v;
    });
    if (document.referrer) attr.httpReferrer = document.referrer;

    try {
      localStorage.setItem('audos_attribution', JSON.stringify(attr));
    } catch {}

    const cookieAttr: Record<string, string> = { capturedAt: new Date().toISOString() };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref'].forEach(p => {
      const v = params.get(p);
      if (v) cookieAttr[p] = v;
    });
    if (document.referrer) cookieAttr.httpReferrer = document.referrer;
    try {
      setAttrCookie(JSON.stringify(cookieAttr));
      console.log('[EmailGate] Attribution stored in cookie:', cookieAttr);
    } catch {}
  }

  async function fireLeadEventWithRetry(emailAddr: string, attempt = 0) {
    const tryFireFbq = (): boolean => {
      if (typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'Lead', {
          content_name: 'Email Capture',
          content_category: 'space',
        }, {
          em: emailAddr.toLowerCase().trim()
        });
        console.log('[EmailGate] Meta Pixel Lead event fired for:', emailAddr);
        return true;
      }
      return false;
    };

    if (!tryFireFbq()) {
      console.log('[EmailGate] fbq not ready, will retry with exponential backoff...');
      const maxRetries = 5;
      const delays = [100, 200, 400, 800, 1600];

      const retryWithBackoff = (retryAttempt: number) => {
        if (retryAttempt >= maxRetries) {
          console.warn('[EmailGate] Failed to fire Lead event - fbq never loaded after 5 retries');
          return;
        }
        setTimeout(() => {
          if (tryFireFbq()) {
            console.log(`[EmailGate] Lead event fired after ${retryAttempt + 1} retries`);
          } else {
            retryWithBackoff(retryAttempt + 1);
          }
        }, delays[retryAttempt]);
      };

      retryWithBackoff(0);
    }

    if (!workspaceId) return;
    try {
      await fetch(`/api/funnel/${workspaceId}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'lead', email: emailAddr, metadata: getAttribution() }),
      });
    } catch {
      if (attempt < 2) setTimeout(() => fireLeadEventWithRetry(emailAddr, attempt + 1), 2000);
    }
  }

  const getAttribution = () => {
    const params = new URLSearchParams(window.location.search);

    const urlAttribution: Record<string, string | null> = {};
    if (params.get('utm_source')) urlAttribution.utmSource = params.get('utm_source');
    if (params.get('utm_medium')) urlAttribution.utmMedium = params.get('utm_medium');
    if (params.get('utm_campaign')) urlAttribution.utmCampaign = params.get('utm_campaign');
    if (params.get('utm_content')) urlAttribution.utmContent = params.get('utm_content');
    if (params.get('utm_term')) urlAttribution.utmTerm = params.get('utm_term');
    if (params.get('fbclid')) urlAttribution.fbclid = params.get('fbclid');
    if (params.get('gclid')) urlAttribution.gclid = params.get('gclid');
    if (params.get('ref')) urlAttribution.referrer = params.get('ref');
    if (document.referrer) urlAttribution.httpReferrer = document.referrer;

    const storedAttr = getAttrCookie();

    const merged: Record<string, string | null> = {};
    if (storedAttr) {
      for (const [key, value] of Object.entries(storedAttr)) {
        if (value && key !== 'capturedAt') merged[key] = value;
      }
    }
    for (const [key, value] of Object.entries(urlAttribution)) {
      if (value) merged[key] = value;
    }

    return Object.keys(merged).length > 0 ? merged : null;
  };

  // Prefer the expanded palette when available, but keep the old primary-only fallback for older spaces.
  const palette = themeTokens?.palette || {};
  const primaryColor = palette?.primary || '#0ea5e9';
  const highlightColor = palette?.highlight || '#f97068';
  const contrastColor = palette?.contrast || '#ffffff';
  const brandName = branding?.name || 'LinkNest';
  const tagline = branding?.tagline || 'Where meaningful connections take flight.';
  const logoUrl = branding?.logoUrl;
  const bgLight = palette?.surfaces?.page || colorWithAlpha(primaryColor, 0.04);
  const bgMedium = palette?.surfaces?.accentSoft || colorWithAlpha(primaryColor, 0.08);
  const borderColor = palette?.surfaces?.border || colorWithAlpha(primaryColor, 0.15);
  const panelColor = themeTokens?.shell?.panelBackground || palette?.surfaces?.panel || '#ffffff';
  const panelStrongColor =
    themeTokens?.shell?.panelStrongBackground || palette?.surfaces?.panelStrong || '#ffffff';
  const pageBackground = themeTokens?.shell?.pageBackground || palette?.surfaces?.page || '#ffffff';
  const sectionBackground = palette?.surfaces?.muted || '#f9fafb';

  // Sky blue to rose gradient for onboarding (matching existing design)
  const onboardingGradient = 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 40%, #fecdd3 100%)';

  const textPrimary = palette?.text?.brand || primaryColor;
  const textMuted = palette?.text?.secondary || colorWithAlpha(primaryColor, 0.55);
  const textSubtle = palette?.text?.muted || colorWithAlpha(primaryColor, 0.35);
  const onPrimary = palette?.text?.onPrimary || '#ffffff';

  // Brand logo mark
  const BrandMark = ({ size = 40 }: { size?: number }) => {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={brandName}
          style={{ width: size, height: size, objectFit: 'contain', borderRadius: 8 }}
        />
      );
    }
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.25,
          backgroundColor: primaryColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: onPrimary,
          fontWeight: 700,
          fontSize: size * 0.4,
          fontFamily: 'system-ui, sans-serif',
          flexShrink: 0,
        }}
      >
        {brandName.charAt(0).toUpperCase()}
      </div>
    );
  };

  // Progress indicator component - shows "Step X of 3" text
  const ProgressIndicator = ({ currentStep }: { currentStep: 1 | 2 | 3 }) => {
    return (
      <div className="text-center mb-6">
        <span
          className="text-sm font-medium px-4 py-1.5 rounded-full inline-block"
          style={{
            backgroundColor: colorWithAlpha(primaryColor, 0.1),
            color: primaryColor,
          }}
        >
          Step {currentStep} of 3
        </span>
      </div>
    );
  };

  // DM Sans font import
  const fontLink = `https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap`;

  useEffect(() => {
    // Add font link if not already present
    if (!document.querySelector(`link[href="${fontLink}"]`)) {
      const link = document.createElement('link');
      link.href = fontLink;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  const fontFamily = "'DM Sans', system-ui, -apple-system, sans-serif";

  if (step === 'loading' || step === 'complete') {
    return null;
  }

  // ===== STEP 3: Installation Guide =====
  if (step === 'install') {
    return (
      <div
        className="min-h-screen flex flex-col overflow-y-auto"
        style={{ fontFamily, background: onboardingGradient }}
      >
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* White card container */}
            <div
              className="rounded-3xl p-8 sm:p-10"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              }}
            >
              {/* Brand mark */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <BrandMark size={32} />
                <span className="text-lg font-bold" style={{ color: '#0f172a' }}>
                  {brandName}
                </span>
              </div>

              {/* Progress indicator */}
              <ProgressIndicator currentStep={3} />

              {/* Headline */}
              <div className="text-center mb-8">
                <h1
                  className="text-2xl sm:text-3xl font-bold mb-3"
                  style={{ color: '#0f172a' }}
                >
                  Installing LinkNest
                </h1>
                <p className="text-sm" style={{ color: '#64748b' }}>
                  Follow these quick steps to get started
                </p>
              </div>

              {/* Installation steps */}
              <div className="space-y-5 mb-8">
                {[
                  {
                    num: 1,
                    icon: '🏪',
                    title: `Click "Add to Chrome" in the Chrome Web Store`,
                    desc: 'The extension will download automatically'
                  },
                  {
                    num: 2,
                    icon: '📌',
                    title: 'Pin the extension to your toolbar for easy access',
                    desc: 'Click the puzzle icon, then pin LinkNest'
                  },
                  {
                    num: 3,
                    icon: '🔑',
                    title: 'Click the LinkNest icon and log in with your email',
                    desc: `Use ${email || 'your email'} to sync your account`
                  }
                ].map((item) => (
                  <div
                    key={item.num}
                    className="flex gap-4 items-start p-4 rounded-xl"
                    style={{ backgroundColor: '#f8fafc' }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ backgroundColor: colorWithAlpha(primaryColor, 0.1) }}
                    >
                      {item.icon}
                    </div>
                    <div className="pt-0.5">
                      <h3 className="font-semibold text-sm mb-0.5" style={{ color: '#0f172a' }}>
                        {item.title}
                      </h3>
                      <p className="text-xs" style={{ color: '#64748b' }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Primary CTA */}
              <button
                onClick={completeOnboarding}
                className="w-full py-4 rounded-xl font-semibold text-base transition-all mb-4"
                style={{
                  backgroundColor: highlightColor,
                  color: '#ffffff',
                  boxShadow: `0 4px 14px ${colorWithAlpha(highlightColor, 0.4)}`,
                }}
              >
                {`I've Installed It — Go to Dashboard`}
              </button>

              {/* Back link */}
              <button
                onClick={() => setStep('extension')}
                className="w-full text-center text-sm font-medium transition-colors"
                style={{ color: '#64748b' }}
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== STEP 2: Extension Prompt =====
  if (step === 'extension') {
    return (
      <div
        className="min-h-screen flex flex-col overflow-y-auto"
        style={{ fontFamily, background: onboardingGradient }}
      >
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* White card container */}
            <div
              className="rounded-3xl p-8 sm:p-10"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              }}
            >
              {/* Brand mark */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <BrandMark size={32} />
                <span className="text-lg font-bold" style={{ color: '#0f172a' }}>
                  {brandName}
                </span>
              </div>

              {/* Progress indicator */}
              <ProgressIndicator currentStep={2} />

              {/* Chrome extension icon */}
              <div className="flex justify-center mb-6">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: colorWithAlpha(primaryColor, 0.1) }}
                >
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="10" stroke={primaryColor} strokeWidth="2" />
                    <circle cx="12" cy="12" r="4" fill={primaryColor} />
                    <path d="M12 2C6.48 2 2 6.48 2 12h10V2z" fill={colorWithAlpha(primaryColor, 0.3)} />
                    <path d="M12 12l8.66 5c-1.73 3-4.98 5-8.66 5V12z" fill={colorWithAlpha(highlightColor, 0.5)} />
                  </svg>
                </div>
              </div>

              {/* Headline */}
              <div className="text-center mb-8">
                <h1
                  className="text-2xl sm:text-3xl font-bold mb-3"
                  style={{ color: '#0f172a' }}
                >
                  One More Step — Get the Chrome Extension
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
                  LinkNest works by tracking your LinkedIn activity in the background. Install the extension to unlock the full experience.
                </p>
              </div>

              {/* Feature highlights */}
              <div className="space-y-3 mb-8">
                {[
                  { icon: '📊', text: 'Automatically track LinkedIn interactions' },
                  { icon: '🔔', text: 'Get notified when to follow up' },
                  { icon: '✨', text: 'AI-powered engagement suggestions' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm"
                    style={{ color: '#334155' }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              {/* Primary CTA - Download Extension */}
              <button
                onClick={() => {
                  // Open Chrome Web Store (placeholder link) in new tab
                  window.open('#', '_blank');
                  // Advance to installation guide
                  setStep('install');
                }}
                className="w-full py-4 rounded-xl font-semibold text-base text-center transition-all mb-4"
                style={{
                  backgroundColor: highlightColor,
                  color: '#ffffff',
                  boxShadow: `0 4px 14px ${colorWithAlpha(highlightColor, 0.4)}`,
                }}
              >
                Download Extension
              </button>

              {/* Skip link */}
              <button
                onClick={completeOnboarding}
                className="w-full text-center text-sm font-medium transition-colors"
                style={{ color: '#64748b' }}
              >
                Skip for now →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // OTP Code verification screen
  if (step === 'code') {
    return (
      <div
        className="min-h-screen flex flex-col overflow-y-auto"
        style={{ fontFamily, backgroundColor: sectionBackground }}
      >
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="text-center mb-10">
              <div className="flex justify-center mb-4">
                <BrandMark size={48} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: textPrimary }}>
                Check your inbox
              </h1>
              <p className="mt-2 text-sm" style={{ color: textMuted }}>
                We sent a 4-digit code to<br />
                <span className="font-medium" style={{ color: textPrimary }}>{email}</span>
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-5">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setCode(val);
                    setError('');
                  }}
                  placeholder="0000"
                  className="w-full px-4 py-3.5 text-center text-2xl tracking-[0.5em] font-mono rounded-xl focus:outline-none transition-all"
                  style={{
                    backgroundColor: panelColor,
                    border: `2px solid ${error ? '#DC2626' : borderColor}`,
                    color: textPrimary,
                  }}
                  disabled={loading}
                  autoFocus
                  data-testid="input-code"
                />
                {error && (
                  <p className="mt-2 text-xs text-red-600" data-testid="text-error">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 4}
                className="w-full py-3.5 rounded-xl font-semibold text-base transition-all"
                style={{
                  backgroundColor: loading || code.length !== 4 ? colorWithAlpha(primaryColor, 0.3) : primaryColor,
                  color: onPrimary,
                  cursor: loading || code.length !== 4 ? 'not-allowed' : 'pointer',
                }}
                data-testid="button-verify"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>

            <div className="text-center mt-6 space-x-4">
              <button
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || loading}
                className="text-sm transition-colors"
                style={{ color: resendCooldown > 0 ? textSubtle : textPrimary }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
              <span style={{ color: textSubtle }}>|</span>
              <button
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="text-sm transition-colors"
                style={{ color: textMuted }}
              >
                Change email
              </button>
            </div>
          </div>
        </div>

        <div className="pb-8 text-center">
          <p className="text-xs" style={{ color: textSubtle }}>
            Your data is private and secure
          </p>
        </div>
      </div>
    );
  }

  // ===== STEP 1: Email Entry (Main landing page) =====
  return (
    <div
      className="min-h-screen overflow-y-auto"
      style={{ fontFamily, backgroundColor: pageBackground }}
    >

      {/* ===== HERO SECTION ===== */}
      <section
        className="min-h-screen flex flex-col justify-center px-6 py-16 relative"
        style={{ background: onboardingGradient }}
      >

        <div className="max-w-lg mx-auto w-full">
          {/* Frosted glass content backdrop for improved text visibility */}
          <div
            className="rounded-3xl p-6 sm:p-10"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
            }}
          >
            {/* Brand mark */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <BrandMark size={36} />
              <span
                className="text-xl font-bold"
                style={{
                  color: textPrimary,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
              >
                {brandName}
              </span>
            </div>

            {/* Progress indicator for Step 1 */}
            <ProgressIndicator currentStep={1} />

            {/* Hero headline */}
            <div className="text-center mb-8">
              <h1
                className="text-3xl sm:text-4xl leading-tight mb-4"
                style={{
                  color: '#0f172a',
                  fontWeight: 800,
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                  letterSpacing: '-0.02em',
                }}
              >
                Transform Your LinkedIn Network Into Real Opportunities
              </h1>
              <p
                className="text-base sm:text-lg leading-relaxed max-w-md mx-auto"
                style={{
                  color: '#334155',
                  fontWeight: 500,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                }}
              >
                Stop letting connections go cold. Access the Engagement Tracker to visualize your LinkedIn relationships and Smart Drafts for personalized content suggestions.
              </p>
            </div>

            {/* Key benefits strip */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 text-sm">
                {[
                  { icon: '📊', text: 'Track every LinkedIn interaction' },
                  { icon: '✍️', text: 'Get personalized content suggestions' },
                  { icon: '⏱️', text: 'Save 10+ hours weekly on networking' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 justify-center"
                    style={{
                      color: '#1e293b',
                      fontWeight: 600,
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Email form card */}
            <div
              className="rounded-2xl p-6 sm:p-8"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: `0 4px 24px ${colorWithAlpha(primaryColor, 0.12)}, 0 1px 3px ${colorWithAlpha(primaryColor, 0.06)}`,
                border: `1px solid ${colorWithAlpha(primaryColor, 0.15)}`,
              }}
            >
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="your@email.com"
                  className="w-full px-4 py-4 text-base rounded-xl focus:outline-none transition-all"
                  style={{
                    backgroundColor: sectionBackground,
                    border: `2px solid ${error ? '#DC2626' : borderColor}`,
                    color: textPrimary,
                  }}
                  disabled={loading}
                  required
                  autoFocus
                  data-testid="input-email"
                />
                {error && (
                  <p className="mt-2 text-xs text-red-600" data-testid="text-error">
                    {error}
                  </p>
                )}
              </div>

              {gdprEnabled && (
                <div
                  className="space-y-2 rounded-lg px-3 py-2 text-xs"
                  style={{ backgroundColor: '#f8fafc', color: '#475569' }}
                >
                  <p>
                    By entering your email, you agree to our{' '}
                    <a href="/privacy" className="font-medium underline" style={{ color: '#0f172a' }}>
                      Privacy Policy
                    </a>.
                  </p>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                    />
                    <span>I want to receive marketing emails and updates (optional)</span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-4 rounded-xl font-semibold text-base transition-all"
                style={{
                  backgroundColor: loading || !email ? colorWithAlpha(highlightColor, 0.35) : highlightColor,
                  color: onPrimary,
                  cursor: loading || !email ? 'not-allowed' : 'pointer',
                  boxShadow: loading || !email ? 'none' : `0 4px 14px ${colorWithAlpha(highlightColor, 0.3)}`,
                }}
                data-testid="button-continue"
              >
                {loading ? 'One moment...' : 'Get Started'}
              </button>
            </form>

              <p
                className="text-center mt-4 text-xs"
                style={{
                  color: '#64748b',
                  fontWeight: 500,
                }}
              >
                We respect your privacy. No spam, ever.
              </p>
            </div>
            {/* End of email form card */}
          </div>
          {/* End of frosted glass container */}
        </div>
      </section>

      {/* ===== VALUE PROPS SECTION ===== */}
      <section className="px-6 py-16" style={{ backgroundColor: sectionBackground }}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3" style={{ color: textPrimary }}>
            The three problems holding your LinkedIn back
          </h2>
          <p className="text-center mb-10" style={{ color: textMuted }}>
            LinkNest solves the challenges that keep professionals from building meaningful connections.
          </p>

          <div className="space-y-4">
            {[
              {
                icon: '🔗',
                problem: 'Connections go nowhere',
                title: 'Engagement Tracker',
                desc: 'Visualize every LinkedIn relationship from cold contact to active conversation. Never let a warm lead go cold again.'
              },
              {
                icon: '✍️',
                problem: 'Generic content gets ignored',
                title: 'Smart Drafts',
                desc: 'Generate personalized comments, DMs, and posts tailored to what your target connections actually care about.'
              },
              {
                icon: '📋',
                problem: 'Losing track of everyone',
                title: 'Systematic relationship building',
                desc: 'Transform random outreach into structured, intentional networking that compounds over time.'
              }
            ].map((item, i) => (
              <div
                key={i}
                className="p-5 rounded-xl"
                style={{ backgroundColor: panelColor, border: `1px solid ${borderColor}` }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: highlightColor }}>
                    {item.problem}
                  </span>
                </div>
                <h3 className="font-semibold mb-1" style={{ color: textPrimary }}>
                  {item.title}
                </h3>
                <p className="text-sm" style={{ color: textMuted }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS SECTION ===== */}
      <section className="px-6 py-16" style={{ backgroundColor: pageBackground }}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3" style={{ color: textPrimary }}>
            Start building meaningful connections
          </h2>
          <p className="text-center mb-10" style={{ color: textMuted }}>
            Get started in minutes, see results within your first week.
          </p>

          <div className="space-y-6">
            {[
              { step: '1', title: 'Sign up with your email', desc: 'Instant access to both Engagement Tracker and Smart Drafts. No credit card required.' },
              { step: '2', title: 'Install the Chrome extension', desc: 'LinkNest works in the background to track your LinkedIn interactions automatically.' },
              { step: '3', title: 'Engage with personalized content', desc: 'Generate AI-powered comments and messages that resonate with your target connections.' }
            ].map((item, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm"
                  style={{ backgroundColor: colorWithAlpha(primaryColor, 0.1), color: primaryColor }}
                >
                  {item.step}
                </div>
                <div className="pt-1">
                  <h3 className="font-semibold mb-1" style={{ color: textPrimary }}>
                    {item.title}
                  </h3>
                  <p className="text-sm" style={{ color: textMuted }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CREDIBILITY SECTION ===== */}
      <section className="px-6 py-16" style={{ backgroundColor: sectionBackground }}>
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: textPrimary }}>
            Built for LinkedIn professionals who want results
          </h2>
          <p className="mb-10" style={{ color: textMuted }}>
            Whether you are job searching, recruiting, or growing your professional network.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { value: '3x', label: 'More replies on outreach' },
              { value: '10+', label: 'Hours saved weekly' },
              { value: '100%', label: 'Free to start' }
            ].map((stat, i) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{ backgroundColor: panelColor, border: `1px solid ${borderColor}` }}
              >
                <div className="text-2xl font-bold mb-1" style={{ color: primaryColor }}>
                  {stat.value}
                </div>
                <div className="text-xs" style={{ color: textMuted }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div
            className="p-5 rounded-xl text-left"
            style={{ backgroundColor: panelStrongColor, border: `1px solid ${borderColor}` }}
          >
            <p className="text-sm mb-3" style={{ color: textPrimary }}>
              LinkNest transforms random outreach into systematic relationship building. We help you maintain meaningful connections that lead to real opportunities — jobs, partnerships, or expanding your network with decision-makers in your industry.
            </p>
            <p className="text-sm font-medium" style={{ color: textMuted }}>
              — The LinkNest Team
            </p>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA SECTION ===== */}
      <section
        className="px-6 py-16"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${colorWithAlpha(primaryColor, 0.85)} 100%)`, color: onPrimary }}
      >
        <div className="max-w-lg mx-auto text-center">
          <div className="flex justify-center mb-6">
            <BrandMark size={44} />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Start building meaningful connections today
          </h2>
          <p className="mb-8 opacity-90 text-sm sm:text-base">
            Access your Engagement Tracker and Smart Drafts. Free to use, no credit card needed.
          </p>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="your@email.com"
              className="w-full px-4 py-4 text-base rounded-xl focus:outline-none"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                color: onPrimary,
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
              disabled={loading}
              required
            />
            {error && (
              <p className="text-xs text-red-300">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-4 rounded-xl font-semibold text-base transition-all"
              style={{
                backgroundColor: loading || !email ? 'rgba(255,255,255,0.25)' : '#ffffff',
                color: loading || !email ? 'rgba(255,255,255,0.6)' : primaryColor,
                cursor: loading || !email ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'One moment...' : 'Get Started'}
            </button>
          </form>

          <p className="mt-4 text-xs opacity-70">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="px-6 py-10" style={{ backgroundColor: pageBackground, borderTop: `1px solid ${borderColor}` }}>
        <div className="max-w-lg mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BrandMark size={22} />
            <span className="font-semibold text-sm" style={{ color: textPrimary }}>
              {brandName}
            </span>
          </div>
          <p className="text-sm mb-4" style={{ color: textMuted }}>
            {tagline}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs" style={{ color: '#64748b', fontWeight: 500 }}>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <span>•</span>
            <span>© {new Date().getFullYear()} {brandName}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
