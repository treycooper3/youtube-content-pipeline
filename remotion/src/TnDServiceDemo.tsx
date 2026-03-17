import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  Sequence,
} from "remotion";
import { z } from "zod";

export const tndServiceDemoSchema = z.object({
  companyName: z.string(),
});

// Brand colors
const COLORS = {
  white: "#FFFFFF",
  black: "#1a1a1a",
  yellow: "#FFC107",
  yellowLight: "#FFF3CD",
  gray: "#6c757d",
  grayLight: "#f8f9fa",
};

// Animated counter component
const AnimatedCounter: React.FC<{
  value: number;
  suffix?: string;
  frame: number;
  delay: number;
}> = ({ value, suffix = "", frame, delay }) => {
  const progress = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 50, stiffness: 100 },
  });

  const displayValue = Math.round(interpolate(progress, [0, 1], [0, value]));

  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {displayValue}
      {suffix}
    </span>
  );
};

// HVAC Icon
const HVACIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    {/* AC Unit body */}
    <rect x="15" y="25" width="70" height="50" rx="5" stroke={color} strokeWidth="4" fill="none" />
    {/* Vents */}
    <line x1="25" y1="35" x2="75" y2="35" stroke={color} strokeWidth="3" />
    <line x1="25" y1="45" x2="75" y2="45" stroke={color} strokeWidth="3" />
    <line x1="25" y1="55" x2="75" y2="55" stroke={color} strokeWidth="3" />
    <line x1="25" y1="65" x2="75" y2="65" stroke={color} strokeWidth="3" />
    {/* Cool air waves */}
    <path d="M30 80 Q35 85 40 80 Q45 75 50 80" stroke={color} strokeWidth="2" fill="none" />
    <path d="M50 80 Q55 85 60 80 Q65 75 70 80" stroke={color} strokeWidth="2" fill="none" />
  </svg>
);

// Plumbing Icon
const PlumbingIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    {/* Pipe horizontal */}
    <rect x="10" y="40" width="35" height="20" rx="2" stroke={color} strokeWidth="4" fill="none" />
    {/* Pipe vertical */}
    <rect x="40" y="40" width="20" height="45" rx="2" stroke={color} strokeWidth="4" fill="none" />
    {/* Pipe right */}
    <rect x="55" y="40" width="35" height="20" rx="2" stroke={color} strokeWidth="4" fill="none" />
    {/* Valve */}
    <circle cx="50" cy="25" r="12" stroke={color} strokeWidth="4" fill="none" />
    <line x1="50" y1="37" x2="50" y2="40" stroke={color} strokeWidth="4" />
    {/* Valve handle */}
    <line x1="40" y1="25" x2="60" y2="25" stroke={color} strokeWidth="4" />
  </svg>
);

// Electrical Icon
const ElectricalIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    {/* Lightning bolt */}
    <path
      d="M55 10 L35 45 L48 45 L40 90 L70 40 L55 40 L65 10 Z"
      stroke={color}
      strokeWidth="4"
      fill="none"
      strokeLinejoin="round"
    />
  </svg>
);

// Service Card Component
const ServiceCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  frame: number;
  delay: number;
}> = ({ title, description, icon, frame, delay }) => {
  const slideIn = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 15, stiffness: 80 },
  });

  const opacity = interpolate(slideIn, [0, 1], [0, 1]);
  const translateY = interpolate(slideIn, [0, 1], [50, 0]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 40,
        backgroundColor: COLORS.white,
        borderRadius: 20,
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        width: 320,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          backgroundColor: COLORS.yellowLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.black,
          margin: 0,
          marginBottom: 12,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          color: COLORS.gray,
          margin: 0,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
    </div>
  );
};

// Stat Item Component
const StatItem: React.FC<{
  value: number;
  suffix: string;
  label: string;
  frame: number;
  delay: number;
}> = ({ value, suffix, label, frame, delay }) => {
  const fadeIn = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 20, stiffness: 100 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: fadeIn,
        transform: `scale(${interpolate(fadeIn, [0, 1], [0.8, 1])})`,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 72,
          fontWeight: 800,
          color: COLORS.yellow,
        }}
      >
        <AnimatedCounter value={value} suffix={suffix} frame={frame} delay={delay} />
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 20,
          fontWeight: 500,
          color: COLORS.gray,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// Intro Scene
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const logoScale = spring({
    frame,
    fps: 30,
    config: { damping: 12, stiffness: 100 },
  });

  const taglineOpacity = spring({
    frame: frame - 20,
    fps: 30,
    config: { damping: 20 },
  });

  const subtitleOpacity = spring({
    frame: frame - 40,
    fps: 30,
    config: { damping: 20 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Yellow accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          backgroundColor: COLORS.yellow,
        }}
      />

      {/* Company Name */}
      <h1
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 120,
          fontWeight: 800,
          color: COLORS.black,
          margin: 0,
          transform: `scale(${logoScale})`,
          letterSpacing: -2,
        }}
      >
        TnD<span style={{ color: COLORS.yellow }}>.</span>
      </h1>

      <h2
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 36,
          fontWeight: 600,
          color: COLORS.black,
          margin: 0,
          marginTop: 10,
          opacity: taglineOpacity,
          letterSpacing: 8,
          textTransform: "uppercase",
        }}
      >
        Mechanical
      </h2>

      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 24,
          color: COLORS.gray,
          margin: 0,
          marginTop: 30,
          opacity: subtitleOpacity,
        }}
      >
        Premier Commercial MEP Contractors
      </p>

      {/* Yellow accent line */}
      <div
        style={{
          width: interpolate(subtitleOpacity, [0, 1], [0, 200]),
          height: 4,
          backgroundColor: COLORS.yellow,
          marginTop: 20,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  );
};

// Stats Scene
const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.grayLight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h2
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 48,
          fontWeight: 700,
          color: COLORS.black,
          margin: 0,
          marginBottom: 60,
          opacity: spring({ frame, fps: 30, config: { damping: 20 } }),
        }}
      >
        Three Decades of <span style={{ color: COLORS.yellow }}>Excellence</span>
      </h2>

      <div
        style={{
          display: "flex",
          gap: 120,
        }}
      >
        <StatItem value={20} suffix="+" label="Years Experience" frame={frame} delay={15} />
        <StatItem value={350} suffix="+" label="Projects Completed" frame={frame} delay={25} />
        <StatItem value={100} suffix="%" label="OSHA Compliant" frame={frame} delay={35} />
      </div>
    </AbsoluteFill>
  );
};

// Services Scene
const ServicesScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = spring({
    frame,
    fps: 30,
    config: { damping: 20 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
      }}
    >
      <h2
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 48,
          fontWeight: 700,
          color: COLORS.black,
          margin: 0,
          marginBottom: 60,
          opacity: titleOpacity,
        }}
      >
        Our <span style={{ color: COLORS.yellow }}>Services</span>
      </h2>

      <div
        style={{
          display: "flex",
          gap: 40,
        }}
      >
        <ServiceCard
          title="HVAC"
          description="Rooftop units, chillers, cooling towers & VAV systems"
          icon={<HVACIcon color={COLORS.yellow} size={60} />}
          frame={frame}
          delay={10}
        />
        <ServiceCard
          title="Plumbing"
          description="Commercial plumbing, process piping & sanitary systems"
          icon={<PlumbingIcon color={COLORS.yellow} size={60} />}
          frame={frame}
          delay={20}
        />
        <ServiceCard
          title="Electrical"
          description="High voltage, fire alarms, data centers & automation"
          icon={<ElectricalIcon color={COLORS.yellow} size={60} />}
          frame={frame}
          delay={30}
        />
      </div>
    </AbsoluteFill>
  );
};

// Value Proposition Scene
const ValueScene: React.FC = () => {
  const frame = useCurrentFrame();

  const line1 = spring({ frame, fps: 30, config: { damping: 20 } });
  const line2 = spring({ frame: frame - 15, fps: 30, config: { damping: 20 } });
  const line3 = spring({ frame: frame - 30, fps: 30, config: { damping: 20 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.black,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 100,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 56,
          fontWeight: 700,
          color: COLORS.white,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        <div style={{ opacity: line1, transform: `translateY(${interpolate(line1, [0, 1], [20, 0])}px)` }}>
          Full-service MEP construction.
        </div>
        <div style={{ opacity: line2, transform: `translateY(${interpolate(line2, [0, 1], [20, 0])}px)`, color: COLORS.yellow }}>
          Seamless coordination.
        </div>
        <div style={{ opacity: line3, transform: `translateY(${interpolate(line3, [0, 1], [20, 0])}px)` }}>
          On time. Every time.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// CTA Scene
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();

  const scale = spring({
    frame,
    fps: 30,
    config: { damping: 12, stiffness: 100 },
  });

  const contactOpacity = spring({
    frame: frame - 30,
    fps: 30,
    config: { damping: 20 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.yellow,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h2
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 64,
          fontWeight: 800,
          color: COLORS.black,
          margin: 0,
          transform: `scale(${scale})`,
          textAlign: "center",
        }}
      >
        Let's Build Together
      </h2>

      <div
        style={{
          marginTop: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 15,
          opacity: contactOpacity,
        }}
      >
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 28,
            fontWeight: 600,
            color: COLORS.black,
            margin: 0,
          }}
        >
          (321) 392-8684
        </p>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 22,
            color: COLORS.black,
            margin: 0,
            opacity: 0.8,
          }}
        >
          Melbourne, Florida
        </p>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 20,
            color: COLORS.black,
            margin: 0,
            opacity: 0.7,
          }}
        >
          tndmechanical@gmail.com
        </p>
      </div>

      {/* 24/7 badge */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: contactOpacity,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            boxShadow: "0 0 10px #22c55e",
          }}
        />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.black,
          }}
        >
          24/7 Emergency Response Available
        </span>
      </div>
    </AbsoluteFill>
  );
};

// Main composition
export const TnDServiceDemo: React.FC<z.infer<typeof tndServiceDemoSchema>> = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white }}>
      {/* Intro - 0 to 90 frames (3 seconds) */}
      <Sequence from={0} durationInFrames={90}>
        <IntroScene />
      </Sequence>

      {/* Stats - 90 to 180 frames (3 seconds) */}
      <Sequence from={90} durationInFrames={90}>
        <StatsScene />
      </Sequence>

      {/* Services - 180 to 300 frames (4 seconds) */}
      <Sequence from={180} durationInFrames={120}>
        <ServicesScene />
      </Sequence>

      {/* Value Proposition - 300 to 390 frames (3 seconds) */}
      <Sequence from={300} durationInFrames={90}>
        <ValueScene />
      </Sequence>

      {/* CTA - 390 to 510 frames (4 seconds) */}
      <Sequence from={390} durationInFrames={120}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
