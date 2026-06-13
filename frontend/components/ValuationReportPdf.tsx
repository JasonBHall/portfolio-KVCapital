'use client'

import {
  Document, Page, Text, View, StyleSheet, pdf, Image,
} from '@react-pdf/renderer'
import { ValuationReport, SubjectProperty } from '@/lib/types'

const AMBER = '#d97706'
const DARK  = '#1e293b'
const MID   = '#475569'
const LIGHT = '#94a3b8'
const WHITE = '#ffffff'
const BORDER= '#e2e8f0'
const ROW_ALT = '#f8fafc'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: WHITE, padding: 40, fontSize: 9, color: DARK },

  // Firm header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  firm: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: DARK },
  firmSub: { fontSize: 8, color: LIGHT, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  reportLabel: { fontSize: 8, color: LIGHT, textTransform: 'uppercase', letterSpacing: 1 },
  reportDate: { fontSize: 9, color: MID, marginTop: 2 },

  // Subject property block
  subjectBlock: { marginBottom: 16 },
  subjectAddress: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 10 },
  subjectDivider: { borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 10 },
  subjectGrid: { flexDirection: 'row', gap: 24, marginBottom: 14 },
  subjectItem: {},
  subjectLabel: { fontSize: 7, color: LIGHT, textTransform: 'uppercase', letterSpacing: 0.8 },
  subjectValue: { fontSize: 9, color: DARK, marginTop: 1 },

  // Section label
  sectionLabel: { fontSize: 7, color: LIGHT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },

  // Two-column row
  row2: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { flex: 1, border: 1, borderColor: BORDER, borderRadius: 6, padding: 12 },

  // Value card
  valueRange: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: DARK },
  midpoint: { fontSize: 9, color: MID, marginTop: 4 },
  midAmt: { color: AMBER, fontFamily: 'Helvetica-Bold' },
  confidenceBadge: { marginTop: 10, fontSize: 8, color: MID },

  // Flags card
  flagItem: { flexDirection: 'row', gap: 5, marginBottom: 4 },
  flagBullet: { color: AMBER, fontSize: 8, marginTop: 0.5 },
  flagText: { fontSize: 8, color: '#92400e', flex: 1, lineHeight: 1.5 },
  noFlag: { fontSize: 8, color: '#065f46' },

  // Narrative
  narrativeCard: { border: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 12 },
  narrativeText: { fontSize: 9, color: MID, lineHeight: 1.6 },

  // Table
  tableWrap: { marginBottom: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 5, paddingHorizontal: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableRowAlt: { backgroundColor: ROW_ALT },
  outlierRow: { backgroundColor: '#fef3c7' },
  th: { fontSize: 7, color: LIGHT, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  td: { fontSize: 8, color: DARK },
  tdMuted: { fontSize: 8, color: MID },
  tdAmber: { fontSize: 8, color: AMBER, fontFamily: 'Helvetica-Bold' },

  // Col widths
  colAddr: { flex: 2.5 },
  colNum: { flex: 1, textAlign: 'right' },

  // Adj rates
  ratesCard: { border: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 12 },
  ratesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ratePill: { backgroundColor: '#f8fafc', border: 1, borderColor: BORDER, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8 },
  rateLabel: { fontSize: 7, color: LIGHT },
  rateValue: { fontSize: 9, color: DARK, fontFamily: 'Helvetica-Bold', marginTop: 1 },

  // Footer
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  footerText: { fontSize: 7, color: LIGHT },
})

function fmt(n: number) {
  return `$${n.toLocaleString()}`
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
  insufficient: 'Insufficient Data',
}

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  detached: 'Detached',
  'semi-detached': 'Semi-Detached',
  townhouse: 'Townhouse',
  condo: 'Condo',
}

interface Props {
  report: ValuationReport
  subject?: SubjectProperty
}

function PdfDocument({ report, subject }: Props) {
  return (
    <Document title="KV Capital Valuation Report" author="KV Capital">
      <Page size="LETTER" style={s.page}>

        {/* Firm header */}
        <View style={s.header}>
          <View>
            <Image src={`${window.location.origin}/logo.png`} style={{ height: 28, width: 'auto' }} />
            <Text style={s.firmSub}>Comp Analysis · AI Underwriting Assistant</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportLabel}>Valuation Report</Text>
            <Text style={s.reportDate}>{report.report_date}</Text>
          </View>
        </View>


        {/* Value + Flags row */}
        <View style={s.row2}>
          {/* Estimated value + subject details */}
          <View style={s.card}>
            {subject && (
              <Text style={s.subjectAddress}>{subject.address}, {subject.city}, {subject.province}</Text>
            )}
            <Text style={s.sectionLabel}>Estimated Value</Text>
            {report.confidence === 'insufficient' ? (
              <Text style={{ fontSize: 14, color: '#dc2626', fontFamily: 'Helvetica-Bold' }}>Insufficient Data</Text>
            ) : (
              <>
                <Text style={s.valueRange}>
                  {fmt(report.estimated_value_low)} – {fmt(report.estimated_value_high)}
                </Text>
                <Text style={s.midpoint}>
                  Midpoint: <Text style={s.midAmt}>{fmt(report.estimated_value_mid)}</Text>
                </Text>
              </>
            )}
            <Text style={s.confidenceBadge}>{CONFIDENCE_LABEL[report.confidence] ?? 'Unknown'}</Text>
            {subject && (
              <>
                <View style={{ borderTopWidth: 1, borderTopColor: BORDER, marginTop: 10, paddingTop: 10 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <SubjectStat label="Type" value={PROPERTY_TYPE_LABEL[subject.property_type] ?? subject.property_type} />
                    <SubjectStat label="Bedrooms" value={String(subject.bedrooms)} />
                    <SubjectStat label="Bathrooms" value={String(subject.bathrooms)} />
                    <SubjectStat label="Sqft" value={subject.sqft.toLocaleString()} />
                    <SubjectStat label="Year Built" value={String(subject.year_built)} />
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Flags */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Flags</Text>
            {report.flags.length === 0 ? (
              <Text style={s.noFlag}>No flags — clean comp set</Text>
            ) : (
              report.flags.map((flag, i) => (
                <View key={i} style={s.flagItem}>
                  <Text style={s.flagBullet}>!</Text>
                  <Text style={s.flagText}>{flag}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Narrative */}
        {report.narrative && (
          <View style={s.narrativeCard}>
            <Text style={s.sectionLabel}>Valuation Summary</Text>
            <Text style={s.narrativeText}>{report.narrative}</Text>
          </View>
        )}

        {/* Comparable Sales table */}
        {report.comps.length > 0 && (
          <View style={s.tableWrap}>
            <Text style={[s.sectionLabel, { marginBottom: 6 }]}>
              Comparable Sales ({report.comps.length})
            </Text>

            <View style={s.tableHeader}>
              <Text style={[s.th, s.colAddr]}>Address</Text>
              <Text style={[s.th, s.colNum]}>Sale Price</Text>
              <Text style={[s.th, s.colNum]}>Adj. Price</Text>
              <Text style={[s.th, s.colNum]}>Sqft</Text>
              <Text style={[s.th, s.colNum]}>Bed/Bath</Text>
              <Text style={[s.th, s.colNum]}>Yr Built</Text>
              <Text style={[s.th, s.colNum]}>Dist (km)</Text>
            </View>

            {report.comps.map((comp, i) => (
              <View
                key={comp.id}
                style={[
                  s.tableRow,
                  i % 2 === 1 ? s.tableRowAlt : {},
                  comp.is_outlier ? s.outlierRow : {},
                ]}
              >
                <Text style={[s.td, s.colAddr]}>
                  {comp.address}{comp.is_outlier ? ' [outlier]' : ''}
                </Text>
                <Text style={[s.tdMuted, s.colNum]}>{fmt(comp.sale_price)}</Text>
                <Text style={[s.tdAmber, s.colNum]}>{fmt(comp.adjusted_price)}</Text>
                <Text style={[s.tdMuted, s.colNum]}>{comp.sqft.toLocaleString()}</Text>
                <Text style={[s.tdMuted, s.colNum]}>{comp.bedrooms}bd/{comp.bathrooms}ba</Text>
                <Text style={[s.tdMuted, s.colNum]}>{comp.year_built}</Text>
                <Text style={[s.tdMuted, s.colNum]}>{comp.distance_km.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Adjustment Rates */}
        {report.adjustment_rates && (
          <View style={s.ratesCard}>
            <Text style={s.sectionLabel}>Adjustment Rates Used</Text>
            <View style={s.ratesGrid}>
              <AdjRate label="$/sqft" value={`$${report.adjustment_rates.sqft_per_foot}/ft`} />
              <AdjRate label="Per Bedroom" value={fmt(report.adjustment_rates.per_bedroom)} />
              <AdjRate label="Per Bathroom" value={fmt(report.adjustment_rates.per_bathroom)} />
              <AdjRate label="Per Year (Age)" value={fmt(report.adjustment_rates.per_year_age)} />
              <AdjRate label="Outlier Threshold" value={`${report.adjustment_rates.outlier_threshold_pct}%`} />
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Confidential — prepared for internal use · KV Capital</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

function SubjectStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.subjectItem}>
      <Text style={s.subjectLabel}>{label}</Text>
      <Text style={s.subjectValue}>{value}</Text>
    </View>
  )
}

function AdjRate({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.ratePill}>
      <Text style={s.rateLabel}>{label}</Text>
      <Text style={s.rateValue}>{value}</Text>
    </View>
  )
}

export async function downloadValuationPdf(report: ValuationReport, subject?: SubjectProperty) {
  const blob = await pdf(<PdfDocument report={report} subject={subject} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kv-capital-valuation-${report.report_date.replace(/\s/g, '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
