import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Check,
  Grid,
  GitBranch,
  BarChart2,
  Layers,
  Wrench,
  Sun,
  Moon,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, theme, toggleTheme } = useAuth();

  return (
    <div className="min-h-screen bg-paper-base text-ink font-sans flex flex-col justify-between select-none transition-colors duration-200">
      {/* 1. Header Navigation Bar */}
      <header className="h-20 max-w-7xl w-full mx-auto px-6 sm:px-12 flex items-center justify-between z-20">
        <Link to="/" className="flex items-center gap-1.5 no-underline">
          <span className="font-serif font-bold text-2xl tracking-tight text-terracotta">
            IForms
          </span>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-ink-muted">
          <a href="#features" className="hover:text-ink no-underline transition-colors">
            Features
          </a>
          <a href="#templates" className="hover:text-ink no-underline transition-colors">
            Templates
          </a>
          <a href="#pricing" className="hover:text-ink no-underline transition-colors">
            Pricing
          </a>
        </nav>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            type="button"
            className="p-2 text-ink-muted hover:text-ink hover:bg-paper-high rounded-full cursor-pointer transition-colors"
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isAuthenticated ? (
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-xs font-semibold text-ink hover:text-terracotta no-underline transition-colors px-2 py-1"
              >
                Log In
              </Link>
              <Link to="/signup" className="no-underline">
                <Button variant="primary" size="sm">
                  Start Free
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* 2. Hero Section (Asymmetric 2-Column Layout) matching reference screenshot */}
      <section className="max-w-7xl w-full mx-auto px-6 sm:px-12 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
        {/* Hero Left Content */}
        <div className="space-y-6 max-w-xl">
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink leading-[1.15]">
            Build forms that feel like part of your brand.
          </h1>
          <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
            Ditch the generic surveys. Create stunning, editorial-grade forms that match your visual identity and collect data with elegance.
          </p>

          <div className="flex items-center gap-4 pt-2">
            <Link to="/signup" className="no-underline">
              <Button variant="primary" size="md" className="gap-2">
                <span>Start building free</span>
                <ArrowRight size={15} />
              </Button>
            </Link>

            <a href="#features" className="no-underline">
              <Button variant="outline" size="md">
                View Examples
              </Button>
            </a>
          </div>
        </div>

        {/* Hero Right Visual: Product Screenshot in Browser Frame */}
        <div className="relative flex justify-center">
          <div className="w-full max-w-lg bg-paper-lowest border border-paper-border rounded-lg shadow-warm-lift overflow-hidden border-t-8 border-t-paper-border">
            {/* Browser Chrome Header */}
            <div className="px-4 py-2.5 bg-paper-high/60 border-b border-paper-border flex items-center justify-between text-[11px] font-mono text-ink-muted">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-terracotta text-xs">IForms</span>
                <span>Form Builder</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span>Create</span>
                <span>Templates</span>
                <span>Integrations</span>
                <span className="px-2 py-0.5 bg-terracotta text-white rounded-xs">Save</span>
              </div>
            </div>

            {/* Browser Content Mockup */}
            <div className="p-6 bg-paper-base space-y-4">
              <div className="bg-paper-lowest border border-paper-border rounded-md p-5 space-y-3 shadow-warm-sm">
                <h3 className="font-serif text-xl font-bold text-ink">Contact Us</h3>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-ink uppercase">Full Name *</label>
                    <div className="h-7 bg-paper-high/60 border border-paper-border rounded-xs px-2 flex items-center text-[11px] text-ink-subtle">
                      Jane Doe
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-ink uppercase">Email Address *</label>
                    <div className="h-7 bg-paper-high/60 border border-paper-border rounded-xs px-2 flex items-center text-[11px] text-ink-subtle">
                      jane@example.com
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-ink uppercase">Message</label>
                    <div className="h-14 bg-paper-high/60 border border-paper-border rounded-xs p-2 text-[11px] text-ink-subtle">
                      Stay awesome...
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <div className="px-4 py-1.5 bg-terracotta text-white rounded-xs font-semibold text-[11px]">
                      Send Message
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Trusted-By Logo Strip matching screenshot */}
      <section className="py-12 border-y border-paper-border bg-paper-high/30 text-center space-y-6">
        <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-ink-subtle">
          TRUSTED BY CREATIVE TEAMS
        </p>

        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-10 sm:gap-16 font-serif text-2xl font-bold text-ink-muted">
          <span className="tracking-tighter hover:text-ink transition-colors cursor-default">Vogue</span>
          <span className="tracking-widest uppercase hover:text-ink transition-colors cursor-default">MONOCLE</span>
          <span className="tracking-wide hover:text-ink transition-colors cursor-default">KINFOLK</span>
          <span className="tracking-tight hover:text-ink transition-colors cursor-default">The Atlantic</span>
          <span className="tracking-wider uppercase hover:text-ink transition-colors cursor-default">WIRED</span>
        </div>
      </section>

      {/* 4. Alternating Feature Sections matching reference screenshot */}
      <section id="features" className="py-16 md:py-24 space-y-24 max-w-7xl mx-auto px-6 sm:px-12">
        {/* Feature 1 (Text Left, Laptop Graphic Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 max-w-lg">
            <div className="w-9 h-9 rounded-md bg-paper-high border border-paper-border flex items-center justify-center text-terracotta shadow-warm-sm">
              <Grid size={18} />
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-ink leading-tight">
              Tactile precision, digital speed.
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Our grid-based builder enforces design discipline while remaining perfectly fluid. Snap inputs, text blocks, and images into a rigid 8px grid that ensures every form looks professionally typeset.
            </p>
            <ul className="space-y-2.5 text-xs font-semibold text-ink pt-2">
              <li className="flex items-center gap-2">
                <Check size={16} className="text-terracotta" />
                <span>Strict 8px grid alignment</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-terracotta" />
                <span>Typography hierarchy controls</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-terracotta" />
                <span>Custom brand color tokens</span>
              </li>
            </ul>
          </div>

          <div className="p-8 bg-paper-high/40 border border-paper-border rounded-lg flex items-center justify-center shadow-warm-sm">
            {/* Laptop Mockup Box */}
            <div className="w-full max-w-md bg-paper-lowest border-4 border-ink rounded-md p-4 space-y-3 shadow-warm-md">
              <div className="h-4 bg-paper-high rounded-xs flex items-center px-2">
                <div className="w-2 h-2 rounded-full bg-brick mr-1" />
                <div className="w-2 h-2 rounded-full bg-amber mr-1" />
                <div className="w-2 h-2 rounded-full bg-forest" />
              </div>
              <div className="p-4 bg-paper-base rounded-xs space-y-2 border border-paper-border">
                <div className="font-serif font-bold text-sm text-ink">Join Our Newsletter</div>
                <div className="h-6 bg-paper-lowest border border-paper-border rounded-xs text-[10px] text-ink-subtle px-2 flex items-center">
                  email@domain.com
                </div>
                <div className="h-6 bg-terracotta text-white rounded-xs text-[10px] font-bold flex items-center justify-center">
                  Subscribe
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2 (Node Graph Left, Text Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 p-8 bg-paper-high/40 border border-paper-border rounded-lg flex items-center justify-center shadow-warm-sm">
            {/* Node Flow Diagram Visual */}
            <div className="w-full max-w-md bg-paper-lowest border border-paper-border rounded-md p-6 space-y-4 shadow-warm-md">
              <div className="text-xs font-mono font-bold text-ink border-b border-paper-border pb-2">
                Client Onboarding Logic
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="p-2.5 bg-paper-high border border-paper-border rounded-sm text-[10px] font-mono font-bold text-ink">
                  IF Department = "Sales"
                </div>
                <span className="text-terracotta font-mono font-bold">→</span>
                <div className="p-2.5 bg-terracotta-container border border-terracotta/30 rounded-sm text-[10px] font-mono font-bold text-terracotta">
                  JUMP TO Sales Form
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-6 max-w-lg">
            <div className="w-9 h-9 rounded-md bg-paper-high border border-paper-border flex items-center justify-center text-terracotta shadow-warm-sm">
              <GitBranch size={18} />
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-ink leading-tight">
              Intelligent routing, silently applied.
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Build complex conditional flows without exposing the complexity to your respondents. Skip irrelevant sections and adapt questions based on previous answers, all managed through a clean visual node editor.
            </p>
          </div>
        </div>

        {/* Feature 3 (Text Left, Dashboard Screenshots Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 max-w-lg">
            <div className="w-9 h-9 rounded-md bg-paper-high border border-paper-border flex items-center justify-center text-terracotta shadow-warm-sm">
              <BarChart2 size={18} />
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-ink leading-tight">
              Editorial-grade insights.
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Your data deserves to be presented beautifully. Our reporting dashboard turns form submissions into clean, readable documents, complete with elegant charts and exportable layouts.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-paper-lowest border border-paper-border rounded-md shadow-warm-md space-y-2">
              <span className="text-[10px] font-mono text-ink-muted">REVENUE BREAKDOWN</span>
              <div className="h-24 bg-paper-high/60 rounded-xs flex items-end justify-around p-2">
                <div className="w-3 h-16 bg-terracotta rounded-xs" />
                <div className="w-3 h-10 bg-sage rounded-xs" />
                <div className="w-3 h-20 bg-terracotta rounded-xs" />
                <div className="w-3 h-12 bg-ink-subtle rounded-xs" />
              </div>
            </div>

            <div className="p-4 bg-paper-lowest border border-paper-border rounded-md shadow-warm-md space-y-2">
              <span className="text-[10px] font-mono text-ink-muted">PERFORMANCE METRICS</span>
              <div className="space-y-1.5 text-[10px] font-mono text-ink">
                <div className="flex justify-between border-b border-paper-border pb-1">
                  <span>Alice Smith</span>
                  <span className="text-forest font-bold">On Track</span>
                </div>
                <div className="flex justify-between border-b border-paper-border pb-1">
                  <span>Bob Jones</span>
                  <span className="text-forest font-bold">Completed</span>
                </div>
                <div className="flex justify-between">
                  <span>Charlie Davis</span>
                  <span className="text-amber font-bold">Pending</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Closing Section ("A refined workflow.") with Crisp High Contrast Colors */}
      <section className="bg-[#1F1B16] dark:bg-[#14120E] text-[#FAF7F0] py-20 px-6 sm:px-12 text-center space-y-12 border-t border-[#38322A]">
        <div className="max-w-2xl mx-auto space-y-3">
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[#FAF7F0]">
            A refined workflow.
          </h2>
          <p className="text-sm text-[#A8A29E] leading-relaxed">
            From blank canvas to actionable data in three deliberate steps.
          </p>
        </div>

        {/* 3 Steps Grid matching reference screenshot */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="p-6 bg-[#2B2620] border border-[#38322A] rounded-md space-y-4 text-center shadow-warm-md">
            <div className="w-12 h-12 rounded-md bg-[#38322B] text-[#D46A48] flex items-center justify-center mx-auto">
              <Layers size={22} />
            </div>
            <h3 className="font-serif text-xl font-bold text-[#FAF7F0]">1. Connect</h3>
            <p className="text-xs text-[#D4CEC3] leading-relaxed">
              Import your brand assets and establish your visual guidelines.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-6 bg-[#2B2620] border border-[#38322A] rounded-md space-y-4 text-center shadow-warm-md">
            <div className="w-12 h-12 rounded-md bg-[#38322B] text-[#D46A48] flex items-center justify-center mx-auto">
              <Wrench size={22} />
            </div>
            <h3 className="font-serif text-xl font-bold text-[#FAF7F0]">2. Build</h3>
            <p className="text-xs text-[#D4CEC3] leading-relaxed">
              Construct your form on the grid with precise tactile controls.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-6 bg-[#2B2620] border border-[#38322A] rounded-md space-y-4 text-center shadow-warm-md">
            <div className="w-12 h-12 rounded-md bg-[#38322B] text-[#D46A48] flex items-center justify-center mx-auto">
              <BarChart2 size={22} />
            </div>
            <h3 className="font-serif text-xl font-bold text-[#FAF7F0]">3. Analyze</h3>
            <p className="text-xs text-paper-high/70 leading-relaxed">
              Review submissions in a clean, editorial dashboard environment.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Footer matching reference screenshot */}
      <footer className="bg-paper-lowest border-t border-paper-border px-8 py-8 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-muted gap-4">
        <div className="flex items-center gap-6">
          <span className="font-serif font-bold text-xl text-terracotta">IForms</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-ink no-underline transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-ink no-underline transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-ink no-underline transition-colors">Contact Support</a>
            <a href="#" className="hover:text-ink no-underline transition-colors">Twitter</a>
            <a href="#" className="hover:text-ink no-underline transition-colors">LinkedIn</a>
          </div>
        </div>

        <p>© 2026 IForms Editorial Systems. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
