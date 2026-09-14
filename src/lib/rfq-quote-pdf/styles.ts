import { StyleSheet } from "@react-pdf/renderer";

// Colors pulled from globals.css's light-mode @theme tokens only — a
// downloaded PDF has no dark-mode concept, so the dark overrides never apply
// here.
export const pdfColors = {
  ink: "#101418",
  slate: "#5b6472",
  slateLt: "#8891a0",
  line: "#e2e6ed",
  paper: "#ffffff",
};

// @react-pdf/renderer's standard fonts (Helvetica/Times-Roman families) are
// the only ones available without Font.register()-ing a real font file —
// Times-Roman (serif) pairs with this app's own --font-display, Helvetica
// (sans-serif) with --font-body. Bold text must reference the bold family
// directly (e.g. "Helvetica-Bold") — a standard font does not synthesize
// bold from a fontWeight style.
export const pdfStyles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: pdfColors.ink,
  },

  headerBlock: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: pdfColors.ink,
  },
  companyName: {
    fontFamily: "Times-Bold",
    fontSize: 16,
  },
  documentTitle: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    marginTop: 2,
    color: pdfColors.slate,
  },

  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: pdfColors.ink,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: pdfColors.line,
  },

  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  fieldHalf: {
    width: "50%",
    paddingRight: 10,
    marginBottom: 7,
  },
  fieldFull: {
    width: "100%",
    paddingRight: 10,
    marginBottom: 7,
  },
  fieldLabel: {
    fontFamily: "Helvetica",
    fontSize: 6.5,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: pdfColors.slateLt,
    marginBottom: 2,
  },
  fieldValue: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: pdfColors.ink,
  },

  table: {
    borderWidth: 0.75,
    borderColor: pdfColors.line,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f4f6fa",
    borderBottomWidth: 0.75,
    borderBottomColor: pdfColors.line,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    textTransform: "uppercase",
    color: pdfColors.slateLt,
    padding: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: pdfColors.line,
  },
  tableCell: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: pdfColors.ink,
    padding: 4,
  },
  tableCellRight: {
    textAlign: "right",
  },

  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    marginTop: 6,
    gap: 6,
  },
  grandTotalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: pdfColors.ink,
  },
  grandTotalValue: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: pdfColors.ink,
  },
});
