import React, { useState, useEffect, useRef } from 'react';

// === SECTION 1: IMPORTS AND TYPES ===

interface FAQItem {
  question: string;
  answer: string;
}

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
}

interface Benefit {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface ProblemItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

// === SECTION 2: CONSTANTS AND CONFIGURATION ===

const WORKSPACE_BRAND_NAME = 'LinkNest';
const WORKSPACE_TAGLINE = 'Where meaningful connections take flight.';
const WORKSPACE_PRIMARY_COLOR = '#0ea5e9';
const WORKSPACE_HIGHLIGHT_COLOR = '#f97068';
const WORKSPACE_CONTRAST_COLOR = '#10b981';
const WORKSPACE_TYPOGRAPHY = 'DM Sans';
const WORKSPACE_LOGO_URL = 'https://storage.googleapis.com/audos-images/logo-studio/8dc7b7d3-f265-4002-a791-19e18b94e14d/8bf0001f-99df-4fc7-bfcf-6f85df883e07.png';
const WORKSPACE_LOGO_ON_DARK_URL = '';
const WORKSPACE_SPACE_URL = '/space/workspace-595217';
const WORKSPACE_HERO_VIDEO_URL = 'https://storage.googleapis.com/audos-images/generated-videos/models_veo-3.1-generate-preview_operations_axfc5ioec7ph.mp4';
const WORKSPACE_API_URL = window.location.hostname.includes('v2.audos.com') ? 'https://v2.audos.com' : window.location.origin;
const WORKSPACE_WS_URL = window.location.hostname.includes('v2.audos.com') ? 'wss://v2.audos.com' : (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
];

const PROBLEMS: ProblemItem[] = [
  {
    title: 'Connections Go Nowhere',
    description: 'You send connection requests, they get accepted, and then... nothing. No conversations, no opportunities, just another number in your network.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" fill={`${WORKSPACE_HIGHLIGHT_COLOR}10`} />
        <path d="M14 20H26M14 20L18 16M14 20L18 24" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Generic Content Gets Ignored',
    description: 'Your posts get lost in the feed. Your messages sound like everyone else. Decision-makers scroll right past because nothing stands out.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" fill={`${WORKSPACE_HIGHLIGHT_COLOR}10`} />
        <path d="M15 15L25 25M25 15L15 25" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'You Lose Track of Everyone',
    description: `Who did you message last week? Which hiring manager showed interest? Without a system, warm leads go cold and opportunities slip away.`,
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" fill={`${WORKSPACE_HIGHLIGHT_COLOR}10`} />
        <path d="M20 14V20L24 24" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 26C15 26 17 28 20 28C23 28 25 26 25 26" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    number: '01',
    title: 'Install the Extension',
    description: 'Add the LinkNest Chrome extension to your browser in under a minute. No complex setup, no LinkedIn credentials required.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="8" width="32" height="32" rx="8" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" fill={`${WORKSPACE_PRIMARY_COLOR}10`} />
        <path d="M24 18V30M18 24H30" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Connect Your Profile',
    description: 'Link your LinkedIn account securely. We never store your credentials or post on your behalf without explicit permission.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="16" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" fill={`${WORKSPACE_PRIMARY_COLOR}10`} />
        <circle cx="24" cy="20" r="5" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" />
        <path d="M16 34C16 30 19.5 27 24 27C28.5 27 32 30 32 34" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Start Building Relationships',
    description: 'Get personalized suggestions, track your interactions, and watch your network transform from contacts into real opportunities.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M12 36L20 28L28 32L36 20" stroke={WORKSPACE_CONTRAST_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="36" r="3" fill={WORKSPACE_CONTRAST_COLOR} />
        <circle cx="20" cy="28" r="3" fill={WORKSPACE_CONTRAST_COLOR} />
        <circle cx="28" cy="32" r="3" fill={WORKSPACE_CONTRAST_COLOR} />
        <circle cx="36" cy="20" r="3" fill={WORKSPACE_CONTRAST_COLOR} />
      </svg>
    ),
  },
];

const FEATURES: Feature[] = [
  {
    title: 'Engagement Tracker',
    description: 'Log and visualize every LinkedIn interaction to map relationship progression from cold contact to active conversation.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" fill={`${WORKSPACE_PRIMARY_COLOR}15`} />
        <path d="M14 28L20 22L26 26L34 18" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="28" r="2.5" fill={WORKSPACE_HIGHLIGHT_COLOR} />
        <circle cx="20" cy="22" r="2.5" fill={WORKSPACE_HIGHLIGHT_COLOR} />
        <circle cx="26" cy="26" r="2.5" fill={WORKSPACE_HIGHLIGHT_COLOR} />
        <circle cx="34" cy="18" r="2.5" fill={WORKSPACE_HIGHLIGHT_COLOR} />
      </svg>
    ),
    details: [
      'Visual timeline of every interaction',
      'Relationship stage indicators (Cold → Warm → Hot)',
      'Automated logging of comments, likes, and DMs',
      'Priority scoring for high-value connections',
    ],
  },
  {
    title: 'Smart Drafts',
    description: 'Generate personalized LinkedIn comments, posts, and DMs tailored to what your target connections are posting and caring about.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" fill={`${WORKSPACE_PRIMARY_COLOR}15`} />
        <path d="M16 32L18 26L30 14L34 18L22 30L16 32Z" stroke={WORKSPACE_CONTRAST_COLOR} strokeWidth="2" strokeLinejoin="round" fill={`${WORKSPACE_CONTRAST_COLOR}20`} />
        <path d="M28 16L32 20" stroke={WORKSPACE_CONTRAST_COLOR} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    details: [
      'AI-powered comment suggestions',
      'Context-aware DM templates',
      'Tone matching for authentic engagement',
      'Post ideas based on trending topics in your network',
    ],
  },
];

const BENEFITS: Benefit[] = [
  {
    title: 'Save 10+ Hours Weekly',
    description: 'Automate the research and drafting that eats up your networking time. Focus on building real relationships instead.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" />
        <path d="M16 8V16L22 20" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Never Lose Track',
    description: 'Every interaction is logged automatically. Know exactly where each relationship stands and what to do next.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="6" width="24" height="20" rx="3" stroke={WORKSPACE_CONTRAST_COLOR} strokeWidth="2" />
        <path d="M4 12H28" stroke={WORKSPACE_CONTRAST_COLOR} strokeWidth="2" />
        <circle cx="10" cy="20" r="2" fill={WORKSPACE_CONTRAST_COLOR} />
        <circle cx="16" cy="20" r="2" fill={WORKSPACE_CONTRAST_COLOR} />
      </svg>
    ),
  },
  {
    title: '3x More Replies',
    description: 'Personalized outreach gets results. Our users see 3x more responses compared to generic LinkedIn messages.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M6 24V12L16 6L26 12V24L16 30L6 24Z" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" fill={`${WORKSPACE_HIGHLIGHT_COLOR}15`} />
        <path d="M16 18V22" stroke={WORKSPACE_HIGHLIGHT_COLOR} strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="14" r="1.5" fill={WORKSPACE_HIGHLIGHT_COLOR} />
      </svg>
    ),
  },
  {
    title: 'Authentic Engagement',
    description: 'No spammy automation. Every draft is crafted to sound like you, building genuine trust with decision-makers.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 6C12 6 8 10 8 14C8 22 16 28 16 28C16 28 24 22 24 14C24 10 20 6 16 6Z" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" fill={`${WORKSPACE_PRIMARY_COLOR}15`} />
        <path d="M12 14L15 17L20 12" stroke={WORKSPACE_PRIMARY_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const FAQ_ITEMS: FAQItem[] = [
  {
    question: `How does ${WORKSPACE_BRAND_NAME} work?`,
    answer: `${WORKSPACE_BRAND_NAME} is a browser extension that integrates directly with LinkedIn. It monitors your interactions, tracks relationship progress with key contacts, and uses AI to generate personalized content suggestions — comments, DMs, and posts — that help you engage meaningfully with decision-makers in your industry.`,
  },
  {
    question: 'Is this just another LinkedIn automation tool?',
    answer: `Not at all. ${WORKSPACE_BRAND_NAME} is designed for authentic engagement, not spammy automation. We don't auto-send messages or mass-connect. Instead, we help you craft genuine, personalized content that sounds like you. Think of it as a smart assistant for your networking strategy.`,
  },
  {
    question: `How do I get started with ${WORKSPACE_BRAND_NAME}?`,
    answer: `Getting started is simple: sign up for a free account, install the Chrome extension, and connect your LinkedIn profile. ${WORKSPACE_BRAND_NAME} will begin tracking your interactions and offering personalized suggestions within minutes. No complex setup required.`,
  },
  {
    question: 'Is my LinkedIn data safe?',
    answer: `Absolutely. We take privacy seriously. ${WORKSPACE_BRAND_NAME} only accesses the data you explicitly allow, and we never store your LinkedIn credentials. All data is encrypted in transit and at rest. We comply with GDPR and LinkedIn's terms of service.`,
  },
  {
    question: `What's included in the free plan?`,
    answer: `The free plan includes engagement tracking for up to 50 connections, 10 Smart Draft suggestions per week, and basic relationship stage mapping. Premium plans unlock unlimited tracking, unlimited drafts, advanced analytics, and priority support.`,
  },
  {
    question: 'Does it work for both job seekers and recruiters?',
    answer: `Yes! Whether you're a job seeker trying to connect with hiring managers, a recruiter sourcing top talent, or a sales professional building pipeline — ${WORKSPACE_BRAND_NAME} adapts to your networking goals and helps you engage the right people with the right message.`,
  },
];

// === SECTION 3: UTILITY FUNCTIONS ===

const scrollToSection = (href: string) => {
  const id = href.replace('#', '');
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

// === SECTION 4: HERO SECTION ===

const ConnectionNodes: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let nodes: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const init = () => {
      resize();
      nodes = [];
      const count = Math.min(40, Math.floor((canvas.width * canvas.height) / 15000));
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 2 + 1.5,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.12 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();

        // Update position
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      });

      animId = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener('resize', init);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', init);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-[2] pointer-events-none"
    />
  );
};

const HeroSection: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      id="hero"
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
    >
      {/* Background */}
      {WORKSPACE_HERO_VIDEO_URL ? (
        <video
          src={WORKSPACE_HERO_VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      ) : (
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `linear-gradient(135deg, #0c2340 0%, ${WORKSPACE_PRIMARY_COLOR} 50%, ${WORKSPACE_HIGHLIGHT_COLOR} 100%)`,
          }}
        />
      )}

      {/* Connection Nodes Animation */}
      <ConnectionNodes />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 z-[3]" />

      {/* Content */}
      <div
        className={`relative z-10 text-center px-4 max-w-4xl mx-auto transition-all duration-1000 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}
      >
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-8 border border-white/20"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
        >
          <span data-section="hero-badge">LinkedIn relationship management for professionals</span>
        </div>

        <h1
          data-section="hero-title"
          className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight"
        >
          Build Relationships That
          <br />
          <span
            style={{
              background: `linear-gradient(90deg, ${WORKSPACE_HIGHLIGHT_COLOR}, ${WORKSPACE_CONTRAST_COLOR})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Lead to Opportunities
          </span>
        </h1>

        <p
          data-section="hero-subtitle"
          className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto"
        >
          Stop sending connection requests into the void. Track every interaction,
          craft personalized outreach, and turn your LinkedIn network into jobs, hires, and partnerships.
        </p>

        <p
          data-section="hero-description"
          className="text-base md:text-lg text-white/70 mb-10 max-w-xl mx-auto"
        >
          A systematic, human-feeling approach to LinkedIn networking that actually moves the needle.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="https://audos.com/space/workspace-595217"
            data-section="cta-primary"
            className="inline-block px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg"
            style={{
              backgroundColor: WORKSPACE_HIGHLIGHT_COLOR,
              color: '#1a1a1a',
            }}
          >
            Start Building Better Relationships
          </a>
          <button
            data-section="cta-secondary"
            onClick={() => scrollToSection('#how-it-works')}
            className="inline-block px-8 py-4 rounded-xl text-lg font-semibold text-white border border-white/30 hover:bg-white/10 transition-all duration-300"
          >
            See How It Works
          </button>
        </div>

        {/* Trust indicators */}
        <div className="mt-12 flex flex-wrap justify-center items-center gap-6 text-white/50 text-sm">
          <span data-section="hero-trust-1">Free plan available</span>
          <span data-section="hero-trust-2">No LinkedIn credentials stored</span>
          <span data-section="hero-trust-3">Set up in 2 minutes</span>
        </div>
      </div>
    </section>
  );
};

// === SECTION 4B: PROBLEM SECTION ===

const ProblemSection: React.FC = () => {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setVisibleItems((prev) => new Set(prev).add(index));
          }
        });
      },
      { threshold: 0.3 }
    );

    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24" id="problem" style={{ backgroundColor: '#f8fafc' }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-16">
          <span
            data-section="problem-label"
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
            style={{
              backgroundColor: `${WORKSPACE_HIGHLIGHT_COLOR}15`,
              color: WORKSPACE_HIGHLIGHT_COLOR,
            }}
          >
            The Problem
          </span>
          <h2
            data-section="problem-title"
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{
              color: '#0c2340',
              fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
            }}
          >
            LinkedIn Networking Feels Like Shouting Into the Void
          </h2>
          <p data-section="problem-subtitle" className="text-lg text-gray-500 max-w-2xl mx-auto">
            You know networking matters. But the way most people do it on LinkedIn just does not work.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {PROBLEMS.map((problem, index) => (
            <div
              key={index}
              ref={(el) => { itemRefs.current[index] = el; }}
              data-index={index}
              className={`p-8 bg-white rounded-2xl shadow-lg border border-gray-100 transition-all duration-700 ${
                visibleItems.has(index)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="mb-4">{problem.icon}</div>
              <h3
                data-section={`problem-${index + 1}-title`}
                className="text-xl font-bold mb-3"
                style={{
                  color: '#0c2340',
                  fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
                }}
              >
                {problem.title}
              </h3>
              <p
                data-section={`problem-${index + 1}-desc`}
                className="text-gray-600 leading-relaxed"
              >
                {problem.description}
              </p>
            </div>
          ))}
        </div>

        {/* Transition to solution */}
        <div className="text-center mt-16">
          <p
            data-section="problem-transition"
            className="text-xl text-gray-700 font-medium"
            style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}
          >
            There is a better way. A systematic approach that feels authentic, not spammy.
          </p>
        </div>
      </div>
    </section>
  );
};

// === SECTION 5: FEATURES SECTION ===

const FeaturesSection: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setVisibleCards((prev) => new Set(prev).add(index));
            setActiveFeature(index);
          }
        });
      },
      { threshold: 0.5 }
    );

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const renderPreview = (index: number) => {
    if (index === 0) {
      // Engagement Tracker Preview
      return (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: WORKSPACE_PRIMARY_COLOR }}
            >
              JD
            </div>
            <div>
              <p className="font-semibold text-gray-900" data-section="preview-name">
                Jane Doe
              </p>
              <p className="text-sm text-gray-500">VP of Engineering @ TechCorp</p>
            </div>
            <span
              className="ml-auto text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: `${WORKSPACE_CONTRAST_COLOR}20`,
                color: WORKSPACE_CONTRAST_COLOR,
              }}
            >
              Warm Lead
            </span>
          </div>

          {/* Progress Pipeline */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>Cold</span>
              <span>Connected</span>
              <span>Engaged</span>
              <span>Active</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: '65%',
                  background: `linear-gradient(90deg, ${WORKSPACE_PRIMARY_COLOR}, ${WORKSPACE_CONTRAST_COLOR})`,
                }}
              />
            </div>
          </div>

          {/* Interaction Timeline */}
          <div className="space-y-3">
            {[
              { action: 'Commented on post', time: '2h ago', type: 'comment' },
              { action: 'Liked your article', time: '1d ago', type: 'like' },
              { action: 'Accepted connection', time: '3d ago', type: 'connect' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-sm"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs"
                  style={{
                    backgroundColor:
                      item.type === 'comment'
                        ? WORKSPACE_PRIMARY_COLOR
                        : item.type === 'like'
                        ? WORKSPACE_HIGHLIGHT_COLOR
                        : WORKSPACE_CONTRAST_COLOR,
                  }}
                >
                  {item.type === 'comment' ? '💬' : item.type === 'like' ? '❤️' : '🤝'}
                </div>
                <span className="text-gray-700 flex-1">{item.action}</span>
                <span className="text-gray-400">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Smart Drafts Preview
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: WORKSPACE_HIGHLIGHT_COLOR }}
          >
            AI Draft
          </div>
          <span className="text-sm text-gray-500">Based on their latest post about AI hiring trends</span>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
          <p className="text-gray-700 text-sm leading-relaxed">
            "Great insights on AI-driven hiring, Jane! We're seeing similar patterns at our org —
            especially around reducing time-to-hire with better candidate matching. Would love to
            compare notes on how your team is approaching bias detection in the process. 🤝"
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105"
            style={{ backgroundColor: WORKSPACE_CONTRAST_COLOR }}
          >
            ✓ Use Draft
          </button>
          <button className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
            ↻ Regenerate
          </button>
          <button className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
            ✏️ Edit
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Tone Options
          </p>
          <div className="flex flex-wrap gap-2">
            {['Professional', 'Casual', 'Thought Leader', 'Curious'].map((tone) => (
              <span
                key={tone}
                className="px-3 py-1.5 rounded-full text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-all"
              >
                {tone}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-24 bg-white" id="features">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <span
            data-section="features-label"
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
            style={{
              backgroundColor: `${WORKSPACE_PRIMARY_COLOR}15`,
              color: WORKSPACE_PRIMARY_COLOR,
            }}
          >
            Core Tools
          </span>
          <h2
            data-section="features-title"
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{
              color: '#0c2340',
              fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
            }}
          >
            Two Tools. One Goal: Real Relationships.
          </h2>
          <p data-section="features-subtitle" className="text-lg text-gray-500 max-w-2xl mx-auto">
            Track where every relationship stands. Craft messages that actually get responses.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Sticky visual preview on left */}
          <div className="lg:sticky lg:top-24">
            <div
              className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 transition-all duration-500"
              style={{
                boxShadow: `0 25px 50px -12px ${WORKSPACE_PRIMARY_COLOR}15`,
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-gray-400">
                  {WORKSPACE_BRAND_NAME} Extension
                </span>
              </div>
              {renderPreview(activeFeature)}
            </div>
          </div>

          {/* Scrolling feature cards on right */}
          <div className="space-y-12">
            {FEATURES.map((feature, index) => (
              <div
                key={index}
                ref={(el) => { cardRefs.current[index] = el; }}
                data-index={index}
                className={`p-8 rounded-2xl border transition-all duration-700 cursor-pointer ${
                  visibleCards.has(index)
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                } ${
                  activeFeature === index
                    ? 'border-2 shadow-xl'
                    : 'border-gray-100 hover:shadow-lg'
                }`}
                style={{
                  borderColor:
                    activeFeature === index ? WORKSPACE_PRIMARY_COLOR : undefined,
                  backgroundColor:
                    activeFeature === index ? `${WORKSPACE_PRIMARY_COLOR}05` : 'white',
                }}
                onClick={() => setActiveFeature(index)}
              >
                <div className="flex items-start gap-4 mb-4">
                  {feature.icon}
                  <div>
                    <h3
                      data-section={`feature-${index + 1}-title`}
                      className="text-2xl font-bold mb-2"
                      style={{
                        color: '#0c2340',
                        fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      data-section={`feature-${index + 1}-desc`}
                      className="text-gray-600 leading-relaxed"
                    >
                      {feature.description}
                    </p>
                  </div>
                </div>

                <ul className="space-y-3 ml-16">
                  {feature.details.map((detail, di) => (
                    <li
                      key={di}
                      data-section={`feature-${index + 1}-detail-${di + 1}`}
                      className="flex items-center gap-3 text-gray-600"
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                        style={{ backgroundColor: WORKSPACE_CONTRAST_COLOR }}
                      >
                        ✓
                      </span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// === SECTION 5B: BENEFITS SECTION ===

const BenefitsSection: React.FC = () => {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setVisibleItems((prev) => new Set(prev).add(index));
          }
        });
      },
      { threshold: 0.3 }
    );

    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24" id="benefits" style={{ backgroundColor: '#f8fafc' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <span
            data-section="benefits-label"
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
            style={{
              backgroundColor: `${WORKSPACE_CONTRAST_COLOR}15`,
              color: WORKSPACE_CONTRAST_COLOR,
            }}
          >
            Why {WORKSPACE_BRAND_NAME}
          </span>
          <h2
            data-section="benefits-title"
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{
              color: '#0c2340',
              fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
            }}
          >
            Networking That Actually Works
          </h2>
          <p data-section="benefits-subtitle" className="text-lg text-gray-500 max-w-2xl mx-auto">
            Stop guessing. Start connecting with confidence and clarity.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {BENEFITS.map((benefit, index) => (
            <div
              key={index}
              ref={(el) => { itemRefs.current[index] = el; }}
              data-index={index}
              className={`group p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-700 border border-gray-100 hover:border-transparent cursor-default ${
                visibleItems.has(index)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{
                transitionDelay: `${index * 100}ms`,
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${WORKSPACE_PRIMARY_COLOR}10, ${WORKSPACE_CONTRAST_COLOR}10)`,
                  }}
                >
                  {benefit.icon}
                </div>
                <div>
                  <h3
                    data-section={`benefit-${index + 1}-title`}
                    className="text-xl font-bold mb-2"
                    style={{
                      color: '#0c2340',
                      fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
                    }}
                  >
                    {benefit.title}
                  </h3>
                  <p
                    data-section={`benefit-${index + 1}-desc`}
                    className="text-gray-600 leading-relaxed"
                  >
                    {benefit.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof stat bar */}
        <div
          className="mt-16 p-8 rounded-2xl text-white grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
          style={{
            background: `linear-gradient(135deg, #0c2340, ${WORKSPACE_PRIMARY_COLOR})`,
          }}
        >
          <div>
            <p data-section="stat-1-number" className="text-4xl font-bold mb-1">
              2,500+
            </p>
            <p data-section="stat-1-label" className="text-white/70 text-sm">
              Active Users
            </p>
          </div>
          <div>
            <p data-section="stat-2-number" className="text-4xl font-bold mb-1">
              150K+
            </p>
            <p data-section="stat-2-label" className="text-white/70 text-sm">
              Connections Tracked
            </p>
          </div>
          <div>
            <p data-section="stat-3-number" className="text-4xl font-bold mb-1">
              3x
            </p>
            <p data-section="stat-3-label" className="text-white/70 text-sm">
              More Reply Rate
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// === SECTION 5C: HOW IT WORKS SECTION ===

const HowItWorksSection: React.FC = () => {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setVisibleItems((prev) => new Set(prev).add(index));
          }
        });
      },
      { threshold: 0.3 }
    );

    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 bg-white" id="how-it-works">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-16">
          <span
            data-section="how-it-works-label"
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
            style={{
              backgroundColor: `${WORKSPACE_CONTRAST_COLOR}15`,
              color: WORKSPACE_CONTRAST_COLOR,
            }}
          >
            Get Started
          </span>
          <h2
            data-section="how-it-works-title"
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{
              color: '#0c2340',
              fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
            }}
          >
            Up and Running in Minutes
          </h2>
          <p data-section="how-it-works-subtitle" className="text-lg text-gray-500 max-w-2xl mx-auto">
            No complex setup. No learning curve. Start seeing results today.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div
              key={index}
              ref={(el) => { itemRefs.current[index] = el; }}
              data-index={index}
              className={`relative p-8 bg-gray-50 rounded-2xl border border-gray-100 transition-all duration-700 hover:shadow-lg ${
                visibleItems.has(index)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Step number */}
              <div
                className="absolute -top-4 -left-2 text-6xl font-bold opacity-10"
                style={{
                  color: WORKSPACE_PRIMARY_COLOR,
                  fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
                }}
              >
                {step.number}
              </div>

              <div className="relative z-10">
                <div className="mb-6">{step.icon}</div>
                <h3
                  data-section={`step-${index + 1}-title`}
                  className="text-xl font-bold mb-3"
                  style={{
                    color: '#0c2340',
                    fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  data-section={`step-${index + 1}-desc`}
                  className="text-gray-600 leading-relaxed"
                >
                  {step.description}
                </p>
              </div>

              {/* Connector line to next step */}
              {index < HOW_IT_WORKS_STEPS.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gray-200" />
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <a
            href="https://audos.com/space/workspace-595217"
            data-section="how-it-works-cta"
            className="inline-block px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
            style={{
              backgroundColor: WORKSPACE_PRIMARY_COLOR,
              color: 'white',
            }}
          >
            Try LinkNest Free
          </a>
        </div>
      </div>
    </section>
  );
};

// === SECTION 5D: FAQ SECTION ===

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-white" id="faq">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-12">
          <span
            data-section="faq-label"
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
            style={{
              backgroundColor: `${WORKSPACE_HIGHLIGHT_COLOR}15`,
              color: WORKSPACE_HIGHLIGHT_COLOR,
            }}
          >
            FAQ
          </span>
          <h2
            data-section="faq-title"
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{
              color: '#0c2340',
              fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
            }}
          >
            Frequently Asked Questions
          </h2>
          <p data-section="faq-subtitle" className="text-lg text-gray-500">
            Everything you need to know about {WORKSPACE_BRAND_NAME}.
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, index) => (
            <div
              key={index}
              className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                openIndex === index
                  ? 'shadow-lg border-transparent'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{
                borderColor: openIndex === index ? WORKSPACE_PRIMARY_COLOR : undefined,
              }}
            >
              <button
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span
                  data-section={`faq-${index + 1}-question`}
                  className="font-semibold text-lg"
                  style={{
                    color: openIndex === index ? WORKSPACE_PRIMARY_COLOR : '#0c2340',
                    fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif`,
                  }}
                >
                  {item.question}
                </span>
                <span
                  className={`text-2xl transition-transform duration-300 flex-shrink-0 ${
                    openIndex === index ? 'rotate-45' : ''
                  }`}
                  style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}
                >
                  +
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p
                  data-section={`faq-${index + 1}-answer`}
                  className="px-6 pb-5 text-gray-600 leading-relaxed"
                >
                  {item.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// === SECTION 6: CTA SECTION ===

const CTASection: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setVisible(true);
        });
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 relative overflow-hidden" id="cta">
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(135deg, #0c2340 0%, ${WORKSPACE_PRIMARY_COLOR} 60%, ${WORKSPACE_HIGHLIGHT_COLOR} 100%)`,
        }}
      />

      {/* Decorative nodes */}
      <div className="absolute inset-0 z-[1] opacity-10">
        <svg width="100%" height="100%" viewBox="0 0 800 400">
          <circle cx="100" cy="100" r="3" fill="white" />
          <circle cx="300" cy="200" r="4" fill="white" />
          <circle cx="500" cy="80" r="3" fill="white" />
          <circle cx="700" cy="300" r="5" fill="white" />
          <circle cx="200" cy="350" r="3" fill="white" />
          <circle cx="600" cy="150" r="4" fill="white" />
          <line x1="100" y1="100" x2="300" y2="200" stroke="white" strokeWidth="0.5" />
          <line x1="300" y1="200" x2="500" y2="80" stroke="white" strokeWidth="0.5" />
          <line x1="500" y1="80" x2="700" y2="300" stroke="white" strokeWidth="0.5" />
          <line x1="200" y1="350" x2="300" y2="200" stroke="white" strokeWidth="0.5" />
          <line x1="600" y1="150" x2="700" y2="300" stroke="white" strokeWidth="0.5" />
        </svg>
      </div>

      <div
        ref={sectionRef}
        className={`relative z-10 max-w-3xl mx-auto px-4 text-center transition-all duration-1000 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2
          data-section="cta-title"
          className="text-4xl md:text-5xl font-bold text-white mb-6"
          style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}
        >
          Ready to Network With Intention?
        </h2>
        <p data-section="cta-description" className="text-xl text-white/80 mb-10 max-w-xl mx-auto">
          Stop collecting contacts. Start building relationships that lead to jobs, hires, and partnerships.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="https://audos.com/space/workspace-595217"
            data-section="cta-button"
            className="inline-block px-10 py-5 rounded-xl text-lg font-bold transition-all duration-300 hover:scale-105 shadow-2xl"
            style={{
              backgroundColor: WORKSPACE_HIGHLIGHT_COLOR,
              color: '#1a1a1a',
            }}
          >
            Start Building Better Relationships
          </a>
        </div>

        <p data-section="cta-note" className="text-white/50 text-sm mt-6">
          No credit card required · Free plan available · 2 minute setup
        </p>
      </div>
    </section>
  );
};

// === SECTION 6B: FOOTER ===

const Footer: React.FC = () => {
  return (
    <footer className="py-16 bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              {WORKSPACE_LOGO_URL ? (
                <div className="bg-white rounded-lg p-0.5 border border-gray-200">
                  <img
                    src={WORKSPACE_LOGO_URL}
                    alt={WORKSPACE_BRAND_NAME}
                    className="h-7 w-7 object-contain"
                  />
                </div>
              ) : (
                <span
                  className="font-bold text-xl"
                  style={{ color: WORKSPACE_PRIMARY_COLOR }}
                >
                  {WORKSPACE_BRAND_NAME.charAt(0)}
                </span>
              )}
              <span
                data-section="footer-brand"
                className="font-bold text-xl"
                style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}
              >
                {WORKSPACE_BRAND_NAME}
              </span>
            </div>
            <p data-section="footer-tagline" className="text-gray-400 mb-4 max-w-sm">
              {WORKSPACE_TAGLINE}
            </p>
            <p data-section="footer-description" className="text-gray-500 text-sm max-w-sm">
              The smart Chrome extension for LinkedIn professionals who want to build
              authentic, meaningful relationships with decision-makers.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 data-section="footer-product-heading" className="font-semibold mb-4">
              Product
            </h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <a
                  data-section="footer-link-features"
                  href="#features"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('#features');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  data-section="footer-link-benefits"
                  href="#benefits"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('#benefits');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Benefits
                </a>
              </li>
              <li>
                <a
                  data-section="footer-link-faq"
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('#faq');
                  }}
                  className="hover:text-white transition-colors"
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 data-section="footer-company-heading" className="font-semibold mb-4">
              Company
            </h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <a data-section="footer-link-privacy" href="#" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a data-section="footer-link-terms" href="#" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a data-section="footer-link-contact" href="#" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p data-section="footer-copyright" className="text-gray-500 text-sm">
            © {new Date().getFullYear()} {WORKSPACE_BRAND_NAME}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a data-section="footer-social-twitter" href="#" className="text-gray-500 hover:text-white transition-colors text-sm">
              Twitter
            </a>
            <a data-section="footer-social-linkedin" href="#" className="text-gray-500 hover:text-white transition-colors text-sm">
              LinkedIn
            </a>
            <a data-section="footer-social-github" href="#" className="text-gray-500 hover:text-white transition-colors text-sm">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// === SECTION 7: MAIN COMPONENT ===

const LinkNestLandingPage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Inject Google Fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Inject base styles
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --brand-font: '${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif;
      }
      body {
        font-family: '${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif;
        margin: 0;
        padding: 0;
      }
      * {
        box-sizing: border-box;
      }
      html {
        scroll-behavior: smooth;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const heroEl = document.getElementById('hero');
      const heroHeight = heroEl ? heroEl.offsetHeight : 600;
      setScrolled(window.scrollY > heroHeight * 0.6);

      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const progress = docHeight > winHeight ? (window.scrollY / (docHeight - winHeight)) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-full overflow-y-auto" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
      {/* Progress Bar - SEPARATE from navbar, at very top */}
      <div
        className="fixed top-0 left-0 right-0 z-[60] h-1"
        style={{
          width: `${scrollProgress}%`,
          backgroundColor: WORKSPACE_HIGHLIGHT_COLOR,
          transition: 'width 150ms ease-out',
        }}
      />

      {/* Floating Pill Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 md:px-6 md:pt-6">
        <nav
          className={`relative mx-auto max-w-6xl rounded-full backdrop-blur-md px-6 py-3 transition-all duration-300 shadow-lg flex items-center justify-between ${
            scrolled
              ? 'bg-white/90 text-gray-900 border border-gray-200/50'
              : 'bg-black/70 text-white'
          }`}
        >
          {/* Left: Logo + Brand */}
          <div className="flex items-center gap-2">
            {WORKSPACE_LOGO_URL ? (
              <div className="bg-white rounded-lg p-0.5 border border-gray-200">
                <img
                  src={WORKSPACE_LOGO_URL}
                  alt={WORKSPACE_BRAND_NAME}
                  className="h-7 w-7 object-contain"
                />
              </div>
            ) : (
              <span
                className="font-bold text-xl"
                style={{ color: scrolled ? WORKSPACE_PRIMARY_COLOR : 'white' }}
              >
                {WORKSPACE_BRAND_NAME.charAt(0)}
              </span>
            )}
            <span
              data-section="nav-brand"
              className="font-bold text-lg"
              style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}
            >
              {WORKSPACE_BRAND_NAME}
            </span>
          </div>

          {/* Right: Nav Links + CTA (Desktop) */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                data-section={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href);
                }}
                className={`text-sm font-medium transition-colors hover:opacity-80 ${
                  scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'
                }`}
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://audos.com/space/workspace-595217"
              data-section="nav-cta"
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
              style={{
                backgroundColor: WORKSPACE_HIGHLIGHT_COLOR,
                color: '#1a1a1a',
              }}
            >
              Try Free
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span
              className={`block w-5 h-0.5 transition-all duration-300 ${
                scrolled ? 'bg-gray-800' : 'bg-white'
              } ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}
            />
            <span
              className={`block w-5 h-0.5 transition-all duration-300 ${
                scrolled ? 'bg-gray-800' : 'bg-white'
              } ${mobileMenuOpen ? 'opacity-0' : ''}`}
            />
            <span
              className={`block w-5 h-0.5 transition-all duration-300 ${
                scrolled ? 'bg-gray-800' : 'bg-white'
              } ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}
            />
          </button>
        </nav>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mx-auto max-w-6xl mt-2 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-gray-200/50 p-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href);
                  setMobileMenuOpen(false);
                }}
                className="block py-3 px-4 text-gray-700 font-medium hover:bg-gray-50 rounded-xl transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://audos.com/space/workspace-595217"
              className="block mt-2 py-3 px-4 rounded-xl text-center font-semibold"
              style={{
                backgroundColor: WORKSPACE_HIGHLIGHT_COLOR,
                color: '#1a1a1a',
              }}
            >
              Try Free
            </a>
          </div>
        )}
      </div>

      {/* Page Sections */}
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <BenefitsSection />
      <HowItWorksSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
};

// === SECTION 8: EXPORT (FINAL) ===

export default LinkNestLandingPage;
