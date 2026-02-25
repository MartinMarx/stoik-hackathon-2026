import { HackathonGate } from "@/components/hackathon-ended-screen";

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HackathonGate>
    <div className="dark min-h-screen bg-[#0a0a0f] text-foreground">
      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Base dark layer */}
        <div className="absolute inset-0 bg-[#0a0a0f]" />

        {/* Animated gradient orbs */}
        <div
          className="absolute -left-1/4 -top-1/4 h-[60vh] w-[60vh] rounded-full opacity-[0.07] blur-[120px] will-change-transform"
          style={{
            background:
              "radial-gradient(circle, #6366f1 0%, transparent 70%)",
            animation: "live-orb-1 25s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 h-[50vh] w-[50vh] rounded-full opacity-[0.06] blur-[100px] will-change-transform"
          style={{
            background:
              "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
            animation: "live-orb-2 30s ease-in-out infinite",
          }}
        />
        <div
          className="absolute left-1/3 top-1/2 h-[40vh] w-[40vh] rounded-full opacity-[0.04] blur-[80px] will-change-transform"
          style={{
            background:
              "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
            animation: "live-orb-3 20s ease-in-out infinite",
          }}
        />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* Global keyframes for live view */}
      <style>{`
        @keyframes live-orb-1 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33% { transform: translate(30%, 20%) scale(1.1); }
          66% { transform: translate(-10%, 30%) scale(0.9); }
        }
        @keyframes live-orb-2 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33% { transform: translate(-25%, -15%) scale(1.15); }
          66% { transform: translate(15%, -25%) scale(0.85); }
        }
        @keyframes live-orb-3 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33% { transform: translate(20%, -30%) scale(1.2); }
          66% { transform: translate(-20%, 10%) scale(0.95); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes border-rotate {
          0% { --border-angle: 0deg; }
          100% { --border-angle: 360deg; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-30px) scale(0.8); }
        }
        @keyframes flash-in {
          0% { opacity: 0; transform: scale(0.5); filter: blur(8px) brightness(2); }
          50% { opacity: 1; filter: blur(0px) brightness(1.5); }
          100% { opacity: 1; transform: scale(1); filter: blur(0px) brightness(1); }
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(168, 85, 247, 0.4); }
          50% { border-color: rgba(168, 85, 247, 0.8); }
        }
        @keyframes legendary-border {
          0% { border-color: rgba(250, 204, 21, 0.4); box-shadow: 0 0 20px rgba(250, 204, 21, 0.1); }
          33% { border-color: rgba(251, 146, 60, 0.6); box-shadow: 0 0 30px rgba(251, 146, 60, 0.15); }
          66% { border-color: rgba(250, 204, 21, 0.8); box-shadow: 0 0 40px rgba(250, 204, 21, 0.2); }
          100% { border-color: rgba(250, 204, 21, 0.4); box-shadow: 0 0 20px rgba(250, 204, 21, 0.1); }
        }
        @keyframes waiting-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes colon-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes urgent-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.4); }
        }
        @keyframes times-up-pulse {
          0%, 100% { transform: scale(1); text-shadow: 0 0 20px rgba(239, 68, 68, 0.5); }
          50% { transform: scale(1.05); text-shadow: 0 0 40px rgba(239, 68, 68, 0.8); }
        }
        @keyframes crown-float {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50% { transform: translateY(-4px) rotate(3deg); }
        }
        @keyframes live-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }
      `}</style>

      {children}
    </div>
    </HackathonGate>
  );
}
