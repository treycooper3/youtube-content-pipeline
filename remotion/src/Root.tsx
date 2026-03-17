import { Composition } from "remotion";
import { HelloWorld, myCompSchema } from "./HelloWorld";
import { Logo, myCompSchema2 } from "./HelloWorld/Logo";
import { WorldIsYours, worldIsYoursSchema } from "./WorldIsYours";
import { TnDServiceDemo, tndServiceDemoSchema } from "./TnDServiceDemo";
import { ShortsTemplate, shortsTemplateSchema, defaultShortsProps, AIShort, aiShortSchema, defaultAIShortProps } from "./Shorts";
import {
  IntroScene,
  introSceneSchema,
  OutroScene,
  outroSceneSchema,
  LowerThird,
  lowerThirdSchema,
  TextOverlay,
  textOverlaySchema,
  LongFormTemplate,
  longFormTemplateSchema,
  defaultLongFormProps,
  TransitionScene,
  transitionSceneSchema,
  KineticTypography,
  kineticTypographySchema,
  CallToAction,
  callToActionSchema,
} from "./LongForm";
import {
  SplitScreen,
  splitScreenSchema,
  ParticleBackground,
  particleBackgroundSchema,
} from "./Effects";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        // You can take the "id" to render a video:
        // npx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        schema={myCompSchema}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      {/* Mount any React component to make it show up in the sidebar and work on it individually! */}
      <Composition
        id="OnlyLogo"
        component={Logo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema2}
        defaultProps={{
          logoColor1: "#91dAE2" as const,
          logoColor2: "#86A8E7" as const,
        }}
      />

      {/* The World Is Yours - Scarface inspired blimp scene */}
      <Composition
        id="WorldIsYours"
        component={WorldIsYours}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
        schema={worldIsYoursSchema}
        defaultProps={{
          message: "THE WORLD IS YOURS",
        }}
      />

      {/* TnD Mechanical Service Demo */}
      <Composition
        id="TnDServiceDemo"
        component={TnDServiceDemo}
        durationInFrames={510}
        fps={30}
        width={1920}
        height={1080}
        schema={tndServiceDemoSchema}
        defaultProps={{
          companyName: "TnD Mechanical",
        }}
      />

      {/* YouTube Shorts Template - 9:16 Vertical (1080x1920) */}
      <Composition
        id="ShortsTemplate"
        component={ShortsTemplate}
        durationInFrames={2700}  // Max 90 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}  // 9:16 vertical aspect ratio
        schema={shortsTemplateSchema}
        defaultProps={defaultShortsProps}
      />

      {/* AI Short - Motion Graphics Test (1080x1920 vertical) */}
      <Composition
        id="AIShort"
        component={AIShort}
        durationInFrames={450}  // 15 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        schema={aiShortSchema}
        defaultProps={defaultAIShortProps}
      />

      {/* === Long-Form Video Editing Compositions === */}

      {/* Branded Intro Scene (3-5 seconds) */}
      <Composition
        id="StayStarvingIntro"
        component={IntroScene}
        durationInFrames={120}  // 4 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={introSceneSchema}
        defaultProps={{
          title: "",
          logoUrl: "",
          primaryColor: "#FFD700",
          secondaryColor: "#1a1a2e",
          textColor: "#FFFFFF",
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      />

      {/* Outro / End Screen (5-8 seconds) */}
      <Composition
        id="StayStarvingOutro"
        component={OutroScene}
        durationInFrames={180}  // 6 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={outroSceneSchema}
        defaultProps={{
          channelName: "Stay Starving",
          logoUrl: "",
          primaryColor: "#FFD700",
          secondaryColor: "#1a1a2e",
          textColor: "#FFFFFF",
          subscribeColor: "#FF0000",
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          socialHandles: [],
        }}
      />

      {/* Lower Third - Name/Title Overlay */}
      <Composition
        id="LowerThird"
        component={LowerThird}
        durationInFrames={120}  // 4 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={lowerThirdSchema}
        defaultProps={{
          name: "Trey Cooper",
          title: "Founder, Stay Starving",
          accentColor: "#FFD700",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          textColor: "#FFFFFF",
          position: "left" as const,
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      />

      {/* Text Overlay - Animated Callout */}
      <Composition
        id="TextOverlay"
        component={TextOverlay}
        durationInFrames={90}  // 3 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={textOverlaySchema}
        defaultProps={{
          text: "Key Point",
          position: "center" as const,
          fontSize: 48,
          fontWeight: 700,
          textColor: "#FFFFFF",
          accentColor: "#FFD700",
          animation: "pop" as const,
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      />

      {/* Long-Form Video Template - Full composition with overlays */}
      <Composition
        id="LongFormVideo"
        component={LongFormTemplate}
        durationInFrames={18000}  // 10 minutes max at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={longFormTemplateSchema}
        defaultProps={defaultLongFormProps}
      />

      {/* === New Visual Skills === */}

      {/* Cinematic Transitions */}
      <Composition
        id="TransitionScene"
        component={TransitionScene}
        durationInFrames={30}  // 1 second at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={transitionSceneSchema}
        defaultProps={{
          style: "fade-black" as const,
          primaryColor: "#FFD700",
          secondaryColor: "#1a1a2e",
          direction: "in" as const,
        }}
      />

      {/* Kinetic Typography - Animated Text */}
      <Composition
        id="KineticTypography"
        component={KineticTypography}
        durationInFrames={120}  // 4 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={kineticTypographySchema}
        defaultProps={{
          text: "Stay Starving",
          style: "bounce-in" as const,
          fontSize: 80,
          fontWeight: 800,
          textColor: "#FFFFFF",
          accentColor: "#FFD700",
          backgroundColor: "#1a1a2e",
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          showBackground: true,
        }}
      />

      {/* Call To Action - Mid-Video Engagement */}
      <Composition
        id="CallToAction"
        component={CallToAction}
        durationInFrames={90}  // 3 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={callToActionSchema}
        defaultProps={{
          type: "like-subscribe" as const,
          customText: "",
          position: "bottom-right" as const,
          primaryColor: "#FFD700",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          textColor: "#FFFFFF",
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      />

      {/* Split Screen - Multi-Source Layout */}
      <Composition
        id="SplitScreen"
        component={SplitScreen}
        durationInFrames={300}  // 10 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={splitScreenSchema}
        defaultProps={{
          layout: "side-by-side" as const,
          sources: [],
          borderColor: "#FFD700",
          borderWidth: 4,
          backgroundColor: "#1a1a2e",
          showLabels: false,
          labelColor: "#FFFFFF",
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      />

      {/* Particle Background - Dynamic Effects */}
      <Composition
        id="ParticleBackground"
        component={ParticleBackground}
        durationInFrames={150}  // 5 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={particleBackgroundSchema}
        defaultProps={{
          style: "space-dust" as const,
          particleCount: 80,
          primaryColor: "#FFD700",
          secondaryColor: "#FFFFFF",
          backgroundColor: "#1a1a2e",
          speed: 1,
          opacity: 0.8,
        }}
      />
    </>
  );
};
