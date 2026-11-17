/* Phase 15: web and Expo share the same semantic palette and spacing values. */
export const theme = {
  brand: "#135D50", brandDark: "#104C42", brandSoft: "#E7F4EF",
  background: "#F6F8F6", surface: "#FFFFFF",
  ink: "#172C2B", muted: "#667C79", border: "#DEEAE4",
  danger: "#B63D3D", gold: "#E7AC61", radius: 18,
  radiusSm: 10, radiusMd: 14, radiusLg: 20,
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 },
  typography: { xs: 12, sm: 14, body: 15, md: 17, title: 20, heading: 26 },
  status: {
    success: "#116B52", successSoft: "#E5F6EC",
    warning: "#9C620A", warningSoft: "#FFF5E2",
    info: "#255C80", infoSoft: "#EAF4FC"
  }
} as const;
