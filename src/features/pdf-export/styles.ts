import { StyleSheet, Font } from "@react-pdf/renderer";

// Register Noto Sans for proper Cyrillic (Russian) support
Font.register({
  family: "Noto Sans",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/notosans/v36/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d41P6zHtY.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/notosans/v36/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAjBN9d41P6zHtY.ttf",
      fontWeight: 700,
    },
  ],
});

// Color palette
export const colors = {
  primary: "#3b82f6", // Blue
  primaryLight: "#93c5fd",
  primaryDark: "#1d4ed8",
  secondary: "#6b7280",
  success: "#22c55e",
  background: "#ffffff",
  surface: "#f8fafc",
  border: "#e2e8f0",
  text: "#1e293b",
  textMuted: "#64748b",
  textLight: "#94a3b8",
};

export const styles = StyleSheet.create({
  // Page styles
  page: {
    padding: 40,
    fontFamily: "Noto Sans",
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.background,
  },

  // Header styles
  header: {
    marginBottom: 30,
    textAlign: "center",
  },
  logo: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  userName: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 4,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.primary,
    marginTop: 8,
  },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  statCard: {
    width: "30%",
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 8,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.text,
  },
  statUnit: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 2,
  },

  // Section styles
  section: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },

  // Table styles
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 700,
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.surface,
  },
  tableCell: {
    fontSize: 9,
    color: colors.text,
  },

  // Chart styles
  chartContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 10,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  barLabel: {
    width: 50,
    fontSize: 8,
    color: colors.textMuted,
  },
  barContainer: {
    flex: 1,
    height: 14,
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: 8,
  },
  bar: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  barValue: {
    width: 45,
    fontSize: 8,
    color: colors.text,
    textAlign: "right",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: colors.textLight,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Utility
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  flexGrow: {
    flex: 1,
  },
  textCenter: {
    textAlign: "center",
  },
  mb8: {
    marginBottom: 8,
  },
  mb16: {
    marginBottom: 16,
  },
  mt16: {
    marginTop: 16,
  },

  // No data
  noData: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 40,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
});
