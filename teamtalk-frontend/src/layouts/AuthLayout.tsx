import React from 'react';
import { Outlet } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks';
import { Button } from '@/components/ui';
import slogo from '@assets/styles/images/slogo.png';

export const AuthLayout: React.FC = () => {
  const { isDark, toggle } = useTheme();

  return (
    <div className="min-h-screen flex font-body">
      {/* Left branded panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #6247ea 0%, #8b5cf6 50%, #a78bfa 100%)' }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-white/20 blur-3xl" />
        </div>
        <div className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 text-center px-12">
          <div className="w-24 h-24 rounded-3xl bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl overflow-hidden">
            <img src={slogo} alt="Team Talk" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-5xl font-black text-white font-display tracking-tight mb-4">
            Team Talk
          </h1>
          <p className="text-white/70 text-lg max-w-sm mx-auto leading-relaxed">
            Enterprise collaboration reimagined. Connect, create, and ship together.
          </p>
          <div className="flex gap-12 mt-14 justify-center">
            {[
              { value: '1.2K+', label: 'Teams' },
              { value: '50K+', label: 'Messages/day' },
              { value: '99.9%', label: 'Uptime' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-black text-white font-display">{stat.value}</div>
                <div className="text-white/50 text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-surface-950 relative">
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </div>
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
